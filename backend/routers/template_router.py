"""
Template router — CRUD for inspection templates.
Templates save a combination of model, threshold, line name, and
linked integrations so operators can load a preset in one click.
"""
import json
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
import models
from auth import get_current_user

router = APIRouter(prefix="/api/templates", tags=["templates"])


# ── Schemas ────────────────────────────────────────────
class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    model_id: Optional[str] = None
    threshold: float = 0.7
    integration_ids: list = []
    line_name: Optional[str] = ""
    camera_ids: list = []
    camera_type: Optional[str] = ""
    trigger_type: str = "manual"
    plc_config: Optional[dict] = None


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    model_id: Optional[str] = None
    threshold: Optional[float] = None
    integration_ids: Optional[list] = None
    line_name: Optional[str] = None
    camera_ids: Optional[list] = None
    camera_type: Optional[str] = None
    trigger_type: Optional[str] = None
    plc_config: Optional[dict] = None


# ── Helpers ────────────────────────────────────────────
def _serialize(t: models.InspectionTemplate, db: Session) -> dict:
    integration_ids = json.loads(t.integration_ids_json) if t.integration_ids_json else []
    camera_ids = json.loads(t.camera_ids_json) if t.camera_ids_json else []
    plc_config = json.loads(t.plc_config_json) if t.plc_config_json else None

    # Resolve model name
    model_name = None
    if t.model_id and t.model:
        model_name = f"{t.model.name} v{t.model.version}"

    # Resolve integration names
    integration_names = []
    if integration_ids:
        intgs = db.query(models.Integration).filter(
            models.Integration.id.in_(integration_ids)
        ).all()
        integration_names = [{"id": i.id, "name": i.name, "type": i.type} for i in intgs]

    return {
        "id": t.id,
        "name": t.name,
        "description": t.description,
        "model_id": t.model_id,
        "model_name": model_name,
        "threshold": t.threshold,
        "integration_ids": integration_ids,
        "integrations": integration_names,
        "line_name": t.line_name,
        "camera_ids": camera_ids,
        "camera_type": t.camera_type,
        "trigger_type": t.trigger_type,
        "plc_config": plc_config,
        "created_by": t.created_by,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


# ── CRUD ───────────────────────────────────────────────
@router.get("/")
def list_templates(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    items = db.query(models.InspectionTemplate).order_by(
        models.InspectionTemplate.created_at.desc()
    ).all()
    return [_serialize(t, db) for t in items]


@router.get("/{template_id}")
def get_template(
    template_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    t = db.query(models.InspectionTemplate).filter(
        models.InspectionTemplate.id == template_id
    ).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return _serialize(t, db)


@router.post("/")
def create_template(
    body: TemplateCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create templates")

    t = models.InspectionTemplate(
        name=body.name,
        description=body.description or "",
        model_id=body.model_id or None,
        threshold=body.threshold,
        integration_ids_json=json.dumps(body.integration_ids),
        line_name=body.line_name or "",
        camera_ids_json=json.dumps(body.camera_ids),
        camera_type=body.camera_type,
        trigger_type=body.trigger_type,
        plc_config_json=json.dumps(body.plc_config) if body.plc_config else None,
        created_by=user.username,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return _serialize(t, db)


@router.put("/{template_id}")
def update_template(
    template_id: str,
    body: TemplateUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update templates")

    t = db.query(models.InspectionTemplate).filter(
        models.InspectionTemplate.id == template_id
    ).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")

    if body.name is not None:
        t.name = body.name
    if body.description is not None:
        t.description = body.description
    if body.model_id is not None:
        t.model_id = body.model_id or None
    if body.threshold is not None:
        t.threshold = body.threshold
    if body.integration_ids is not None:
        t.integration_ids_json = json.dumps(body.integration_ids)
    if body.line_name is not None:
        t.line_name = body.line_name
    if body.camera_ids is not None:
        t.camera_ids_json = json.dumps(body.camera_ids)
    if body.camera_type is not None:
        t.camera_type = body.camera_type
    if body.trigger_type is not None:
        t.trigger_type = body.trigger_type
    if body.plc_config is not None:
        t.plc_config_json = json.dumps(body.plc_config)

    t.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(t)
    return _serialize(t, db)


@router.delete("/{template_id}")
def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete templates")

    t = db.query(models.InspectionTemplate).filter(
        models.InspectionTemplate.id == template_id
    ).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")

    db.delete(t)
    db.commit()
    return {"status": "ok", "message": f"Template '{t.name}' deleted"}
