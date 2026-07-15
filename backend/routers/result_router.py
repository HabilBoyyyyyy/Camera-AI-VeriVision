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
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    query = db.query(models.InspectionResult)
    if verdict:
        query = query.filter(models.InspectionResult.verdict == verdict)
    
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
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    query = db.query(models.InspectionResult)
    if verdict:
        query = query.filter(models.InspectionResult.verdict == verdict)
    
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
