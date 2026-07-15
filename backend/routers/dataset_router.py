from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
import shutil
import json
import os
from pathlib import Path
from database import get_db
import models
from auth import get_current_user, require_admin
from validators import validate_dataset, cleanup, IMG_EXTS

router = APIRouter(prefix="/api/datasets", tags=["datasets"])

DATA_DIR = Path("data")
UPLOADS_DIR = DATA_DIR / "uploads"
DATASETS_DIR = DATA_DIR / "datasets"
for d in (UPLOADS_DIR, DATASETS_DIR):
    d.mkdir(parents=True, exist_ok=True)


@router.post("/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    task_type: str = Form("classification"),
    user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip files are supported")
    
    # Use zip filename (without extension) as dataset name
    dataset_name = Path(file.filename).stem
    
    dataset = models.Dataset(
        name=dataset_name,
        task_type=task_type,
        num_images=0,
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    
    zip_path = UPLOADS_DIR / f"{dataset.id}.zip"
    extract_dir = DATASETS_DIR / dataset.id
    
    try:
        with zip_path.open("wb") as f:
            shutil.copyfileobj(file.file, f)
        
        result = validate_dataset(zip_path, extract_dir, task_type)
        zip_path.unlink(missing_ok=True)
        
        if not result.valid:
            cleanup(extract_dir)
            db.delete(dataset)
            db.commit()
            raise HTTPException(status_code=400, detail={
                "errors": result.errors,
                "warnings": result.warnings,
            })
        
        dataset.folder_path = str(extract_dir)
        dataset.num_images = result.summary.get("total_images", 0)
        dataset.classes_json = json.dumps(result.summary.get("classes", []))
        db.commit()
        
        return {
            "dataset_id": dataset.id,
            "name": dataset.name,
            "warnings": result.warnings,
            "summary": result.summary,
        }
    except HTTPException:
        raise
    except Exception as e:
        cleanup(extract_dir)
        zip_path.unlink(missing_ok=True)
        db.delete(dataset)
        db.commit()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/")
def list_datasets(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    datasets = db.query(models.Dataset).order_by(models.Dataset.created_at.desc()).all()
    results = []
    for ds in datasets:
        results.append({
            "id": ds.id,
            "name": ds.name,
            "task_type": ds.task_type,
            "num_images": ds.num_images,
            "classes": ds.classes_json,
            "status": ds.status,
            "created_at": ds.created_at.isoformat() if ds.created_at else None,
            "updated_at": ds.updated_at.isoformat() if ds.updated_at else None,
        })
    return results


@router.get("/{dataset_id}")
def get_dataset(dataset_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    ds = db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return {
        "id": ds.id,
        "name": ds.name,
        "task_type": ds.task_type,
        "num_images": ds.num_images,
        "classes": ds.classes_json,
        "folder_path": ds.folder_path,
        "status": ds.status,
        "created_at": ds.created_at.isoformat() if ds.created_at else None,
    }


@router.delete("/{dataset_id}")
def delete_dataset(
    dataset_id: str,
    user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    ds = db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # Delete files
    if ds.folder_path and os.path.exists(ds.folder_path):
        shutil.rmtree(ds.folder_path, ignore_errors=True)
    
    db.delete(ds)
    db.commit()
    return {"status": "deleted"}


@router.get("/{dataset_id}/images")
def get_dataset_images(dataset_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    ds = db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
    if not ds or not ds.folder_path:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    images = []
    root = Path(ds.folder_path)
    for img_path in root.rglob("*"):
        if img_path.is_file() and img_path.suffix.lower() in IMG_EXTS:
            rel_path = img_path.relative_to(root)
            images.append({
                "filename": str(rel_path),
                "url": f"/data/datasets/{dataset_id}/{str(rel_path).replace(os.sep, '/')}",
            })
    return images


@router.delete("/{dataset_id}/images/{filename:path}")
def delete_dataset_image(
    dataset_id: str,
    filename: str,
    user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    ds = db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
    if not ds or not ds.folder_path:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    file_path = Path(ds.folder_path) / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    
    file_path.unlink()
    ds.num_images = max(0, ds.num_images - 1)
    db.commit()
    return {"status": "deleted"}
