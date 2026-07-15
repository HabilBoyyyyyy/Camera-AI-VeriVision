from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime
from database import get_db
import models

from auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
def get_summary(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    total_datasets = db.query(models.Dataset).count()
    trained_models = db.query(models.TrainedModel).filter(
        models.TrainedModel.status == "trained"
    ).count()
    
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    inspections_today = db.query(models.InspectionResult).filter(
        models.InspectionResult.created_at >= today_start
    ).count()
    
    recent = db.query(models.InspectionResult).order_by(
        models.InspectionResult.created_at.desc()
    ).limit(6).all()
    
    recent_list = []
    for r in recent:
        recent_list.append({
            "id": r.id,
            "verdict": r.verdict,
            "confidence": r.confidence,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    
    return {
        "total_datasets": total_datasets,
        "trained_models": trained_models,
        "inspections_today": inspections_today,
        "recent_inspections": recent_list,
    }
