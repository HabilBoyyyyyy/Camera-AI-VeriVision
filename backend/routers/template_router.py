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


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    model_id: Optional[str] = None
    threshold: Optional[float] = None
    integration_ids: Optional[list] = None
    line_name: Optional[str] = None


# ── Helpers ────────────────────────────────────────────
def _serialize(t: models.InspectionTemplate, db: Session) -> dict:
    integration_ids = json.loads(t.integration_ids_json) if t.integration_ids_json else []

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
