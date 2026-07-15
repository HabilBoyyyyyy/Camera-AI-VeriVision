from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
import json
import os
import traceback
from pathlib import Path
from datetime import datetime

from database import get_db, SessionLocal
import models
from auth import require_admin, get_current_user
from schemas import TrainConfigRequest

router = APIRouter(prefix="/api/training", tags=["training"])

MODELS_DIR = Path("data") / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# In-memory job progress store (simple, no Redis needed)
_job_progress = {}  # job_id -> {"epoch": ..., "total_epochs": ..., "loss": ..., "accuracy": ...}


def _run_training(job_id: str, model_id: str, dataset_id: str, config_dict: dict):
    """Background training task. Runs in a thread."""
    db = SessionLocal()
    try:
        job = db.query(models.TrainingJob).filter(models.TrainingJob.id == job_id).first()
        trained_model = db.query(models.TrainedModel).filter(models.TrainedModel.id == model_id).first()
        dataset = db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
        
        if not job or not trained_model or not dataset:
            return
        
        job.status = "training"
        job.started_at = datetime.utcnow()
        db.commit()
        
        task_type = config_dict.get("task_type", "classification")
        architecture = config_dict.get("architecture", "resnet50")
        epochs = config_dict.get("epochs", 50)
        batch_size = config_dict.get("batch_size", 16)
        image_size = config_dict.get("image_size", 224)
        learning_rate = config_dict.get("learning_rate", 0.001)
        opt_name = config_dict.get("optimizer", "adam")
        pretrained = config_dict.get("pretrained", True)
        patience = config_dict.get("early_stopping_patience", 10)
        
        dataset_path = dataset.folder_path
        output_dir = str(MODELS_DIR.resolve() / model_id)
        os.makedirs(output_dir, exist_ok=True)
        
        if task_type == "classification":
            _train_classification(job_id, dataset_path, output_dir, architecture, epochs,
                                  batch_size, image_size, learning_rate, opt_name, pretrained, patience)
        elif task_type == "detection":
            _train_detection(job_id, dataset_path, output_dir, architecture, epochs,
                             batch_size, image_size, learning_rate, opt_name, pretrained, patience)
        
        # On success
        final_progress = _job_progress.get(job_id, {})
        
        # Find weights file — search recursively since YOLO may nest under run/weights/
        weights_path = None
        for pt_file in Path(output_dir).rglob("best.pt"):
            weights_path = str(pt_file)
            break
        if not weights_path:
            for pt_file in Path(output_dir).rglob("*.pt"):
                if "best" in pt_file.name:
                    weights_path = str(pt_file)
                    break
        
        if weights_path:
            trained_model.status = "trained"
            trained_model.weights_path = weights_path
            trained_model.metrics_json = json.dumps(final_progress.get("metrics", {}))
            
            job.status = "completed"
            job.completed_at = datetime.utcnow()
            job.progress_json = json.dumps(final_progress)
        else:
            trained_model.status = "failed"
            job.status = "failed"
            job.error_message = "Training completed but no weights file (best.pt) was generated. Dataset may be invalid or too small."
            job.completed_at = datetime.utcnow()
        
        db.commit()
        
    except Exception as e:
        traceback.print_exc()
        try:
            job = db.query(models.TrainingJob).filter(models.TrainingJob.id == job_id).first()
            trained_model = db.query(models.TrainedModel).filter(models.TrainedModel.id == model_id).first()
            if job:
                job.status = "failed"
                job.error_message = str(e)
                job.completed_at = datetime.utcnow()
            if trained_model:
                trained_model.status = "failed"
            db.commit()
        except:
            pass
    finally:
        db.close()


def _train_classification(job_id, dataset_path, output_dir, architecture, epochs,
                           batch_size, image_size, learning_rate, opt_name, pretrained, patience):
    """Train classification model using YOLO classify."""
    from ultralytics import YOLO
    
    # Use YOLO classification model
    arch_map = {
        "resnet50": "yolov8n-cls.pt",
        "efficientnet_b0": "yolov8n-cls.pt",
        "yolov8n": "yolov8n-cls.pt",
        "yolov8s": "yolov8s-cls.pt",
    }
    model_file = arch_map.get(architecture, "yolov8n-cls.pt")
    model = YOLO(model_file)
    
    def on_fit_epoch_end(trainer):
        current_epoch = trainer.epoch + 1
        
        # Extract train loss
        train_loss = 0.0
        if hasattr(trainer, 'loss'):
            # It might be a tensor or float
            train_loss = float(trainer.loss.sum().item()) if hasattr(trainer.loss, 'sum') else float(trainer.loss)
            
        metrics_dict = {}
        if hasattr(trainer, 'metrics') and isinstance(trainer.metrics, dict):
            metrics_dict = {k: float(v) for k, v in trainer.metrics.items()}
            
        hist_entry = {
            "epoch": current_epoch,
            "train_loss": train_loss,
            "metrics": metrics_dict
        }
        
        if job_id in _job_progress:
            _job_progress[job_id]["epoch"] = current_epoch
            if "epochs_history" not in _job_progress[job_id]:
                _job_progress[job_id]["epochs_history"] = []
            _job_progress[job_id]["epochs_history"].append(hist_entry)
            _job_progress[job_id]["metrics"] = metrics_dict

    model.add_callback("on_fit_epoch_end", on_fit_epoch_end)
    
    # Find the dataset root (should contain train/ and valid/ folders)
    from validators import _find_root
    root = _find_root(Path(dataset_path))
    
    results = model.train(
        data=str(root),
        epochs=epochs,
        imgsz=image_size,
        batch=batch_size,
        lr0=learning_rate,
        optimizer=opt_name.upper() if opt_name != "adam" else "Adam",
        project=output_dir,
        name="run",
        exist_ok=True,
        patience=patience or 0,
        workers=0,
        verbose=True,
    )


