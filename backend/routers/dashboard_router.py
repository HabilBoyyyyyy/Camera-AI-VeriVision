from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from database import get_db
import models
import json
import os

from auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
def get_summary(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    # ── Basic counts ──────────────────────────────────────────────────────────
    total_datasets = db.query(models.Dataset).count()
    trained_models_count = db.query(models.TrainedModel).filter(
        models.TrainedModel.status == "trained"
    ).count()

    inspections_today = db.query(models.InspectionResult).filter(
        models.InspectionResult.created_at >= today_start
    ).count()

    # ── Today's yield breakdown ───────────────────────────────────────────────
    today_results = db.query(
        models.InspectionResult.verdict,
        func.count(models.InspectionResult.id).label("count")
    ).filter(
        models.InspectionResult.created_at >= today_start
    ).group_by(models.InspectionResult.verdict).all()

    today_yield = {"OK": 0, "NG": 0, "Uncertain": 0}
    for row in today_results:
        today_yield[row.verdict] = row.count

    # ── Weekly volume (last 7 days, grouped by day + verdict) ─────────────────
    seven_days_ago = today_start - timedelta(days=6)
    weekly_raw = db.query(models.InspectionResult).filter(
        models.InspectionResult.created_at >= seven_days_ago
    ).all()

    # Build a dict: { "Mon": {"OK": 0, "NG": 0, "Uncertain": 0}, ... }
    weekly_map = {}
    for i in range(7):
        day = seven_days_ago + timedelta(days=i)
        label = day.strftime("%a")  # Mon, Tue, etc.
        weekly_map[label] = {"day": label, "OK": 0, "NG": 0, "Uncertain": 0}

    for r in weekly_raw:
        if r.created_at:
            label = r.created_at.strftime("%a")
            if label in weekly_map:
                weekly_map[label][r.verdict] = weekly_map[label].get(r.verdict, 0) + 1

    weekly_volume = list(weekly_map.values())

    # ── Recent NG defect images ───────────────────────────────────────────────
    recent_ng = db.query(models.InspectionResult).filter(
        models.InspectionResult.verdict == "NG"
    ).order_by(models.InspectionResult.created_at.desc()).limit(8).all()

    recent_ng_parts = []
    for r in recent_ng:
        recent_ng_parts.append({
            "id": r.id,
            "confidence": r.confidence,
            "image_path": r.image_path,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    # ── Recent inspections (all verdicts) ─────────────────────────────────────
    recent = db.query(models.InspectionResult).order_by(
        models.InspectionResult.created_at.desc()
    ).limit(6).all()

    recent_list = []
    for r in recent:
        recent_list.append({
            "id": r.id,
            "verdict": r.verdict,
            "confidence": r.confidence,
            "image_path": r.image_path,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    # ── Top models ────────────────────────────────────────────────────────────
    top_models_raw = db.query(models.TrainedModel).filter(
        models.TrainedModel.status == "trained"
    ).order_by(models.TrainedModel.created_at.desc()).limit(4).all()

    top_models = []
    for m in top_models_raw:
        metrics = {}
        if m.metrics_json:
            try:
                metrics = json.loads(m.metrics_json)
            except Exception:
                pass

        # Derive a primary score: for classification use accuracy/top1_acc, for detection use mAP50
        score = None
        for key in ["accuracy", "top1", "top1_acc", "metrics/accuracy_top1", "val/acc1"]:
            if key in metrics:
                score = metrics[key]
                break
        if score is None:
            for key in ["mAP50", "mAP_50", "metrics/mAP50(B)"]:
                if key in metrics:
                    score = metrics[key]
                    break

        # Try extracting from nested epoch history
        if score is None and "epochs_history" in metrics:
            hist = metrics.get("epochs_history", [])
            if hist:
                last = hist[-1]
                for key in ["val_acc", "val_accuracy", "accuracy", "map50"]:
                    if key in last:
                        score = last[key]
                        break

        top_models.append({
            "id": m.id,
            "name": m.name,
            "version": m.version,
            "task_type": m.task_type,
            "architecture": m.architecture,
            "score": round(float(score), 4) if score is not None else None,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        })

    # ── Active training job ───────────────────────────────────────────────────
    active_job = db.query(models.TrainingJob).filter(
        models.TrainingJob.status.in_(["training", "queued"])
    ).order_by(models.TrainingJob.started_at.desc()).first()

    active_training = None
    if active_job:
        active_training = {
            "job_id": active_job.id,
            "model_id": active_job.model_id,
            "status": active_job.status,
        }

    return {
        "total_datasets": total_datasets,
        "trained_models": trained_models_count,
        "inspections_today": inspections_today,
        "today_yield": today_yield,
        "weekly_volume": weekly_volume,
        "recent_ng_parts": recent_ng_parts,
        "recent_inspections": recent_list,
        "top_models": top_models,
        "active_training": active_training,
    }
