from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from database import get_db
import models
import json

from auth import get_current_user

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

# ── Thresholds (tunable) ──────────────────────────────────────────────────────
BURST_WINDOW = 20           # last N inspections to check
BURST_NG_RATIO = 0.40       # >40% NG in window = Critical alert
DRIFT_DROP_THRESHOLD = 0.08 # 8% confidence drop vs 7-day average = Warning
UNCERTAINTY_MIN = 3         # >3 uncertain results in last 24h = Info alert
YIELD_GREAT = 0.95          # >=95% yield = great shift
YIELD_WARN = 0.80           # <80% yield = bad shift


def _build_summary(today_ok: int, today_ng: int, today_uncertain: int,
                   model_alerts: list, total_today: int) -> str:
    """Heuristic natural-language shift summary."""
    now_hour = datetime.utcnow().hour
    if now_hour < 12:
        shift = "Morning shift"
    elif now_hour < 18:
        shift = "Afternoon shift"
    else:
        shift = "Evening shift"

    if total_today == 0:
        return f"{shift} just getting started — no inspections recorded yet today. Systems are online and ready."

    yield_rate = today_ok / total_today if total_today else 1.0
    pct = round(yield_rate * 100, 1)

    # Opening statement
    if yield_rate >= YIELD_GREAT:
        opening = f"{shift} is running excellently with a {pct}% yield rate."
    elif yield_rate >= YIELD_WARN:
        opening = f"{shift} is progressing with a {pct}% yield rate — within acceptable limits but worth monitoring."
    else:
        opening = f"{shift} is under stress with only a {pct}% yield rate. Immediate attention may be required."

    # Defect commentary
    if today_ng == 0:
        defect_note = " No defects have been detected so far."
    elif today_ng == 1:
        defect_note = f" One defective part was detected."
    else:
        defect_note = f" {today_ng} defective parts have been logged."

    # Uncertainty commentary
    if today_uncertain > 0:
        uncertain_note = f" {today_uncertain} uncertain inspection(s) are awaiting human review."
    else:
        uncertain_note = ""

    # Model drift commentary
    if model_alerts:
        model_names = ", ".join(set(a.get("model_name", "Unknown") for a in model_alerts))
        drift_note = f" ⚠️ Confidence drift has been detected on: {model_names}. Consider retraining."
    else:
        drift_note = ""

    return opening + defect_note + uncertain_note + drift_note