def _train_detection(job_id, dataset_path, output_dir, architecture, epochs,
                      batch_size, image_size, learning_rate, opt_name, pretrained, patience):
    """Train detection model using YOLO detect."""
    from ultralytics import YOLO
    
    arch_map = {
        "yolov8n": "yolov8n.pt",
        "yolov8s": "yolov8s.pt",
        "resnet50": "yolov8n.pt",
        "efficientnet_b0": "yolov8n.pt",
    }
    model_file = arch_map.get(architecture, "yolov8n.pt")
    model = YOLO(model_file if pretrained else architecture + ".yaml")
    
    def on_fit_epoch_end(trainer):
        current_epoch = trainer.epoch + 1
        
        train_loss = 0.0
        if hasattr(trainer, 'loss'):
            train_loss = float(trainer.loss.sum().item()) if hasattr(trainer.loss, 'sum') else float(trainer.loss)
            
        metrics_dict = {}
        if hasattr(trainer, 'metrics') and isinstance(trainer.metrics, dict):
            metrics_dict = {k: float(v) for k, v in trainer.metrics.items()}
            
        hist_entry = {
            "epoch": current_epoch,
            "train_loss": train_loss,
            "metrics": metrics_dict
        }
        
        if job_id in _job_progress:
            _job_progress[job_id]["epoch"] = current_epoch
            if "epochs_history" not in _job_progress[job_id]:
                _job_progress[job_id]["epochs_history"] = []
            _job_progress[job_id]["epochs_history"].append(hist_entry)
            _job_progress[job_id]["metrics"] = metrics_dict

    model.add_callback("on_fit_epoch_end", on_fit_epoch_end)
    
    from validators import _find_root
    root = _find_root(Path(dataset_path))
    data_yaml = root / "data.yaml"
    
    results = model.train(
        data=str(data_yaml),
        epochs=epochs,
        imgsz=image_size,
        batch=batch_size,
        lr0=learning_rate,
        optimizer=opt_name.upper() if opt_name != "adam" else "Adam",
        project=output_dir,
        name="run",
        exist_ok=True,
        patience=patience or 0,
        workers=0,
    )


@router.post("/start")
def start_training(
    config: TrainConfigRequest,
    background_tasks: BackgroundTasks,
    user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    # Validate dataset exists
    dataset = db.query(models.Dataset).filter(models.Dataset.id == config.dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # Handle model versioning
    version = 1
    parent_model_id = None
    if config.update_existing and config.existing_model_id:
        existing = db.query(models.TrainedModel).filter(
            models.TrainedModel.id == config.existing_model_id
        ).first()
        if existing:
            # Find max version for this model name
            max_version = db.query(models.TrainedModel).filter(
                models.TrainedModel.name == existing.name
            ).count()
            version = max_version + 1
            parent_model_id = existing.id
    
    # Create model record
    trained_model = models.TrainedModel(
        name=config.model_name,
        dataset_id=config.dataset_id,
        version=version,
        task_type=config.task_type.value,
        architecture=config.architecture.value,
        config_json=config.model_dump_json(),
        status="training",
        parent_model_id=parent_model_id,
    )
    db.add(trained_model)
    db.commit()
    db.refresh(trained_model)
    
    # Create training job
    job = models.TrainingJob(
        model_id=trained_model.id,
        dataset_id=config.dataset_id,
        config_json=config.model_dump_json(),
        status="queued",
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    
    # Initialize progress
    _job_progress[job.id] = {
        "epoch": 0,
        "total_epochs": config.epochs,
        "loss": None,
        "accuracy": None,
        "epochs_history": []
    }
    
    # Launch background training
    background_tasks.add_task(
        _run_training,
        job.id,
        trained_model.id,
        config.dataset_id,
        config.model_dump(),
    )
    
    return {
        "job_id": job.id,
        "model_id": trained_model.id,
        "status": "queued",
    }


@router.get("/status/{job_id}")
def get_training_status(job_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    job = db.query(models.TrainingJob).filter(models.TrainingJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    progress = _job_progress.get(job_id)
    if not progress and job.progress_json:
        try:
            progress = json.loads(job.progress_json)
        except:
            progress = None
    
    return {
        "job_id": job.id,
        "model_id": job.model_id,
        "status": job.status,
        "progress": progress,
        "error": job.error_message,
    }


@router.get("/history")
def get_training_history(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    jobs = db.query(models.TrainingJob).order_by(
        models.TrainingJob.started_at.desc().nullslast()
    ).limit(20).all()
    
    results = []
    for job in jobs:
        model = db.query(models.TrainedModel).filter(
            models.TrainedModel.id == job.model_id
        ).first()
        results.append({
            "job_id": job.id,
            "model_id": job.model_id,
            "model_name": model.name if model else "Unknown",
            "status": job.status,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "error": job.error_message,
        })
    return results
