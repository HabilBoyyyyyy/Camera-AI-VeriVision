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


@router.post("/create")
async def create_empty_dataset(
    name: str = Form(...),
    task_type: str = Form("classification"),
    user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Create an empty dataset (no zip upload). Used by camera capture flow."""
    dataset = models.Dataset(
        name=name.strip(),
        task_type=task_type,
        num_images=0,
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    # Create the folder structure
    ds_dir = DATASETS_DIR / dataset.id
    if task_type == "classification":
        (ds_dir / "train" / "OK").mkdir(parents=True, exist_ok=True)
        (ds_dir / "train" / "NG").mkdir(parents=True, exist_ok=True)
        (ds_dir / "valid" / "OK").mkdir(parents=True, exist_ok=True)
        (ds_dir / "valid" / "NG").mkdir(parents=True, exist_ok=True)
    else:
        (ds_dir / "images").mkdir(parents=True, exist_ok=True)
        (ds_dir / "labels").mkdir(parents=True, exist_ok=True)

    dataset.folder_path = str(ds_dir)
    dataset.classes_json = json.dumps(["OK", "NG"] if task_type == "classification" else [])
    db.commit()

    return {
        "dataset_id": dataset.id,
        "name": dataset.name,
        "task_type": dataset.task_type,
    }


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
    
    # Check if dataset has associated models. Deleting models might be dangerous.
    associated_models = db.query(models.TrainedModel).filter(models.TrainedModel.dataset_id == dataset_id).count()
    if associated_models > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete dataset. It is used by {associated_models} trained model(s). Please delete the models first.")
        
    db.query(models.TrainingJob).filter(models.TrainingJob.dataset_id == dataset_id).delete(synchronize_session=False)
    
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


from typing import List

@router.post("/{dataset_id}/add-images")
async def add_dataset_images(
    dataset_id: str,
    path: str = Form(""),
    files: List[UploadFile] = File(...),
    user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    ds = db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
    if not ds or not ds.folder_path:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    root_dir = Path(ds.folder_path)
    if path:
        target_dir = root_dir / path.strip("/")
    else:
        target_dir = root_dir
        
    target_dir.mkdir(parents=True, exist_ok=True)
    
    added_count = 0
    from validators import safe_extract_zip, _count_images
    
    for file in files:
        if file.filename.endswith(".zip"):
            # It's a zip update, extract it to the root or target
            temp_zip = root_dir / f"temp_{file.filename}"
            with temp_zip.open("wb") as f:
                shutil.copyfileobj(file.file, f)
            try:
                # If they upload a zip, merge it at the target_dir
                safe_extract_zip(temp_zip, target_dir)
            except Exception as e:
                temp_zip.unlink(missing_ok=True)
                raise HTTPException(status_code=400, detail=f"Failed to extract zip: {e}")
            
            temp_zip.unlink(missing_ok=True)
        else:
            # It's a single image
            ext = Path(file.filename).suffix.lower()
            if ext in IMG_EXTS:
                file_path = target_dir / file.filename
                with file_path.open("wb") as f:
                    shutil.copyfileobj(file.file, f)
                added_count += 1
                
    # Recalculate total image count
    new_count = 0
    for img_path in root_dir.rglob("*"):
        if img_path.is_file() and img_path.suffix.lower() in IMG_EXTS:
            new_count += 1
            
    ds.num_images = new_count
    db.commit()
    
    return {"status": "success", "total_images": new_count}


def _find_label_file(ds_root: Path, image_filename: str) -> Path | None:
    """Given an image filename (e.g. 'train/images/img001.jpg'), find its YOLO label .txt file."""
    img_path = Path(image_filename)
    label_name = img_path.stem + ".txt"

    # Try standard YOLO structures:
    # Structure A: images/train/img.jpg → labels/train/img.txt
    # Structure B: train/images/img.jpg → train/labels/img.txt
    parts = list(img_path.parts)

    for i, part in enumerate(parts):
        if part == "images":
            label_parts = list(parts)
            label_parts[i] = "labels"
            label_parts[-1] = label_name
            candidate = ds_root / Path(*label_parts)
            if candidate.exists():
                return candidate

    # Fallback: look in a top-level 'labels' dir with same name
    candidate = ds_root / "labels" / label_name
    if candidate.exists():
        return candidate

    return None


def _resolve_dataset_root(ds_folder: Path) -> Path:
    """Resolve the actual root inside the dataset folder (handles single wrapper dir)."""
    entries = [p for p in ds_folder.iterdir() if not p.name.startswith("__MACOSX")]
    if len(entries) == 1 and entries[0].is_dir():
        return entries[0]
    return ds_folder


@router.get("/{dataset_id}/annotations/{filename:path}")
def get_image_annotations(
    dataset_id: str,
    filename: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Return YOLO annotations for a specific image, parsed into JSON format."""
    ds = db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
    if not ds or not ds.folder_path:
        raise HTTPException(status_code=404, detail="Dataset not found")

    ds_root = _resolve_dataset_root(Path(ds.folder_path))

    # Parse class names from data.yaml
    class_names = []
    data_yaml = ds_root / "data.yaml"
    if data_yaml.exists():
        import yaml
        try:
            with open(data_yaml, "r", encoding="utf-8") as f:
                yaml_data = yaml.safe_load(f)
            names_raw = yaml_data.get("names", [])
            if isinstance(names_raw, dict):
                class_names = [names_raw[k] for k in sorted(names_raw.keys())]
            elif isinstance(names_raw, list):
                class_names = list(names_raw)
        except Exception:
            pass

    # Find the label file
    label_path = _find_label_file(ds_root, filename)
    if not label_path:
        return {"annotations": [], "classes": class_names}

    # Parse YOLO format: class_id cx cy w h (normalized 0-1)
    annotations = []
    try:
        with open(label_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                parts = line.split()
                if len(parts) < 5:
                    continue
                cls_id = int(parts[0])
                cx, cy, bw, bh = float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])
                label = class_names[cls_id] if cls_id < len(class_names) else f"class_{cls_id}"
                annotations.append({
                    "type": "box",
                    "cx": cx,
                    "cy": cy,
                    "w": bw,
                    "h": bh,
                    "label": label,
                    "class_id": cls_id,
                })
    except Exception:
        pass

    return {"annotations": annotations, "classes": class_names}


