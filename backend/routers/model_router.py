from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import json
import os

from database import get_db
import models
from auth import get_current_user, require_admin

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("/")
def list_models(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    all_models = db.query(models.TrainedModel).order_by(
        models.TrainedModel.created_at.desc()
    ).all()
    
    results = []
    for m in all_models:
        metrics = {}
        if m.metrics_json:
            try:
                metrics = json.loads(m.metrics_json)
            except:
                pass
        config = {}
        if m.config_json:
            try:
                config = json.loads(m.config_json)
            except:
                pass
        results.append({
            "id": m.id,
            "name": m.name,
            "version": m.version,
            "task_type": m.task_type,
            "architecture": m.architecture,
            "status": m.status,
            "metrics": metrics,
            "config": config,
            "weights_path": m.weights_path,
            "dataset_id": m.dataset_id,
            "parent_model_id": m.parent_model_id,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        })
    return results


@router.get("/{model_id}")
def get_model(model_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    m = db.query(models.TrainedModel).filter(models.TrainedModel.id == model_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Model not found")
    
    metrics = {}
    if m.metrics_json:
        try:
            metrics = json.loads(m.metrics_json)
        except:
            pass
    config = {}
    if m.config_json:
        try:
            config = json.loads(m.config_json)
        except:
            pass
    
    # Get version history
    versions = db.query(models.TrainedModel).filter(
        models.TrainedModel.name == m.name
    ).order_by(models.TrainedModel.version.desc()).all()
    
    version_history = [{
        "id": v.id,
        "version": v.version,
        "status": v.status,
        "created_at": v.created_at.isoformat() if v.created_at else None,
    } for v in versions]
    
    return {
        "id": m.id,
        "name": m.name,
        "version": m.version,
        "task_type": m.task_type,
        "architecture": m.architecture,
        "status": m.status,
        "metrics": metrics,
        "config": config,
        "weights_path": m.weights_path,
        "dataset_id": m.dataset_id,
        "parent_model_id": m.parent_model_id,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "version_history": version_history,
    }


@router.delete("/{model_id}")
def delete_model(
    model_id: str,
    confirm: bool = False,
    user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    m = db.query(models.TrainedModel).filter(models.TrainedModel.id == model_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Model not found")
    if not confirm:
        raise HTTPException(status_code=400, detail="Pass ?confirm=true to confirm deletion")
    
    # Delete weights file
    if m.weights_path and os.path.exists(m.weights_path):
        import shutil
        model_dir = os.path.dirname(m.weights_path)
        shutil.rmtree(model_dir, ignore_errors=True)
    
    db.delete(m)
    db.commit()
    return {"status": "deleted"}


@router.get("/{model_id}/download")
def download_model(model_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    m = db.query(models.TrainedModel).filter(models.TrainedModel.id == model_id).first()
    if not m or not m.weights_path:
        raise HTTPException(status_code=404, detail="Model weights not found")
    if not os.path.exists(m.weights_path):
        raise HTTPException(status_code=404, detail="Weight file missing from disk")
    return FileResponse(
        m.weights_path,
        filename=f"{m.name}_v{m.version}.pt",
        media_type="application/octet-stream",
    )


@router.get("/{model_id}/visualizations")
def get_model_visualizations(model_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    m = db.query(models.TrainedModel).filter(models.TrainedModel.id == model_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Model not found")
    
    # YOLO typically saves runs to data/models/{model_id}/run/
    # But it might be in runs/.../run/ depending on ultralytics version/setup.
    run_dir = os.path.join("data", "models", model_id, "run")
    os.makedirs(run_dir, exist_ok=True)
    
    # If we have weights_path, try to find the actual YOLO run directory and copy missing PNGs
    if m.weights_path and os.path.exists(m.weights_path):
        from pathlib import Path
        import shutil
        actual_run_dir = Path(m.weights_path).parent.parent
        if actual_run_dir.exists() and actual_run_dir.name == "run":
            for png_file in actual_run_dir.glob("*.png"):
                dest = Path(run_dir) / png_file.name
                if not dest.exists():
                    shutil.copy2(png_file, dest)
                    
    visualizations = []
    if os.path.exists(run_dir):
        for file in os.listdir(run_dir):
            if file.endswith(".png") or file.endswith(".jpg"):
                # Exclude batch images as they clutter the evaluation metrics
                if not file.startswith("val_batch") and not file.startswith("train_batch"):
                    # URL maps to the static files mount /data
                    url = f"/data/models/{model_id}/run/{file}"
                    
                    # Create a human readable name
                    name = file.replace(".png", "").replace(".jpg", "").replace("_", " ").title()
                    
                    visualizations.append({
                        "name": name,
                        "url": url
                    })
                    
    # Sort alphabetically by name
    visualizations.sort(key=lambda x: x["name"])
    return visualizations