@router.get("/")
def get_alerts(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    seven_days_ago = today_start - timedelta(days=7)
    yesterday = now - timedelta(hours=24)

    alerts = []
    model_alerts_for_summary = []

    # ── 1. Burst Defect Detection (Critical) ──────────────────────────────────
    recent_inspections = (
        db.query(models.InspectionResult)
        .order_by(models.InspectionResult.created_at.desc())
        .limit(BURST_WINDOW)
        .all()
    )

    if len(recent_inspections) >= 5:
        ng_count = sum(1 for r in recent_inspections if r.verdict == "NG")
        ng_ratio = ng_count / len(recent_inspections)

        if ng_ratio >= BURST_NG_RATIO:
            pct = round(ng_ratio * 100)
            alerts.append({
                "id": "burst_defect",
                "severity": "critical",
                "title": "Burst Defect Spike Detected",
                "message": (
                    f"{pct}% of the last {len(recent_inspections)} inspections failed (NG). "
                    "This indicates a sudden quality problem on the production line. "
                    "Check the assembly equipment upstream immediately."
                ),
                "action_label": "View Defects",
                "action_url": "/results?verdict=NG",
                "created_at": now.isoformat(),
                "icon": "flame",
            })

    # ── 2. Data Drift / Model Confidence Degradation (Warning) ────────────────
    trained_models = (
        db.query(models.TrainedModel)
        .filter(models.TrainedModel.status == "trained")
        .all()
    )

    for m in trained_models:
        # Historical average (7 days ago to yesterday)
        historical = (
            db.query(func.avg(models.InspectionResult.confidence))
            .filter(
                models.InspectionResult.model_id == m.id,
                models.InspectionResult.created_at >= seven_days_ago,
                models.InspectionResult.created_at < today_start,
            )
            .scalar()
        )

        # Today's average
        today_avg = (
            db.query(func.avg(models.InspectionResult.confidence))
            .filter(
                models.InspectionResult.model_id == m.id,
                models.InspectionResult.created_at >= today_start,
            )
            .scalar()
        )

        if historical and today_avg:
            drop = float(historical) - float(today_avg)
            if drop >= DRIFT_DROP_THRESHOLD:
                drop_pct = round(drop * 100, 1)
                historical_pct = round(float(historical) * 100, 1)
                today_pct = round(float(today_avg) * 100, 1)
                alert_data = {
                    "id": f"drift_{m.id}",
                    "severity": "warning",
                    "title": f"Model Accuracy Degrading: {m.name}",
                    "message": (
                        f"Model '{m.name} v{m.version}' average confidence has dropped "
                        f"{drop_pct}% (from {historical_pct}% historically to {today_pct}% today). "
                        "This may indicate changes in lighting, camera angle, or production materials. "
                        "Capture new images and retrain to restore accuracy."
                    ),
                    "created_at": now.isoformat(),
                    "icon": "trending-down",
                    "model_name": m.name,
                }
                if user.role == "admin":
                    alert_data["action_label"] = "Go to Training"
                    alert_data["action_url"] = "/training"
                alerts.append(alert_data)
                model_alerts_for_summary.append(alert_data)

    # ── 3. Uncertainty Triage — Active Learning (Info) ────────────────────────
    uncertain_count = (
        db.query(models.InspectionResult)
        .filter(
            models.InspectionResult.verdict == "Uncertain",
            models.InspectionResult.created_at >= yesterday,
        )
        .count()
    )

    if uncertain_count >= UNCERTAINTY_MIN:
        alerts.append({
            "id": "uncertainty_triage",
            "severity": "info",
            "title": f"Needs Review: {uncertain_count} Uncertain Inspections",
            "message": (
                f"The AI was unsure about {uncertain_count} part(s) in the last 24 hours. "
                "Reviewing and labeling these uncertain cases will improve your model's accuracy for future inspections."
            ),
            "action_label": "Review Uncertain Parts",
            "action_url": "/results?verdict=Uncertain",
            "created_at": now.isoformat(),
            "icon": "help-circle",
        })

    # ── 4. Low Yield Rate Warning ─────────────────────────────────────────────
    today_results = (
        db.query(
            models.InspectionResult.verdict,
            func.count(models.InspectionResult.id).label("count")
        )
        .filter(models.InspectionResult.created_at >= today_start)
        .group_by(models.InspectionResult.verdict)
        .all()
    )

    verdict_map = {row.verdict: row.count for row in today_results}
    today_ok = verdict_map.get("OK", 0)
    today_ng = verdict_map.get("NG", 0)
    today_uncertain = verdict_map.get("Uncertain", 0)
    total_today = today_ok + today_ng + today_uncertain

    if total_today > 0:
        yield_rate = today_ok / total_today
        if yield_rate < YIELD_WARN:
            pct = round(yield_rate * 100, 1)
            alerts.append({
                "id": "low_yield",
                "severity": "warning",
                "title": f"Low Yield Rate: {pct}% Today",
                "message": (
                    f"Today's production yield rate is only {pct}%, which is below the {round(YIELD_WARN*100)}% warning threshold. "
                    f"{today_ng} out of {total_today} inspected parts have failed. "
                    "Review recent defect images to identify the root cause."
                ),
                "action_label": "View NG Parts",
                "action_url": "/results?verdict=NG",
                "created_at": now.isoformat(),
                "icon": "alert-triangle",
            })

    # ── 5. Training Completed — Info ──────────────────────────────────────────
    recently_trained = (
        db.query(models.TrainingJob)
        .filter(
            models.TrainingJob.status == "completed",
            models.TrainingJob.completed_at >= yesterday,
        )
        .all()
    )

    for job in recently_trained:
        model_obj = db.query(models.TrainedModel).filter(models.TrainedModel.id == job.model_id).first()
        if model_obj:
            alert = {
                "id": f"trained_{job.id}",
                "severity": "info",
                "title": f"Model Training Completed: {model_obj.name}",
                "message": (
                    f"Model '{model_obj.name} v{model_obj.version}' has finished training successfully. "
                    "Review its evaluation metrics and deploy it for live inspection."
                ),
                "created_at": job.completed_at.isoformat() if job.completed_at else now.isoformat(),
                "icon": "check-circle",
            }
            if user.role == "admin":
                alert["action_label"] = "View Model"
                alert["action_url"] = "/models"
            alerts.append(alert)

    # ── Sort: Critical first, then Warning, then Info ─────────────────────────
    severity_order = {"critical": 0, "warning": 1, "info": 2}
    alerts.sort(key=lambda a: severity_order.get(a["severity"], 9))

    # ── AI Shift Summary ──────────────────────────────────────────────────────
    summary = _build_summary(today_ok, today_ng, today_uncertain, model_alerts_for_summary, total_today)

    return {
        "summary": summary,
        "alerts": alerts,
        "total_today": total_today,
        "today_yield": {"OK": today_ok, "NG": today_ng, "Uncertain": today_uncertain},
        "generated_at": now.isoformat(),
    }
