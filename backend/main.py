from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os

from database import engine, Base, SessionLocal
import models
from auth import seed_default_users

from routers import auth_router, dashboard_router, dataset_router
from routers import training_router, model_router, inspection_router, result_router, alerts_router

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
    finally:
        db.close()


@app.get("/")
def read_root():
    return {"status": "VeriVision API Operational", "version": "2.0.0"}


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
