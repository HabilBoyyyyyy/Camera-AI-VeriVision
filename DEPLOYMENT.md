# Deployment Guide

VeriVision is a two-part app: a Next.js frontend and a FastAPI backend that
does the actual AI work (YOLO detection/classification, MobileSAM
segmentation) and owns a SQLite database plus a local `data/` folder
(datasets, trained model weights, inspection images).

That local state is the one thing that shapes every choice below: **the
backend needs a host with a persistent disk that survives redeploys.** It
cannot run on a serverless/edge platform (Vercel functions, AWS Lambda,
Cloudflare Workers) — those have ephemeral, read-only, or size-limited
filesystems, and the backend's dependencies (PyTorch via ultralytics,
OpenCV) are also too large for most serverless size limits anyway.

## Recommended setup

| Part | Where | Why |
|---|---|---|
| Frontend (Next.js) | [Vercel](https://vercel.com) | Built for Next.js, zero-config, free tier is plenty for a portfolio project. |
| Backend (FastAPI) | [FastAPI Cloud](https://fastapicloud.com) | Free Hobby tier, **no card required** (Render/Railway/Fly all now ask for one, even on their free tiers). No persistent disk though — see the Postgres note below. |
| Database | [Neon](https://neon.tech) (Postgres) | Free tier, no card. Needed because FastAPI Cloud's filesystem is ephemeral (scale-to-zero wipes local disk) — SQLite would reset itself on every cold start. |

Docker-capable alternatives ([Render](https://render.com),
[Railway](https://railway.app), [Fly.io](https://fly.io)) still work and
get you a real persistent disk (so SQLite + local `data/` survive
redeploys with no extra setup) — use one of those instead if you'd rather
not deal with a separate database, or if any of them stop requiring a
card by the time you deploy. You can also run both parts on a single VPS
with `docker compose up -d` (see below).

## 1. Deploy the backend

### Option A — FastAPI Cloud (free, no card)

FastAPI Cloud builds straight from `backend/requirements.txt` — no
Dockerfile, no apt/system packages. `requirements.txt` is already set up
for this (CPU-only torch pinned to the `+cpu` wheel, `opencv-python-headless`
instead of the GUI build that needs libGL).

1. Create a free Postgres database on [Neon](https://neon.tech) (no card).
   Copy the connection string it gives you (starts with `postgresql://`).
2. Install the CLI and deploy from the `backend/` directory:
   ```bash
   pip install fastapi-cloud-cli   # or: uv tool install fastapi-cloud-cli
   cd backend
   fastapi deploy
   ```
   First run walks you through login + picking/creating an app. If you
   deploy from the repo root instead, set **Application Directory** to
   `backend` in the FastAPI Cloud dashboard's app settings.
3. In the dashboard, set these environment variables on the app:

   | Variable | Value | Purpose |
   |---|---|---|
   | `DATABASE_URL` | the Neon connection string from step 1 | `database.py` reads this and switches from SQLite to Postgres automatically when it's set. |
   | `ALLOWED_ORIGINS` | your deployed frontend's URL, e.g. `https://your-app.vercel.app` | CORS — without this, the browser blocks every request from the deployed frontend. Comma-separate multiple origins if you keep a preview URL around too. |

   Redeploy (`fastapi deploy` again) after adding them so the running app
   picks them up.

**Known tradeoff:** only the database is made persistent here. The local
`data/` folder (uploaded dataset images, trained model weight files,
inspection images) still lives on FastAPI Cloud's ephemeral disk and is
lost whenever the app scales to zero and cold-starts again. Login/users
and all inspection *records* (rows) persist fine via Postgres — it's only
files on disk that don't. Fine for a portfolio demo; if this needs to be
airtight later, move `data/` to S3-compatible object storage (e.g.
Cloudflare R2) and rework the dataset/training routers to read/write
through it instead of local paths.

**Verify it's up**: `GET /api/health` (returns `{"status": "ok"}`) —
already wired up in `main.py`.

### Option B — Render / Railway / Fly (Docker, persistent disk, needs a card)

The backend ships with a `backend/Dockerfile` that any of these can build
directly from the repo.

**Environment variables:**

| Variable | Value | Purpose |
|---|---|---|
| `ALLOWED_ORIGINS` | Your deployed frontend's URL, e.g. `https://your-app.vercel.app` | CORS — without this, the browser will block every request from the deployed frontend. Comma-separate multiple origins if you keep a preview URL around too. |
| `PORT` | usually set automatically by the platform | The Dockerfile's `CMD` already reads `$PORT`, falling back to 8000. |
| `DATABASE_URL` | leave unset | Not needed here — these platforms give you a real persistent disk, so the default local SQLite file is fine. Only set this if you'd rather point at a managed Postgres anyway. |

**Persistent disk:** attach a volume mounted at `/app/data` (datasets,
trained models, inspection images) and, if the platform supports mounting
onto a file, another at `/app/verivision.db` (the SQLite database) —
`docker-compose.yml` in this repo shows both. If your platform only
supports one mount path, mount it at `/app/data` and expect the SQLite DB
to reset on redeploy until you add a second volume; both Render and
Railway support multiple/arbitrary mount paths.

**First deploy takes longer than usual**: the `Dockerfile` downloads and
bakes in the base YOLO/MobileSAM weights (~50MB total) during the image
build so the first real inspection request doesn't stall on a cold
download.

**Verify it's up**: every one of these platforms can health-check against
`GET /api/health` (returns `{"status": "ok"}`), which is already wired up
in `main.py`.

## 2. Deploy the frontend

On Vercel: import the repo, set the **root directory** to `frontend/`, and
add one environment variable:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | Your deployed backend's URL, e.g. `https://your-api.onrender.com` |

That's it — Vercel auto-detects Next.js and handles the build. Because
`NEXT_PUBLIC_*` vars are baked into the client bundle at build time, set
this *before* the first deploy (or trigger a redeploy after adding it).

## 3. Wire them together

1. Deploy the backend first, note its public URL.
2. Set `NEXT_PUBLIC_API_URL` on the frontend to that URL, deploy the frontend.
3. Set `ALLOWED_ORIGINS` on the backend to the frontend's URL, redeploy the backend.
4. Log in with the seeded accounts (`admin` / `admin123`, `inspector` /
   `inspect123`) and **change these passwords immediately** — see the
   security note below.

## Alternative: one VPS with docker-compose

For a single-server setup (a $5-6/mo VPS is enough for a demo):

```bash
git clone https://github.com/HabilBoyyyyyy/Camera-AI-VeriVision.git
cd Camera-AI-VeriVision
docker compose up --build -d
```

This builds and runs both services with the frontend calling the backend
over `localhost`, which only works because they're on the same host —
edit `docker-compose.yml`'s `NEXT_PUBLIC_API_URL` build arg and
`ALLOWED_ORIGINS` to your server's actual domain/IP if you expose it
externally (and put a reverse proxy like Caddy or nginx in front for
TLS — neither container terminates HTTPS itself).

## Things worth knowing before you share the link publicly

- **Change the default passwords.** `admin`/`admin123` and
  `inspector`/`inspect123` are seeded on first run so the app is usable
  out of the box; they are *not* meant to survive into a public deployment.
  Log in as `admin` and use the user management screen (or hit
  `POST /api/auth/register` with a new admin account, then delete/repurpose
  the seeded ones) before sharing the URL.
- **The AI chatbot (VeriAssist) needs Ollama** running locally to give
  LLM-generated answers; without it, it automatically falls back to
  simpler heuristic/rule-based responses (see `routers/chatbot_router.py`)
  — nothing breaks, the chat still works, just less conversational. Running
  Ollama alongside the backend in production is optional and out of scope
  for a portfolio deployment; skip it unless you specifically want that
  feature to shine.
- **MQTT/PLC/webhook integrations** assume a factory network with real
  hardware and won't have anything to connect to in a cloud deployment —
  that's expected for a portfolio demo; the rest of the app works fully
  without them.
- **SQLite is fine for a single-instance demo** but doesn't support
  multiple backend replicas writing concurrently. Don't scale the backend
  horizontally without switching to Postgres first.
