"""
Camera AI — Template Schema (Pydantic Models)
==============================================
Defines the exact shape of a valid inspection template.
Bad data gets rejected automatically with a clear error message.

Usage:
    from schemas.template_schema import TemplateCreate, TemplateResponse
    
    # Validate incoming JSON from the API
    template = TemplateCreate(**request_body)
    
    # FastAPI does this automatically when used as a type hint:
    @router.post("/templates")
    async def create_template(template: TemplateCreate):
        ...
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


# ──────────────────────────────────────────────
# Preprocessing Step Models
# ──────────────────────────────────────────────

class ResizeParams(BaseModel):
    width: int = Field(..., ge=1, description="Target width in pixels")
    height: int = Field(..., ge=1, description="Target height in pixels")


class CropParams(BaseModel):
    x: int = Field(..., ge=0, description="Crop start X coordinate")
    y: int = Field(..., ge=0, description="Crop start Y coordinate")
    width: int = Field(..., ge=1, description="Crop region width")
    height: int = Field(..., ge=1, description="Crop region height")


class NormalizeParams(BaseModel):
    mean: list[float] = Field(..., min_length=3, max_length=3, description="Channel-wise mean [R, G, B]")
    std: list[float] = Field(..., min_length=3, max_length=3, description="Channel-wise std [R, G, B]")


class PreprocessingStep(BaseModel):
    """A single preprocessing operation. The backend loops through these generically."""
    step_type: Literal["resize", "crop", "normalize"] = Field(
        ..., description="Type of preprocessing operation"
    )
    params: dict = Field(
        ..., description="Parameters specific to the step type (resize: width/height, crop: x/y/width/height, normalize: mean/std)"
    )


# ──────────────────────────────────────────────
# Input Source
# ──────────────────────────────────────────────

class InputSource(BaseModel):
    type: Literal["webcam", "image_upload"] = Field(
        ..., description="webcam = live camera; image_upload = file upload"
    )
    device_id: Optional[int] = Field(
        default=0, ge=0, description="Camera index. Only used when type = webcam"
    )


# ──────────────────────────────────────────────
# Inspection Step (AI Inference)
# ──────────────────────────────────────────────

class InspectionStep(BaseModel):
    """Which AI model to run and at what confidence level."""
    step_type: Literal["classification"] = Field(
        default="classification",
        description="AI task type. Currently only 'classification'. Extensible to 'detection', 'segmentation'."
    )
    model_id: str = Field(
        ..., description="References a trained model file in ai_models/ directory"
    )
    confidence_threshold: float = Field(
        ..., ge=0.0, le=1.0, description="Minimum confidence to consider prediction valid"
    )


# ──────────────────────────────────────────────
# Decision Rule
# ──────────────────────────────────────────────

class DecisionRule(BaseModel):
    """
    Converts AI confidence into a business pass/fail decision.
    Separates AI output from business logic — different customers 
    can use different thresholds without retraining the model.
    """
    pass_label: str = Field(default="OK", description="Label when part passes")
    fail_label: str = Field(default="NG", description="Label when part fails")
    min_confidence_to_pass: float = Field(
        ..., ge=0.0, le=1.0,
        description="If confidence >= this value → pass. Otherwise → fail."
    )


# ──────────────────────────────────────────────
# Output Actions
# ──────────────────────────────────────────────

class OutputAction(BaseModel):
    """An action executed after the inspection decision is made."""
    action_type: Literal["save_result", "log_event", "trigger_alert"] = Field(
        ..., description="Type of output action"
    )
    params: dict = Field(
        default_factory=dict,
        description="Action-specific params (save_result: store_image; log_event: log_level; trigger_alert: on)"
    )


# ──────────────────────────────────────────────
# Complete Template Models
# ──────────────────────────────────────────────

class TemplateCreate(BaseModel):
    """Schema for creating a new inspection template (POST /templates)."""
    template_name: str = Field(..., min_length=3, max_length=100, description="Human-readable name")
    description: str = Field(default="", max_length=500, description="What this inspection checks")
    input_source: InputSource
    preprocessing_steps: list[PreprocessingStep] = Field(default_factory=list)
    inspection_step: InspectionStep
    decision_rule: DecisionRule
    output_actions: list[OutputAction] = Field(default_factory=list)


class TemplateResponse(BaseModel):
    """Schema for template responses (GET /templates, GET /templates/{id})."""
    template_id: str = Field(..., description="Auto-generated unique ID")
    template_name: str
    description: str
    input_source: InputSource
    preprocessing_steps: list[PreprocessingStep]
    inspection_step: InspectionStep
    decision_rule: DecisionRule
    output_actions: list[OutputAction]
    created_at: datetime = Field(default_factory=datetime.utcnow)
    status: Literal["active", "draft"] = Field(default="draft")

    class Config:
        from_attributes = True  # Allows creating from ORM objects


# ──────────────────────────────────────────────
# Inspection Result Models
# ──────────────────────────────────────────────

class InspectionResultResponse(BaseModel):
    """Schema for inspection run results."""
    result_id: str
    template_id: str
    template_name: str
    timestamp: datetime
    verdict: Literal["OK", "NG"]
    confidence: float = Field(..., ge=0.0, le=1.0)
    duration_ms: int = Field(..., ge=0)
    image_path: Optional[str] = None

    class Config:
        from_attributes = True
