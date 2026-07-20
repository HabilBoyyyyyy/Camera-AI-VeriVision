from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import csv
import io
import os
import shutil
from datetime import datetime
from pathlib import Path

from database import get_db
import models
from auth import get_current_user

router = APIRouter(prefix="/api/results", tags=["results"])


class ReviewRequest(BaseModel):
    review_verdict: str  # "OK" or "NG"
    review_notes: Optional[str] = ""


@router.get("/")
def get_results(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    verdict: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    model_id: Optional[str] = None,
    min_conf: Optional[float] = None,
    max_conf: Optional[float] = None,
    search_id: Optional[str] = None,
    review_status: Optional[str] = None,  # "pending", "reviewed", or None for all
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    query = db.query(models.InspectionResult)
    if verdict:
        query = query.filter(models.InspectionResult.verdict == verdict)
    if model_id:
        query = query.filter(models.InspectionResult.model_id == model_id)
    if min_conf is not None:
        query = query.filter(models.InspectionResult.confidence >= min_conf)
    if max_conf is not None:
        query = query.filter(models.InspectionResult.confidence <= max_conf)
    if search_id:
        query = query.filter(models.InspectionResult.id.ilike(f"%{search_id}%"))
    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            query = query.filter(models.InspectionResult.created_at >= start_dt)
        except ValueError:
            pass
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            query = query.filter(models.InspectionResult.created_at <= end_dt)
        except ValueError:
            pass
    # Review status filter
    if review_status == "pending":
        query = query.filter(
            models.InspectionResult.verdict == "Uncertain",
            models.InspectionResult.review_verdict.is_(None),
        )
    elif review_status == "reviewed":
        query = query.filter(models.InspectionResult.review_verdict.isnot(None))
    
    total = query.count()
    results = query.order_by(
        models.InspectionResult.created_at.desc()
    ).offset((page - 1) * limit).limit(limit).all()
    
    items = []
    for r in results:
        items.append({
            "id": r.id,
            "model_id": r.model_id,
            "verdict": r.verdict,
            "confidence": r.confidence,
            "image_path": r.image_path,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            # Review fields
            "review_verdict": r.review_verdict,
            "review_notes": r.review_notes,
            "reviewed_by": r.reviewed_by,
            "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
            "exported_to_dataset": bool(r.exported_to_dataset),
        })
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
    }


