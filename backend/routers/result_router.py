from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import csv
import io
from typing import Optional

from database import get_db
import models
from auth import get_current_user

router = APIRouter(prefix="/api/results", tags=["results"])


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
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    from datetime import datetime
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
        })
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
    }


@router.get("/export")
def export_results(
    verdict: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    model_id: Optional[str] = None,
    min_conf: Optional[float] = None,
    max_conf: Optional[float] = None,
    search_id: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    from datetime import datetime
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
    
    results = query.order_by(models.InspectionResult.created_at.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Model ID", "Verdict", "Confidence", "Timestamp"])
    for r in results:
        writer.writerow([
            r.id,
            r.model_id,
            r.verdict,
            f"{r.confidence:.4f}",
            r.created_at.isoformat() if r.created_at else "",
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
