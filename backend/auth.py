import uuid
import hashlib
from fastapi import Request, HTTPException, Depends
from sqlalchemy.orm import Session
from database import get_db
import models

# In-memory session store (simple, no Redis needed for single-server)
_sessions = {}  # session_id -> {"user_id": ..., "username": ..., "role": ...}


def hash_password(password: str) -> str:
    """Simple SHA256 hash. For production, use bcrypt."""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed


def create_session(user: models.User) -> str:
    session_id = str(uuid.uuid4())
    _sessions[session_id] = {
        "user_id": user.id,
        "username": user.username,
        "role": user.role,
    }
    return session_id


def get_session(session_id: str) -> dict | None:
    return _sessions.get(session_id)


def delete_session(session_id: str):
    _sessions.pop(session_id, None)


def get_current_user(request: Request, db: Session = Depends(get_db)) -> models.User:
    session_id = request.cookies.get("session_id")
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Session expired")
    
    user = db.query(models.User).filter(models.User.id == session["user_id"]).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user


def require_admin(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def seed_default_users(db: Session):
    """Create default admin and inspector users if they don't exist."""
    if not db.query(models.User).filter(models.User.username == "admin").first():
        admin = models.User(
            username="admin",
            password_hash=hash_password("admin123"),
            role="admin",
        )
        db.add(admin)
    
    if not db.query(models.User).filter(models.User.username == "inspector").first():
        inspector = models.User(
            username="inspector",
            password_hash=hash_password("inspect123"),
            role="inspector",
        )
        db.add(inspector)
    
    db.commit()
