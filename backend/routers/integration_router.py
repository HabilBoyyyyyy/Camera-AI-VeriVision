"""
Integration router — CRUD for webhook/MQTT integrations,
test-fire endpoint, SSE event stream, and event log.
"""
import json
import asyncio
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
import models
from auth import get_current_user
from services.integration_service import (
    fire_test,
    get_event_log,
    subscribe,
    unsubscribe,
)

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


# ── Schemas ────────────────────────────────────────────────────
class IntegrationCreate(BaseModel):
    name: str
    type: str  # "webhook" or "mqtt"
    trigger_on: str = "NG"  # "NG", "OK", "Uncertain", "any"
    model_id: Optional[str] = None
    is_active: bool = True
    config: dict  # {url} for webhook; {broker, port, topic} for mqtt


class IntegrationUpdate(BaseModel):
    name: Optional[str] = None
    trigger_on: Optional[str] = None
    model_id: Optional[str] = None
    is_active: Optional[bool] = None
    config: Optional[dict] = None


# ── Helpers ────────────────────────────────────────────────────
def _serialize(intg: models.Integration) -> dict:
    return {
        "id": intg.id,
        "name": intg.name,
        "type": intg.type,
        "trigger_on": intg.trigger_on,
        "model_id": intg.model_id,
        "is_active": intg.is_active,
        "config": json.loads(intg.config_json) if intg.config_json else {},
        "created_at": intg.created_at.isoformat() if intg.created_at else None,
        "updated_at": intg.updated_at.isoformat() if intg.updated_at else None,
    }


# ── CRUD ───────────────────────────────────────────────────────
@router.get("/")
def list_integrations(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    items = db.query(models.Integration).order_by(
        models.Integration.created_at.desc()
    ).all()
    return [_serialize(i) for i in items]


@router.post("/")
def create_integration(
    body: IntegrationCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create integrations")
    if body.type not in ("webhook", "mqtt"):
        raise HTTPException(status_code=400, detail="type must be 'webhook' or 'mqtt'")

    intg = models.Integration(
        name=body.name,
        type=body.type,
        trigger_on=body.trigger_on,
        model_id=body.model_id or None,
        is_active=body.is_active,
        config_json=json.dumps(body.config),
    )
    db.add(intg)
    db.commit()
    db.refresh(intg)
    return _serialize(intg)


@router.put("/{integration_id}")
def update_integration(
    integration_id: str,
    body: IntegrationUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update integrations")

    intg = db.query(models.Integration).filter(
        models.Integration.id == integration_id
    ).first()
    if not intg:
        raise HTTPException(status_code=404, detail="Integration not found")

    if body.name is not None:
        intg.name = body.name
    if body.trigger_on is not None:
        intg.trigger_on = body.trigger_on
    if body.model_id is not None:
        intg.model_id = body.model_id or None
    if body.is_active is not None:
        intg.is_active = body.is_active
    if body.config is not None:
        intg.config_json = json.dumps(body.config)

    intg.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(intg)
    return _serialize(intg)


@router.delete("/{integration_id}")
def delete_integration(
    integration_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete integrations")

    intg = db.query(models.Integration).filter(
        models.Integration.id == integration_id
    ).first()
    if not intg:
        raise HTTPException(status_code=404, detail="Integration not found")

    # Also delete associated logs
    db.query(models.IntegrationLog).filter(
        models.IntegrationLog.integration_id == integration_id
    ).delete()

    db.delete(intg)
    db.commit()
    return {"status": "ok", "message": f"Integration '{intg.name}' deleted"}


# ── Test Fire ──────────────────────────────────────────────────
@router.post("/{integration_id}/test")
def test_integration(
    integration_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    result = fire_test(integration_id, db)
    return result


# ── Event Log (history) ───────────────────────────────────────
@router.get("/logs")
def get_logs(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    logs = db.query(models.IntegrationLog).order_by(
        models.IntegrationLog.created_at.desc()
    ).limit(limit).all()
    return [
        {
            "id": log.id,
            "integration_id": log.integration_id,
            "integration_name": log.integration.name if log.integration else "Unknown",
            "inspection_id": log.inspection_id,
            "verdict": log.verdict,
            "status": log.status,
            "response_text": log.response_text,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]


# ── SSE Event Stream ──────────────────────────────────────────
@router.get("/events")
async def event_stream(user: models.User = Depends(get_current_user)):
    """Server-Sent Events stream for real-time integration trigger logs."""
    queue = subscribe()

    async def generate():
        try:
            # Send recent history first
            for evt in get_event_log()[-10:]:
                yield f"data: {json.dumps(evt)}\n\n"

            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    # Send keepalive
                    yield ": keepalive\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            unsubscribe(queue)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
