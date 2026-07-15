from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class TaskType(str, Enum):
    classification = "classification"
    detection = "detection"


class Architecture(str, Enum):
    resnet50 = "resnet50"
    efficientnet_b0 = "efficientnet_b0"
    yolov8n = "yolov8n"
    yolov8s = "yolov8s"


class AugmentationConfig(BaseModel):
    horizontal_flip: bool = True
    rotation_degrees: float = 10.0
    brightness_jitter: float = 0.2
    random_crop: bool = False


class TrainConfigRequest(BaseModel):
    dataset_id: str
    model_name: str
    task_type: TaskType
    architecture: Architecture
    epochs: int = Field(default=50, ge=1, le=1000)
    batch_size: int = Field(default=16, ge=1, le=512)
    image_size: int = Field(default=224, ge=32, le=1280)
    learning_rate: float = Field(default=1e-3, gt=0, le=1.0)
    optimizer: str = Field(default="adam", pattern="^(adam|sgd|adamw)$")
    pretrained: bool = True
    early_stopping_patience: Optional[int] = 10
    augmentation: AugmentationConfig = AugmentationConfig()
    update_existing: bool = False
    existing_model_id: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    username: str
    role: str


class DatasetResponse(BaseModel):
    id: str
    name: str
    task_type: str
    num_images: int
    classes: Optional[List[str]] = None
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ModelResponse(BaseModel):
    id: str
    name: str
    version: int
    task_type: str
    architecture: str
    status: str
    metrics: Optional[Dict[str, Any]] = None
    config: Optional[Dict[str, Any]] = None
    weights_path: Optional[str] = None
    dataset_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TrainingStatusResponse(BaseModel):
    job_id: str
    model_id: str
    status: str
    progress: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class InspectionResultResponse(BaseModel):
    id: str
    model_id: str
    verdict: str
    confidence: float
    image_path: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DashboardSummary(BaseModel):
    total_datasets: int
    trained_models: int
    inspections_today: int
    recent_inspections: List[Dict[str, Any]] = []