@router.put("/{result_id}/review")
def submit_review(
    result_id: str,
    body: ReviewRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Submit a manual review for an inspection result.
    Also auto-exports the validated image to the training dataset."""
    
    result = db.query(models.InspectionResult).filter(
        models.InspectionResult.id == result_id
    ).first()
    if not result:
        raise HTTPException(status_code=404, detail="Inspection result not found")
    
    if body.review_verdict not in ("OK", "NG"):
        raise HTTPException(status_code=400, detail="review_verdict must be 'OK' or 'NG'")
    
    # Save review
    result.review_verdict = body.review_verdict
    result.review_notes = body.review_notes or ""
    result.reviewed_by = user.username
    result.reviewed_at = datetime.utcnow()
    
    # Auto-export to training dataset
    export_info = _export_to_dataset(result, db)
    if export_info:
        result.exported_to_dataset = True
    
    db.commit()
    
    return {
        "status": "success",
        "review_verdict": result.review_verdict,
        "review_notes": result.review_notes,
        "reviewed_by": result.reviewed_by,
        "reviewed_at": result.reviewed_at.isoformat(),
        "exported_to_dataset": bool(result.exported_to_dataset),
        "export_info": export_info,
    }


@router.post("/{result_id}/undo-review")
def undo_review(
    result_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    import glob
    
    result = db.query(models.InspectionResult).filter(
        models.InspectionResult.id == result_id
    ).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="Inspection result not found")
        
    if not result.review_verdict:
        raise HTTPException(status_code=400, detail="Result has not been reviewed")
        
    # Attempt to find and delete the exported file from the dataset
    if result.exported_to_dataset:
        model_record = db.query(models.TrainedModel).filter(
            models.TrainedModel.id == result.model_id
        ).first()
        if model_record and model_record.dataset_id:
            dataset = db.query(models.Dataset).filter(
                models.Dataset.id == model_record.dataset_id
            ).first()
            if dataset and dataset.folder_path:
                from validators import _find_root
                dataset_root = _find_root(Path(dataset.folder_path))
                
                # Search for the exported image across all subdirectories
                search_pattern = str(dataset_root / "**" / f"reviewed_*_{result.id[:8]}.jpg")
                for p in glob.glob(search_pattern, recursive=True):
                    try:
                        os.remove(p)
                        # Decrement dataset count
                        if dataset.num_images and dataset.num_images > 0:
                            dataset.num_images -= 1
                    except Exception as e:
                        print(f"Failed to delete {p}: {e}")
                        
                # Invalidate cache if it exists
                cache_file = dataset_root / "train.cache"
                if cache_file.exists():
                    cache_file.unlink()
    
    # Reset fields
    result.review_verdict = None
    result.review_notes = None
    result.reviewed_by = None
    result.reviewed_at = None
    result.exported_to_dataset = False
    
    db.commit()
    
    return {"status": "success", "message": "Review undone successfully"}


def _export_to_dataset(result: models.InspectionResult, db: Session) -> Optional[dict]:
    """Copy the inspection image into the training dataset's train/{verdict}/ folder."""
    try:
        # Find the model and its dataset
        model_record = db.query(models.TrainedModel).filter(
            models.TrainedModel.id == result.model_id
        ).first()
        if not model_record or not model_record.dataset_id:
            return None
        
        dataset = db.query(models.Dataset).filter(
            models.Dataset.id == model_record.dataset_id
        ).first()
        if not dataset or not dataset.folder_path:
            return None
        
        # Source image (inspection image stored on disk)
        src_image = None
        if result.image_path:
            # image_path is like /data/inspections/uuid.jpg
            src_image = Path(result.image_path.lstrip("/"))
        if not src_image or not src_image.exists():
            return None
        
        # Find the dataset root (with train/ folder)
        from validators import _find_root
        dataset_root = _find_root(Path(dataset.folder_path))
        
        # Destination: 80% to train, 20% to valid
        import random
        split_folder = "train" if random.random() < 0.8 else "valid"
        dest_folder = dataset_root / split_folder / result.review_verdict
        dest_folder.mkdir(parents=True, exist_ok=True)
        
        # Generate filename: reviewed_{timestamp}_{original}.jpg
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        dest_filename = f"reviewed_{timestamp}_{result.id[:8]}.jpg"
        dest_path = dest_folder / dest_filename
        
        shutil.copy2(str(src_image), str(dest_path))
        
        # Update dataset image count
        dataset.num_images = (dataset.num_images or 0) + 1
        dataset.updated_at = datetime.utcnow()
        
        # Invalidate any existing cache files so YOLO re-scans
        cache_file = dataset_root / "train.cache"
        if cache_file.exists():
            cache_file.unlink()
        
        return {
            "dataset_id": dataset.id,
            "dataset_name": dataset.name,
            "exported_to": str(dest_path),
            "label": result.review_verdict,
        }
    except Exception as e:
        print(f"[WARN] Failed to export reviewed image to dataset: {e}")
        return None


@router.get("/feedback-stats")
def get_feedback_stats(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Return how many validated images have been added to each dataset since last training."""
    from sqlalchemy import func
    
    # Get all trained models
    trained_models = db.query(models.TrainedModel).filter(
        models.TrainedModel.status == "trained"
    ).all()
    
    stats = []
    for m in trained_models:
        if not m.dataset_id:
            continue
        
        dataset = db.query(models.Dataset).filter(
            models.Dataset.id == m.dataset_id
        ).first()
        if not dataset:
            continue
        
        # Count reviewed+exported results for this model that were reviewed after the model was created
        new_validated = db.query(func.count(models.InspectionResult.id)).filter(
            models.InspectionResult.model_id == m.id,
            models.InspectionResult.exported_to_dataset == True,
            models.InspectionResult.reviewed_at > m.created_at,
        ).scalar() or 0
        
        # Count total pending review (Uncertain, not yet reviewed)
        pending_review = db.query(func.count(models.InspectionResult.id)).filter(
            models.InspectionResult.model_id == m.id,
            models.InspectionResult.verdict == "Uncertain",
            models.InspectionResult.review_verdict.is_(None),
        ).scalar() or 0
        
        if new_validated > 0 or pending_review > 0:
            stats.append({
                "model_id": m.id,
                "model_name": m.name,
                "model_version": m.version,
                "dataset_id": dataset.id,
                "dataset_name": dataset.name,
                "new_validated_images": new_validated,
                "pending_review": pending_review,
            })
    
    return stats


@router.get("/export")
def export_results(
    verdict: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    model_id: Optional[str] = None,
    min_conf: Optional[float] = None,
    max_conf: Optional[float] = None,
    search_id: Optional[str] = None,
    review_status: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    query = db.query(models.InspectionResult)
    if verdict:
        query = query.filter(models.InspectionResult.verdict == verdict)
    if model_id:
        query = query.filter(models.InspectionResult.model_id == model_id)
    if min_conf is not None:
        query = query.filter(models.InspectionResult.confidence >= min_conf)
    if max_conf is not None:
        query = query.filter(models.InspectionResult.confidence <= max_conf)
    if search_id:
        query = query.filter(models.InspectionResult.id.ilike(f"%{search_id}%"))
    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            query = query.filter(models.InspectionResult.created_at >= start_dt)
        except ValueError:
            pass
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            query = query.filter(models.InspectionResult.created_at <= end_dt)
        except ValueError:
            pass
    if review_status == "pending":
        query = query.filter(
            models.InspectionResult.verdict == "Uncertain",
            models.InspectionResult.review_verdict.is_(None),
        )
    elif review_status == "reviewed":
        query = query.filter(models.InspectionResult.review_verdict.isnot(None))
    
    results = query.order_by(models.InspectionResult.created_at.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Model ID", "AI Verdict", "Confidence", "Timestamp",
        "Review Verdict", "Review Notes", "Reviewed By", "Reviewed At", "Exported to Dataset",
    ])
    for r in results:
        writer.writerow([
            r.id,
            r.model_id,
            r.verdict,
            f"{r.confidence:.4f}",
            r.created_at.isoformat() if r.created_at else "",
            r.review_verdict or "",
            r.review_notes or "",
            r.reviewed_by or "",
            r.reviewed_at.isoformat() if r.reviewed_at else "",
            "Yes" if r.exported_to_dataset else "No",
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=inspection_results.csv"},
    )


@router.delete("/{result_id}")
def delete_result(
    result_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    result = db.query(models.InspectionResult).filter(models.InspectionResult.id == result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Inspection result not found")
    
    db.delete(result)
    db.commit()
    
    return {"status": "success"}
