from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from database import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=generate_uuid)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="inspector")  # admin or inspector
    created_at = Column(DateTime, default=datetime.utcnow)

class Dataset(Base):
    __tablename__ = "datasets"
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    task_type = Column(String, nullable=False)  # classification or detection
    folder_path = Column(String, nullable=True)
    num_images = Column(Integer, default=0)
    classes_json = Column(Text, nullable=True)  # JSON string of class names
    status = Column(String, default="ready")  # ready, processing
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    trained_models = relationship("TrainedModel", back_populates="dataset")
    training_jobs = relationship("TrainingJob", back_populates="dataset")

class TrainedModel(Base):
    __tablename__ = "trained_models"
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    dataset_id = Column(String, ForeignKey("datasets.id"), nullable=True)
    version = Column(Integer, default=1)
    task_type = Column(String, nullable=False)  # classification or detection
    architecture = Column(String, nullable=False)
    config_json = Column(Text, nullable=True)  # JSON of training config
    metrics_json = Column(Text, nullable=True)  # JSON of evaluation metrics
    weights_path = Column(String, nullable=True)
    status = Column(String, default="training")  # training, trained, failed
    parent_model_id = Column(String, nullable=True)  # for version tracking
    created_at = Column(DateTime, default=datetime.utcnow)
    dataset = relationship("Dataset", back_populates="trained_models")
    inspection_results = relationship("InspectionResult", back_populates="model")

class TrainingJob(Base):
    __tablename__ = "training_jobs"
    id = Column(String, primary_key=True, default=generate_uuid)
    model_id = Column(String, ForeignKey("trained_models.id"), nullable=False)
    dataset_id = Column(String, ForeignKey("datasets.id"), nullable=False)
    config_json = Column(Text, nullable=True)
    status = Column(String, default="queued")  # queued, training, completed, failed
    progress_json = Column(Text, nullable=True)  # JSON: {epoch, total_epochs, loss, accuracy}
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    model = relationship("TrainedModel")
    dataset = relationship("Dataset", back_populates="training_jobs")

class InspectionResult(Base):
    __tablename__ = "inspection_results"
    id = Column(String, primary_key=True, default=generate_uuid)
    model_id = Column(String, ForeignKey("trained_models.id"), nullable=False)
    image_path = Column(String, nullable=True)
    verdict = Column(String, nullable=False)  # OK, NG, Uncertain
    confidence = Column(Float, nullable=False)
    details_json = Column(Text, nullable=True)  # JSON of per-class predictions
    created_at = Column(DateTime, default=datetime.utcnow)
    # Manual review / validation fields
    review_verdict = Column(String, nullable=True)  # OK or NG (human-validated)
    review_notes = Column(Text, nullable=True)
    reviewed_by = Column(String, nullable=True)  # username of reviewer
    reviewed_at = Column(DateTime, nullable=True)
    exported_to_dataset = Column(Boolean, default=False)  # image exported to training dataset?
    model = relationship("TrainedModel", back_populates="inspection_results")
