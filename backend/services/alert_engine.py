"""
Alert Engine — Background anomaly detection for VeriVision.

Scans production data for anomalies and creates persistent Alert records
in the database. Deduplicates alerts to avoid spam.
"""

from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
import json

import models

# ── Thresholds (tunable) ──────────────────────────────────────────────────────
BURST_WINDOW = 20           # last N inspections to check
BURST_NG_RATIO = 0.40       # >40% NG in window = Critical alert
DRIFT_DROP_THRESHOLD = 0.08 # 8% confidence drop vs 7-day average = Warning
UNCERTAINTY_MIN = 3         # >3 uncertain results in last 24h = Info alert
YIELD_WARN = 0.80           # <80% yield = bad shift


def _alert_on_cooldown(db: Session, alert_type: str, related_model_id: str = None) -> bool:
    """Check if an alert of this type was created recently (within 4 hours), to avoid spam."""
    cooldown_start = datetime.utcnow() - timedelta(hours=4)
    q = db.query(models.Alert).filter(
        models.Alert.alert_type == alert_type,
        models.Alert.created_at >= cooldown_start,
    )
    if related_model_id:
        q = q.filter(models.Alert.related_model_id == related_model_id)
    return q.first() is not None


def _create_alert(db: Session, **kwargs) -> models.Alert:
    """Create and persist a new alert."""
    alert = models.Alert(**kwargs)
    db.add(alert)
    return alert


def run_alert_scan(db: Session) -> dict:
    """
    Scan for anomalies and create/update alerts in the database.

    Returns a dict with scan results for logging.
    """
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    seven_days_ago = today_start - timedelta(days=7)
    yesterday = now - timedelta(hours=24)

    created_alerts = []
    drift_models = []

    # ── 1. Burst Defect Detection (Critical) ──────────────────────────────────
    if not _alert_on_cooldown(db, "burst_defect"):
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
                alert = _create_alert(
                    db,
                    alert_type="burst_defect",
                    severity="critical",
                    title="Burst Defect Spike Detected",
                    message=(
                        f"{pct}% of the last {len(recent_inspections)} inspections failed (NG). "
                        "This indicates a sudden quality problem on the production line. "
                        "Check the assembly equipment upstream immediately."
                    ),
                    icon="local_fire_department",
                    action_label="View Defects",
                    action_url="/results?verdict=NG",
                    expires_at=now + timedelta(hours=8),
                )
                created_alerts.append(alert)

    # ── 2. Data Drift / Model Confidence Degradation (Warning) ────────────────
    trained_models = (
        db.query(models.TrainedModel)
        .filter(models.TrainedModel.status == "trained")
        .all()
    )

    for m in trained_models:
        if _alert_on_cooldown(db, "drift", m.id):
            continue

        historical = (
            db.query(func.avg(models.InspectionResult.confidence))
            .filter(
                models.InspectionResult.model_id == m.id,
                models.InspectionResult.created_at >= seven_days_ago,
                models.InspectionResult.created_at < today_start,
            )
            .scalar()
        )

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

                alert = _create_alert(
                    db,
                    alert_type="drift",
                    severity="warning",
                    title=f"Model Accuracy Degrading: {m.name}",
                    message=(
                        f"Model '{m.name} v{m.version}' average confidence has dropped "
                        f"{drop_pct}% (from {historical_pct}% historically to {today_pct}% today). "
                        "This may indicate changes in lighting, camera angle, or production materials. "
                        "Capture new images and retrain to restore accuracy."
                    ),
                    icon="trending_down",
                    action_label="Go to Training",
                    action_url="/ai-studio?tab=training",
                    related_model_id=m.id,
                    expires_at=now + timedelta(hours=12),
                )
                created_alerts.append(alert)
                drift_models.append({
                    "name": m.name,
                    "historical_avg": historical_pct,
                    "today_avg": today_pct,
                    "drop_pct": drop_pct,
                })

    # ── 3. Uncertainty Triage — Active Learning (Info) ────────────────────────
    if not _alert_on_cooldown(db, "uncertainty_triage"):
        uncertain_count = (
            db.query(models.InspectionResult)
            .filter(
                models.InspectionResult.verdict == "Uncertain",
                models.InspectionResult.created_at >= yesterday,
            )
            .count()
        )

        if uncertain_count >= UNCERTAINTY_MIN:
            alert = _create_alert(
                db,
                alert_type="uncertainty_triage",
                severity="info",
                title=f"Needs Review: {uncertain_count} Uncertain Inspections",
                message=(
                    f"The AI was unsure about {uncertain_count} part(s) in the last 24 hours. "
                    "Reviewing and labeling these uncertain cases will improve your model's "
                    "accuracy for future inspections."
                ),
                icon="help_circle",
                action_label="Review Uncertain Parts",
                action_url="/results?verdict=Uncertain",
                expires_at=now + timedelta(hours=24),
            )
            created_alerts.append(alert)

    # ── 4. Low Yield Rate Warning ─────────────────────────────────────────────
    if not _alert_on_cooldown(db, "low_yield"):
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
                alert = _create_alert(
                    db,
                    alert_type="low_yield",
                    severity="warning",
                    title=f"Low Yield Rate: {pct}% Today",
                    message=(
                        f"Today's production yield rate is only {pct}%, which is below "
                        f"the {round(YIELD_WARN*100)}% warning threshold. "
                        f"{today_ng} out of {total_today} inspected parts have failed. "
                        "Review recent defect images to identify the root cause."
                    ),
                    icon="trending_down",
                    action_label="View NG Parts",
                    action_url="/results?verdict=NG",
                    expires_at=now + timedelta(hours=8),
                )
                created_alerts.append(alert)

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
        if _alert_on_cooldown(db, "training_done", job.model_id):
            continue
        model_obj = db.query(models.TrainedModel).filter(
            models.TrainedModel.id == job.model_id
        ).first()
        if model_obj:
            alert = _create_alert(
                db,
                alert_type="training_done",
                severity="info",
                title=f"Model Training Completed: {model_obj.name}",
                message=(
                    f"Model '{model_obj.name} v{model_obj.version}' has finished training "
                    "successfully. Review its evaluation metrics and deploy it for live inspection."
                ),
                icon="check_circle",
                action_label="View Model",
                action_url="/ai-studio?tab=models",
                related_model_id=model_obj.id,
                expires_at=now + timedelta(hours=48),
            )
            created_alerts.append(alert)

    # ── Commit ────────────────────────────────────────────────────────────────
    if created_alerts:
        db.commit()
        print(f"[Alert Engine] Created {len(created_alerts)} new alert(s)")

    # ── Collect stats for AI Analyst ──────────────────────────────────────────
    today_results_2 = (
        db.query(
            models.InspectionResult.verdict,
            func.count(models.InspectionResult.id).label("count")
        )
        .filter(models.InspectionResult.created_at >= today_start)
        .group_by(models.InspectionResult.verdict)
        .all()
    )
    verdict_map_2 = {row.verdict: row.count for row in today_results_2}

    stats = {
        "total_today": sum(verdict_map_2.values()),
        "ok": verdict_map_2.get("OK", 0),
        "ng": verdict_map_2.get("NG", 0),
        "uncertain": verdict_map_2.get("Uncertain", 0),
        "drift_models": drift_models,
        "active_alerts": [
            {"severity": a.severity, "title": a.title}
            for a in created_alerts
        ],
    }

    return {
        "created_count": len(created_alerts),
        "stats": stats,
    }
