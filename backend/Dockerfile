# VeriVision backend — FastAPI + SQLite + YOLO/MobileSAM inference.
#
# This needs a host with a persistent disk (SQLite file + data/ folder for
# datasets, model weights, and inspection images all live on disk), so it's
# built for a long-running container (Render/Railway/Fly/a VPS) rather than
# a serverless platform. See ../DEPLOYMENT.md for platform-specific notes.

FROM python:3.13-slim

WORKDIR /app

# ultralytics unconditionally depends on full opencv-python (not
# -headless), which needs these X11/GL shared libs to even import on a
# slim base image, even though this API never opens a GUI window.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libxcb1 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# ultralytics depends on torch/torchvision, and pip's default index serves
# the CUDA-enabled build of those — several GB of NVIDIA driver libraries
# that are dead weight on a CPU-only deployment target (Render/Railway/Fly
# free-and-cheap tiers have no GPU). Installing the CPU-only build first
# means the requirements.txt install below is satisfied by these instead
# of pulling the CUDA variant — same YOLO/SAM inference, a fraction of the
# image size and cold-start time.
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

# Warm the base model cache into the image so the first inspection request
# in production doesn't have to download weights from Ultralytics on the
# spot. Harmless if a model name changes later — it just won't be
# pre-cached, and ultralytics will download it on first use as usual.
RUN python -c "\
from ultralytics import YOLO, SAM; \
YOLO('yolov8n.pt'); \
YOLO('yolov8s.pt'); \
YOLO('yolov8n-cls.pt'); \
YOLO('yolov8s-cls.pt'); \
SAM('mobile_sam.pt')"

COPY . .

# Persistent app data (datasets, trained models, inspection images) plus an
# empty placeholder for the SQLite DB file — both get overlaid by volumes
# in docker-compose.yml / production so they survive redeploys. The
# placeholder file is what lets Docker mount a named volume directly onto
# verivision.db (it copies existing image content into a fresh volume).
RUN mkdir -p data/datasets data/models data/inspections data/uploads \
    && touch verivision.db

EXPOSE 8000

# $PORT is honored so this also runs as-is on platforms that assign their
# own port (Render, Railway, etc.); defaults to 8000 otherwise.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
