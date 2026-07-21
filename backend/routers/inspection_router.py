from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
import numpy as np
import cv2
import os
import json
from pathlib import Path
from datetime import datetime

from database import get_db
import models
from auth import get_current_user

router = APIRouter(prefix="/api/inspection", tags=["inspection"])

INSPECTION_DIR = Path("data") / "inspections"
INSPECTION_DIR.mkdir(parents=True, exist_ok=True)

# Cache loaded YOLO models
_loaded_models = {}  # model_id -> YOLO model object


def _load_yolo_model(model_record):
    """Load or retrieve cached YOLO model."""
    if model_record.id in _loaded_models:
        return _loaded_models[model_record.id]
    
    if not model_record.weights_path or not os.path.exists(model_record.weights_path):
        raise HTTPException(status_code=400, detail="Model weights not found")
    
    from ultralytics import YOLO
    model = YOLO(model_record.weights_path)
    _loaded_models[model_record.id] = model
    return model


@router.post("/inspect")
async def inspect_image(
    file: UploadFile = File(...),
    model_id: str = Form(...),
    threshold: float = Form(0.7),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Load model record
    model_record = db.query(models.TrainedModel).filter(
        models.TrainedModel.id == model_id,
        models.TrainedModel.status == "trained",
    ).first()
    if not model_record:
        raise HTTPException(status_code=404, detail="Trained model not found")
    
    # Read image
    contents = await file.read()
    print(f"[DEBUG] Received file: {file.filename}, type: {file.content_type}, size: {len(contents)} bytes")
    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if frame is None:
        print(f"[DEBUG] cv2.imdecode failed. nparr size: {len(nparr)}")
        raise HTTPException(status_code=400, detail="Invalid image file")
    
    # Run inference
    yolo_model = _load_yolo_model(model_record)
    results = yolo_model.predict(source=frame, verbose=False)
    
    verdict = "Uncertain"
    confidence = 0.0
    details = {}
    
    if results and len(results) > 0:
        result = results[0]
        
        if model_record.task_type == "classification" and result.probs is not None:
            # Classification result
            class_idx = int(result.probs.top1)
            confidence = float(result.probs.top1conf)
            class_name = result.names.get(class_idx, str(class_idx))
            
            # Build per-class details
            all_probs = result.probs.data.cpu().numpy()
            per_class = {}
            for i, prob in enumerate(all_probs):
                per_class[result.names.get(i, str(i))] = float(prob)
            details = {"predicted_class": class_name, "per_class": per_class}
            
            # Apply verdict logic from flow guide:
            # - If NG detected -> always NG
            # - If OK detected but confidence < threshold -> Uncertain
            # - If OK detected and confidence >= threshold -> OK
            is_ng = any(kw in class_name.lower() for kw in ["ng", "bad", "defect", "fail", "reject", "damage"])
            is_ok = any(kw in class_name.lower() for kw in ["ok", "good", "pass", "normal", "clean"])
            
            if is_ng:
                verdict = "NG"
            elif is_ok:
                verdict = "OK" if confidence >= threshold else "Uncertain"
            else:
                # Unknown class name, use confidence
                verdict = "OK" if confidence >= threshold else "Uncertain"
        
        elif model_record.task_type == "detection" and result.boxes is not None:
            # Detection result
            if len(result.boxes) > 0:
                has_ng = False
                highest_conf = 0.0
                all_detections = []
                for box in result.boxes:
                    cls_idx = int(box.cls[0])
                    conf = float(box.conf[0])
                    c_name = result.names.get(cls_idx, str(cls_idx))
                    if conf > highest_conf:
                        highest_conf = conf
                        
                    is_ng_cls = any(kw in c_name.lower() for kw in ["ng", "bad", "defect", "fail"])
                    # If we find an NG object, we mark the whole inspection as NG
                    # Alternatively, if there's no NG but OK, we can say OK.
                    if is_ng_cls:
                        has_ng = True
                    
                    all_detections.append({
                        "class": c_name,
                        "confidence": conf
                    })
                
                details = {
                    "num_detections": len(result.boxes),
                    "detections": all_detections
                }
                
                confidence = highest_conf
                if has_ng:
                    verdict = "NG"
                else:
                    verdict = "OK" if confidence >= threshold else "Uncertain"
            else:
                verdict = "Uncertain"
                confidence = 0.0
                details = {"num_detections": 0}
    
    # Save inspection image
    inspection_id = models.generate_uuid()
    image_filename = f"{inspection_id}.jpg"
    image_path = INSPECTION_DIR / image_filename
    
    # If detection, plot the boxes on the image before saving
    if model_record.task_type == "detection" and results and len(results) > 0:
        frame_to_save = results[0].plot()
    else:
        frame_to_save = frame
        
    cv2.imwrite(str(image_path), frame_to_save)
    
    # Save to DB
    inspection_result = models.InspectionResult(
        id=inspection_id,
        model_id=model_id,
        image_path=f"/data/inspections/{image_filename}",
        verdict=verdict,
        confidence=confidence,
        details_json=json.dumps(details),
    )
    db.add(inspection_result)
    db.commit()
    
    # Fire integrations (webhooks, MQTT) in background thread
    from services.integration_service import dispatch_integrations
    dispatch_integrations(
        inspection_id=inspection_id,
        verdict=verdict,
        confidence=confidence,
        model_id=model_id,
        image_path=f"/data/inspections/{image_filename}",
        db=db,
    )
    
    return {
        "id": inspection_id,
        "verdict": verdict,
        "confidence": confidence,
        "details": details,
        "image_path": f"/data/inspections/{image_filename}",
    }


@router.get("/models")
def get_inspection_models(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    trained = db.query(models.TrainedModel).filter(
        models.TrainedModel.status == "trained"
    ).order_by(models.TrainedModel.created_at.desc()).all()
    valid_models = []
    for m in trained:
        if m.weights_path and os.path.exists(m.weights_path):
            valid_models.append({
                "id": m.id,
                "name": m.name,
                "version": m.version,
                "task_type": m.task_type,
                "architecture": m.architecture,
            })
    
    return valid_models
