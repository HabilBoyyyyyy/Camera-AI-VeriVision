"""
Integration dispatch service.
Called after every inspection to fire webhooks and MQTT messages
based on the user's configured integrations.
"""
import json
import asyncio
import threading
from datetime import datetime
from typing import Optional, List
from collections import deque

from sqlalchemy.orm import Session
import models

# ── In-memory event bus for SSE streaming ──────────────────────
# Stores the last 100 events so new SSE connections can catch up
_event_log: deque = deque(maxlen=100)
_event_listeners: List[asyncio.Queue] = []


def _broadcast_event(event: dict):
    """Push an event to all connected SSE listeners and the in-memory log."""
    event["timestamp"] = datetime.utcnow().isoformat()
    _event_log.append(event)
    # Copy the list to avoid mutation during iteration
    for q in list(_event_listeners):
        try:
            q.put_nowait(event)
        except Exception:
            pass


def get_event_log() -> list:
    return list(_event_log)


def subscribe() -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue()
    _event_listeners.append(q)
    return q


def unsubscribe(q: asyncio.Queue):
    if q in _event_listeners:
        _event_listeners.remove(q)


# ── Webhook dispatcher ─────────────────────────────────────────
def _fire_webhook(url: str, payload: dict, timeout: float = 5.0) -> dict:
    """Send an HTTP POST to the webhook URL. Returns status info."""
    try:
        import httpx
        with httpx.Client(timeout=timeout) as client:
            resp = client.post(url, json=payload)
            return {
                "success": True,
                "status_code": resp.status_code,
                "response": resp.text[:500],
            }
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── MQTT dispatcher ────────────────────────────────────────────
def _fire_mqtt(broker: str, port: int, topic: str, payload: dict) -> dict:
    """Publish an MQTT message. Returns status info."""
    try:
        import paho.mqtt.client as mqtt_client
        client = mqtt_client.Client(mqtt_client.CallbackAPIVersion.VERSION2)
        client.connect(broker, port, keepalive=10)
        message = json.dumps(payload)
        info = client.publish(topic, message, qos=1)
        info.wait_for_publish(timeout=5)
        client.disconnect()
        return {"success": True, "topic": topic, "message": message[:500]}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── Main dispatch function ─────────────────────────────────────
def dispatch_integrations(
    inspection_id: str,
    verdict: str,
    confidence: float,
    model_id: str,
    image_path: str,
    db: Session,
):
    """
    Look up all active integrations that match the verdict and model,
    then fire them in a background thread so we don't block the request.
    """
    integrations = db.query(models.Integration).filter(
        models.Integration.is_active == True,
    ).all()

    matching = []
    for intg in integrations:
        # Check trigger condition
        if intg.trigger_on != "any" and intg.trigger_on != verdict:
            continue
        # Check model scope (None = all models)
        if intg.model_id and intg.model_id != model_id:
            continue
        matching.append({
            "id": intg.id,
            "name": intg.name,
            "type": intg.type,
            "config": json.loads(intg.config_json) if intg.config_json else {},
        })

    if not matching:
        return

    payload = {
        "event": "inspection_result",
        "inspection_id": inspection_id,
        "verdict": verdict,
        "confidence": round(confidence, 4),
        "model_id": model_id,
        "image_path": image_path,
        "timestamp": datetime.utcnow().isoformat(),
    }

    # Fire in a background thread so the inspection response is instant
    thread = threading.Thread(
        target=_dispatch_worker,
        args=(matching, payload, db),
        daemon=True,
    )
    thread.start()


def _dispatch_worker(matching: list, payload: dict, db: Session):
    """Worker that runs in a background thread to fire each integration."""
    from database import SessionLocal
    local_db = SessionLocal()

    try:
        for intg in matching:
            result = {}
            if intg["type"] == "webhook":
                url = intg["config"].get("url", "")
                result = _fire_webhook(url, payload)
            elif intg["type"] == "mqtt":
                broker = intg["config"].get("broker", "localhost")
                port = int(intg["config"].get("port", 1883))
                topic = intg["config"].get("topic", "verivision/inspection")
                result = _fire_mqtt(broker, port, topic, payload)

            status = "success" if result.get("success") else "failed"

            # Save log entry
            log = models.IntegrationLog(
                integration_id=intg["id"],
                inspection_id=payload.get("inspection_id"),
                verdict=payload.get("verdict"),
                status=status,
                response_text=json.dumps(result)[:1000],
            )
            local_db.add(log)
            local_db.commit()

            # Broadcast to SSE listeners
            _broadcast_event({
                "integration_name": intg["name"],
                "integration_type": intg["type"],
                "inspection_id": payload.get("inspection_id"),
                "verdict": payload.get("verdict"),
                "confidence": payload.get("confidence"),
                "status": status,
                "detail": result.get("response", result.get("error", "")),
            })
    except Exception as e:
        print(f"[INTEGRATION] Dispatch error: {e}")
    finally:
        local_db.close()


def fire_test(integration_id: str, db: Session) -> dict:
    """Fire a test event for a specific integration."""
    intg = db.query(models.Integration).filter(
        models.Integration.id == integration_id
    ).first()
    if not intg:
        return {"success": False, "error": "Integration not found"}

    config = json.loads(intg.config_json) if intg.config_json else {}
    test_payload = {
        "event": "test",
        "integration_id": integration_id,
        "integration_name": intg.name,
        "verdict": "NG",
        "confidence": 0.95,
        "message": "This is a test trigger from VeriVision.",
        "timestamp": datetime.utcnow().isoformat(),
    }

    if intg.type == "webhook":
        result = _fire_webhook(config.get("url", ""), test_payload)
    elif intg.type == "mqtt":
        result = _fire_mqtt(
            config.get("broker", "localhost"),
            int(config.get("port", 1883)),
            config.get("topic", "verivision/test"),
            test_payload,
        )
    else:
        result = {"success": False, "error": f"Unknown type: {intg.type}"}

    status = "success" if result.get("success") else "failed"

    # Save log
    log = models.IntegrationLog(
        integration_id=intg.id,
        inspection_id=None,
        verdict="TEST",
        status=status,
        response_text=json.dumps(result)[:1000],
    )
    db.add(log)
    db.commit()

    # Broadcast
    _broadcast_event({
        "integration_name": intg.name,
        "integration_type": intg.type,
        "inspection_id": "TEST",
        "verdict": "TEST",
        "confidence": 0.95,
        "status": status,
        "detail": result.get("response", result.get("error", "")),
    })

    return {"status": status, **result}
