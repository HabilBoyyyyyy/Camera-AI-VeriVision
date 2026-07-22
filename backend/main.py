from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os

from database import engine, Base, SessionLocal
import models
from auth import seed_default_users

from routers import auth_router, dashboard_router, dataset_router
from routers import training_router, model_router, inspection_router, result_router, alerts_router, chatbot_router, integration_router, template_router

# Create all database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="VeriVision API", version="2.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(auth_router.router)
app.include_router(dashboard_router.router)
app.include_router(dataset_router.router)
app.include_router(training_router.router)
app.include_router(model_router.router)
app.include_router(inspection_router.router)
app.include_router(result_router.router)
app.include_router(alerts_router.router)
app.include_router(chatbot_router.router)
app.include_router(integration_router.router)
app.include_router(template_router.router)

# Ensure data directories exist
os.makedirs("data/datasets", exist_ok=True)
os.makedirs("data/models", exist_ok=True)
os.makedirs("data/inspections", exist_ok=True)
os.makedirs("data/uploads", exist_ok=True)

# Serve static files (dataset images, model weights, inspection images)
app.mount("/data", StaticFiles(directory="data"), name="data")


@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    try:
        seed_default_users(db)
        # Auto-migrate: add review columns if missing
        _auto_migrate_review_columns(db)
    finally:
        db.close()


def _auto_migrate_review_columns(db):
    """Add review/validation columns to inspection_results if they don't exist."""
    from sqlalchemy import text, inspect as sa_inspect
    inspector = sa_inspect(engine)
    if "inspection_results" not in inspector.get_table_names():
        return
    existing = {col["name"] for col in inspector.get_columns("inspection_results")}
    migrations = [
        ("review_verdict", "VARCHAR"),
        ("review_notes", "TEXT"),
        ("reviewed_by", "VARCHAR"),
        ("reviewed_at", "DATETIME"),
        ("exported_to_dataset", "BOOLEAN DEFAULT 0"),
    ]
    for col_name, col_type in migrations:
        if col_name not in existing:
            db.execute(text(f"ALTER TABLE inspection_results ADD COLUMN {col_name} {col_type}"))
            print(f"[MIGRATION] Added column '{col_name}' to inspection_results")
    db.commit()


@app.get("/")
def read_root():
    return {"status": "VeriVision API Operational", "version": "2.0.0"}


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
