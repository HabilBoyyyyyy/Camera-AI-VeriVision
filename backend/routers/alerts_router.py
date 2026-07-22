"""
Alerts Router — Persistent, AI-driven alert system for VeriVision.

Alerts are now stored in the database. The alert engine scans for anomalies
on each request (lazy scan), and an AI analyst generates shift insights
via a local LLM (Ollama) with heuristic fallback.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

from database import get_db
import models
from auth import get_current_user

from services.alert_engine import run_alert_scan
from services.ai_analyst import generate_ai_insight

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("/")
async def get_alerts(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """
    Get all active alerts. Runs the alert engine scan first (lazy detection),
    then returns persistent alerts from the database + an AI-generated summary.
    """
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # ── Step 1: Run the alert engine to detect new anomalies ──────────────────
    scan_result = run_alert_scan(db)
    stats = scan_result["stats"]

    # ── Step 2: Expire old alerts ─────────────────────────────────────────────
    db.query(models.Alert).filter(
        models.Alert.expires_at != None,
        models.Alert.expires_at < now,
        models.Alert.is_acknowledged == False,
    ).update({"is_acknowledged": True, "acknowledged_by": "system_expiry"}, synchronize_session=False)
    db.commit()

    # ── Step 3: Fetch active (non-acknowledged) alerts ────────────────────────
    active_alerts = (
        db.query(models.Alert)
        .filter(models.Alert.is_acknowledged == False)
        .order_by(
            # Critical first, then warning, then info
            models.Alert.severity.desc(),
            models.Alert.created_at.desc(),
        )
        .all()
    )

    # Sort by severity manually since SQLite doesn't sort enums well
    severity_order = {"critical": 0, "warning": 1, "info": 2}
    active_alerts.sort(key=lambda a: (severity_order.get(a.severity, 9), -a.created_at.timestamp()))

    alerts_list = []
    for a in active_alerts:
        alert_dict = {
            "id": a.id,
            "alert_type": a.alert_type,
            "severity": a.severity,
            "title": a.title,
            "message": a.message,
            "icon": a.icon,
            "action_label": a.action_label,
            "action_url": a.action_url,
            "created_at": a.created_at.isoformat(),
            "is_acknowledged": a.is_acknowledged,
        }

        # Only show action buttons to admins for certain alert types
        if user.role != "admin" and a.alert_type in ("drift", "training_done"):
            alert_dict.pop("action_label", None)
            alert_dict.pop("action_url", None)

        alerts_list.append(alert_dict)

    # ── Step 4: Generate AI summary ───────────────────────────────────────────
    # Add active alert info to stats for the AI analyst
    stats["active_alerts"] = [
        {"severity": a.severity, "title": a.title} for a in active_alerts[:5]
    ]

    ai_result = await generate_ai_insight(stats)

    # ── Step 5: Compute today's yield for dashboard ───────────────────────────
    today_ok = stats.get("ok", 0)
    today_ng = stats.get("ng", 0)
    today_uncertain = stats.get("uncertain", 0)
    total_today = stats.get("total_today", 0)

    return {
        "summary": ai_result["insight"],
        "summary_source": ai_result["source"],
        "summary_model": ai_result["model"],
        "alerts": alerts_list,
        "total_today": total_today,
        "today_yield": {"OK": today_ok, "NG": today_ng, "Uncertain": today_uncertain},
        "generated_at": now.isoformat(),
    }


@router.get("/recent")
async def get_recent_alerts(
    limit: int = 10,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Get the most recent alerts (including acknowledged ones)."""
    alerts = (
        db.query(models.Alert)
        .order_by(models.Alert.created_at.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": a.id,
            "alert_type": a.alert_type,
            "severity": a.severity,
            "title": a.title,
            "message": a.message,
            "icon": a.icon,
            "action_label": a.action_label,
            "action_url": a.action_url,
            "created_at": a.created_at.isoformat(),
            "is_acknowledged": a.is_acknowledged,
            "acknowledged_by": a.acknowledged_by,
            "acknowledged_at": a.acknowledged_at.isoformat() if a.acknowledged_at else None,
        }
        for a in alerts
    ]


@router.put("/{alert_id}/acknowledge")
def acknowledge_alert(
    alert_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Acknowledge (dismiss) an alert. It won't appear in the active list anymore."""
    alert = db.query(models.Alert).filter(models.Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.is_acknowledged = True
    alert.acknowledged_by = user.username
    alert.acknowledged_at = datetime.utcnow()
    db.commit()

    return {"status": "acknowledged", "id": alert_id}


@router.put("/acknowledge-all")
def acknowledge_all_alerts(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Acknowledge all active alerts at once."""
    now = datetime.utcnow()
    count = (
        db.query(models.Alert)
        .filter(models.Alert.is_acknowledged == False)
        .update(
            {
                "is_acknowledged": True,
                "acknowledged_by": user.username,
                "acknowledged_at": now,
            },
            synchronize_session=False,
        )
    )
    db.commit()
    return {"status": "acknowledged_all", "count": count}


@router.post("/generate-insight")
async def generate_insight_on_demand(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    Manually trigger an AI insight generation.
    Useful for the 'Refresh Insight' button on the dashboard.
    """
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Gather stats
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

    # Get active alerts
    active_alerts = (
        db.query(models.Alert)
        .filter(models.Alert.is_acknowledged == False)
        .all()
    )

    stats = {
        "total_today": sum(verdict_map.values()),
        "ok": verdict_map.get("OK", 0),
        "ng": verdict_map.get("NG", 0),
        "uncertain": verdict_map.get("Uncertain", 0),
        "drift_models": [],
        "active_alerts": [
            {"severity": a.severity, "title": a.title}
            for a in active_alerts[:5]
        ],
    }

    result = await generate_ai_insight(stats)

    # If AI generated a meaningful insight, save it as an alert too
    if result["source"] == "ollama":
        _save_ai_insight_alert(db, result["insight"], result["model"])

    return result


def _save_ai_insight_alert(db: Session, insight: str, model_name: str):
    """Save an AI-generated insight as an alert record for history."""
    # Don't duplicate — only one AI insight per hour
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    existing = (
        db.query(models.Alert)
        .filter(
            models.Alert.alert_type == "ai_insight",
            models.Alert.created_at >= one_hour_ago,
        )
        .first()
    )
    if existing:
        return

    alert = models.Alert(
        alert_type="ai_insight",
        severity="info",
        title=f"AI Insight ({model_name})",
        message=insight,
        icon="auto_awesome",
        expires_at=datetime.utcnow() + timedelta(hours=4),
    )
    db.add(alert)
    db.commit()
