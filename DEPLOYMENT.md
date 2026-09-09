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
| Backend (FastAPI) | [Render](https://render.com), [Railway](https://railway.app), or [Fly.io](https://fly.io) | Persistent disk + long-running container support, all have a Docker deploy path and a free/cheap tier. |

You can also run both on a single VPS with `docker compose up -d` (see
below) if you'd rather manage one server than two platforms.

## 1. Deploy the backend

The backend ships with a `backend/Dockerfile` that any of the platforms
above can build directly from the repo.

**Environment variables:**

| Variable | Value | Purpose |
|---|---|---|
| `ALLOWED_ORIGINS` | Your deployed frontend's URL, e.g. `https://your-app.vercel.app` | CORS — without this, the browser will block every request from the deployed frontend. Comma-separate multiple origins if you keep a preview URL around too. |
| `PORT` | usually set automatically by the platform | The Dockerfile's `CMD` already reads `$PORT`, falling back to 8000. |

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