@router.get("/{dataset_id}/classes")
def get_dataset_classes(
    dataset_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Return the class names for a dataset."""
    ds = db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Try from database first
    if ds.classes_json:
        try:
            classes = json.loads(ds.classes_json)
            if classes:
                return {"classes": classes}
        except Exception:
            pass

    # Fallback: parse from data.yaml for detection datasets
    if ds.task_type == "detection" and ds.folder_path:
        ds_root = _resolve_dataset_root(Path(ds.folder_path))
        data_yaml = ds_root / "data.yaml"
        if data_yaml.exists():
            import yaml
            try:
                with open(data_yaml, "r", encoding="utf-8") as f:
                    yaml_data = yaml.safe_load(f)
                names_raw = yaml_data.get("names", [])
                if isinstance(names_raw, dict):
                    classes = [names_raw[k] for k in sorted(names_raw.keys())]
                elif isinstance(names_raw, list):
                    classes = list(names_raw)
                else:
                    classes = []
                # Also update the database for future queries
                if classes:
                    ds.classes_json = json.dumps(classes)
                    db.commit()
                return {"classes": classes}
            except Exception:
                pass

    return {"classes": []}


from pydantic import BaseModel
import cv2
import numpy as np

class SmartPolygonRequest(BaseModel):
    filename: str
    bbox: list[float]  # [x_min, y_min, x_max, y_max]

# Cache for the SAM model
_sam_model = None

@router.post("/{dataset_id}/smart-polygon")
async def generate_smart_polygon(
    dataset_id: str,
    request: SmartPolygonRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    ds = db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
    if not ds or not ds.folder_path:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    ds_root = _resolve_dataset_root(Path(ds.folder_path))
    img_path = ds_root / request.filename
    if not img_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Load SAM Model if not loaded
    global _sam_model
    if _sam_model is None:
        try:
            from ultralytics import SAM
            # Use MobileSAM for speed
            _sam_model = SAM("mobile_sam.pt")
        except ImportError:
            raise HTTPException(status_code=500, detail="ultralytics package is required for Smart Polygon.")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to load SAM model: {str(e)}")
    
    # Load image
    img = cv2.imread(str(img_path))
    if img is None:
        raise HTTPException(status_code=400, detail="Could not read image file.")
    
    # Run inference
    try:
        results = _sam_model(img, bboxes=[request.bbox], verbose=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")
    
    if not results or len(results) == 0:
        return {"points": []}
    
    res = results[0]
    
    if res.masks is None or len(res.masks.xy) == 0:
        return {"points": []}
    
    # Extract the polygon points
    # mask.xy returns a list of polygons (each is an array of [x, y] coords).
    # We take the first one corresponding to the bbox.
    polygon_points = res.masks.xy[0]
    
    # Format points for frontend: [{x, y}, {x, y}, ...]
    formatted_points = [{"x": float(pt[0]), "y": float(pt[1])} for pt in polygon_points]
    
    return {"points": formatted_points}
