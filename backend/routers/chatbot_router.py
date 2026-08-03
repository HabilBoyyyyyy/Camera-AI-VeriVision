from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timedelta
import json
import re
import httpx
import logging

from database import get_db
from models import InspectionResult, TrainedModel, Dataset, TrainingJob

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chatbot"])

# ── Ollama Configuration ──────────────────────────────────────────────────────
OLLAMA_BASE_URL = "http://127.0.0.1:11434"
OLLAMA_MODEL = "llama3.2:1b"
OLLAMA_TIMEOUT = 30.0

CHATBOT_SYSTEM_PROMPT = """You are VeriAssist, an AI assistant embedded in VeriVision — a factory visual inspection platform.
You help factory operators understand inspection results, yield rates, defects, and system status.

Rules:
- Be concise: 2-4 sentences maximum.
- Be specific: use the numbers from the context provided.
- If the user asks something unrelated to manufacturing/inspection, politely redirect.
- Use a professional but friendly tone.
- Do NOT use markdown tables. Use bold (**text**) for emphasis only.
- Do NOT greet or use filler phrases.
"""


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    id: str
    role: str
    content: str
    timestamp: str
    source: str = "heuristic"


# ── ML Classifier Setup ───────────────────────────────────────────────────────
# We use a TF-IDF vectorizer + LogisticRegression to classify user intents
# instead of the old regex patterns, improving natural language understanding.

TRAINING_DATA = {
    "help": [
        "help", "help me", "what can you do", "how to use this", "user guide",
        "show commands", "what are the commands", "how does this work",
        "can you help me", "instructions", "what is available", "guide",
        "tell me what you can do", "show me options", "help menu", "need assistance"
    ],
    "yield": [
        "what is today's yield", "show me the pass rate", "how is the acceptance rate",
        "yield report for this week", "what percentage passed today", "ok rate this month",
        "how many passed vs failed", "production yield", "quality rate", "first pass yield",
        "what is the yield", "tell me the yield", "pass rate today", "yield percentage",
        "show yield", "current yield", "yield rate", "acceptable rate", "pass vs fail"
    ],
    "defect": [
        "show recent defects", "list ng parts", "any failures today", "defect report",
        "defective items", "show me ng", "recent fails", "last 10 defects", "what failed",
        "failed parts", "show defects", "defect list", "ng list", "rejected parts",
        "show me bad parts", "failures", "did any fail", "recent ng", "show rejected"
    ],
    "uncertain": [
        "show uncertain results", "unsure parts", "low confidence results", "borderline verdicts",
        "uncertain verdicts", "needs manual check", "show borderline", "what is uncertain",
        "low confidence", "uncertain items", "list uncertain", "any unsure", "not confident",
        "borderline cases", "manual review needed", "uncertainty list"
    ],
    "count": [
        "how many inspections today", "total count", "number of inspections", "total parts checked",
        "how many checked", "count for today", "inspection count", "total items",
        "how many parts", "total processed", "volume today", "throughput", "count",
        "how many did we do", "total today", "total scanned"
    ],
    "model": [
        "model status", "check deployed model info", "what model is running", "show models",
        "trained models", "current model architecture", "model accuracy", "network status",
        "active model", "model version", "what is the model", "list models", "deployed network",
        "AI model", "model info", "weights and models"
    ],
    "dataset": [
        "dataset summary", "see all datasets", "what datasets do we have", "training data",
        "list datasets", "data sets", "images dataset", "upload data", "dataset status",
        "how many datasets", "dataset info", "show me datasets", "available datasets",
        "image data", "training images", "dataset list"
    ],
    "training": [
        "training status", "check active training jobs", "is it training", "training queue",
        "recent training jobs", "train a model", "training progress", "model training",
        "show training", "training jobs", "epochs left", "training run", "queue status",
        "training history", "is training done", "job status"
    ],
    "summary": [
        "give me a summary", "full system overview", "dashboard", "report",
        "system status", "overall status", "summary for today", "show dashboard",
        "status report", "overview", "system summary", "everything summary",
        "daily report", "general status", "how is everything", "quick summary"
    ]
}

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

_vectorizer = TfidfVectorizer(lowercase=True, stop_words='english')
_clf = LogisticRegression(random_state=42)

_X_texts = []
_y_labels = []
for _intent, _examples in TRAINING_DATA.items():
    for _text in _examples:
        _X_texts.append(_text)
        _y_labels.append(_intent)

_X_features = _vectorizer.fit_transform(_X_texts)
_clf.fit(_X_features, _y_labels)

TIME_PATTERNS = {
    "today": re.compile(r"\b(today|this day)\b", re.I),
    "yesterday": re.compile(r"\b(yesterday)\b", re.I),
    "week": re.compile(r"\b(this week|past week|last 7 days|7 days)\b", re.I),
    "month": re.compile(r"\b(this month|past month|last 30 days|30 days)\b", re.I),
}


def _get_time_filter(message: str):
    """Return a start datetime based on time keywords in the message."""
    now = datetime.utcnow()
    if TIME_PATTERNS["yesterday"].search(message):
        start = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0)
        return start, "yesterday"
    if TIME_PATTERNS["week"].search(message):
        return now - timedelta(days=7), "the past 7 days"
    if TIME_PATTERNS["month"].search(message):
        return now - timedelta(days=30), "the past 30 days"
    # Default to today
    return now.replace(hour=0, minute=0, second=0, microsecond=0), "today"


def _handle_help(**_):
    return (
        "I'm VeriVision's Operations Assistant! Here's what I can help you with:\n\n"
        "- **\"What is today's yield?\"** — Calculate pass/fail rates\n"
        "- **\"Show recent defects\"** — List the latest NG inspections\n"
        "- **\"How many inspections today?\"** — Count inspections\n"
        "- **\"Show uncertain results\"** — Find borderline verdicts\n"
        "- **\"Model status\"** — Check deployed model info\n"
        "- **\"Dataset summary\"** — See all datasets\n"
        "- **\"Training status\"** — Check active/recent training jobs\n"
        "- **\"Give me a summary\"** — Full system overview\n\n"
        "Just type naturally — I'll understand keywords like *yield*, *defect*, *model*, *training*, etc."
    )


def _handle_yield(db: Session, message: str, **_):
    start, label = _get_time_filter(message)
    total = db.query(func.count(InspectionResult.id)).filter(
        InspectionResult.created_at >= start
    ).scalar() or 0

    if total == 0:
        return f"No inspections found for **{label}**. The line may not have been running."

    ok = db.query(func.count(InspectionResult.id)).filter(
        InspectionResult.created_at >= start,
        InspectionResult.verdict == "OK"
    ).scalar() or 0
    ng = db.query(func.count(InspectionResult.id)).filter(
        InspectionResult.created_at >= start,
        InspectionResult.verdict == "NG"
    ).scalar() or 0
    uncertain = total - ok - ng
    rate = round((ok / total) * 100, 1) if total > 0 else 0

    return (
        f"**Yield Report — {label.title()}**\n\n"
        f"| Metric | Value |\n"
        f"|---|---|\n"
        f"| Total Inspections | **{total}** |\n"
        f"| OK (Pass) | **{ok}** |\n"
        f"| NG (Fail) | **{ng}** |\n"
        f"| Uncertain | **{uncertain}** |\n"
        f"| **Yield Rate** | **{rate}%** |\n\n"
        f"{'⚠️ Yield is below 90%. Investigate the line!' if rate < 90 else '✅ Yield is healthy.'}"
    )


def _handle_defects(db: Session, message: str, **_):
    start, label = _get_time_filter(message)
    results = db.query(InspectionResult).filter(
        InspectionResult.created_at >= start,
        InspectionResult.verdict == "NG"
    ).order_by(desc(InspectionResult.created_at)).limit(10).all()

    if not results:
        return f"No defects (NG) found for **{label}**. Great news!"

    rows = ""
    for r in results:
        conf = f"{r.confidence * 100:.1f}%"
        img = r.image_path.split("/")[-1] if r.image_path else "N/A"
        time_str = r.created_at.strftime("%H:%M:%S") if r.created_at else "—"
        rows += f"| {img} | {conf} | {time_str} |\n"

    return (
        f"**Recent Defects — {label.title()}** (up to 10)\n\n"
        f"| Image | Confidence | Time |\n"
        f"|---|---|---|\n"
        f"{rows}\n"
        f"Found **{len(results)}** defective part(s)."
    )


def _handle_uncertain(db: Session, message: str, **_):
    start, label = _get_time_filter(message)
    results = db.query(InspectionResult).filter(
        InspectionResult.created_at >= start,
        InspectionResult.verdict == "Uncertain"
    ).order_by(desc(InspectionResult.created_at)).limit(10).all()

    if not results:
        return f"No uncertain results for **{label}**. All verdicts were confident."

    rows = ""
    for r in results:
        conf = f"{r.confidence * 100:.1f}%"
        img = r.image_path.split("/")[-1] if r.image_path else "N/A"
        rows += f"| {img} | {conf} |\n"

    return (
        f"**Uncertain Results — {label.title()}** (up to 10)\n\n"
        f"| Image | Confidence |\n"
        f"|---|---|\n"
        f"{rows}\n"
        f"These parts may need manual re-inspection."
    )


def _handle_count(db: Session, message: str, **_):
    start, label = _get_time_filter(message)
    total = db.query(func.count(InspectionResult.id)).filter(
        InspectionResult.created_at >= start
    ).scalar() or 0
    return f"**Total inspections for {label}:** {total}"


def _handle_models(db: Session, **_):
    models = db.query(TrainedModel).order_by(desc(TrainedModel.created_at)).limit(10).all()
    if not models:
        return "No trained models found. Go to the **Training** page to train your first model!"

    rows = ""
    for m in models:
        metrics = {}
        if m.metrics_json:
            try:
                metrics = json.loads(m.metrics_json)
            except Exception:
                pass
        acc = f"{metrics.get('accuracy', 0) * 100:.1f}%" if metrics.get('accuracy') else "—"
        rows += f"| {m.name} | v{m.version} | {m.architecture} | {m.status} | {acc} |\n"

    return (
        f"**Trained Models**\n\n"
        f"| Name | Version | Architecture | Status | Accuracy |\n"
        f"|---|---|---|---|---|\n"
        f"{rows}"
    )


def _handle_datasets(db: Session, **_):
    datasets = db.query(Dataset).order_by(desc(Dataset.created_at)).limit(10).all()
    if not datasets:
        return "No datasets found. Go to the **Datasets** page to upload your first one!"

    rows = ""
    for d in datasets:
        classes = "—"
        if d.classes_json:
            try:
                cls_list = json.loads(d.classes_json)
                classes = ", ".join(cls_list[:5])
                if len(cls_list) > 5:
                    classes += f" (+{len(cls_list) - 5} more)"
            except Exception:
                pass
        rows += f"| {d.name} | {d.task_type} | {d.num_images} | {classes} | {d.status} |\n"

    return (
        f"**Datasets**\n\n"
        f"| Name | Type | Images | Classes | Status |\n"
        f"|---|---|---|---|---|\n"
        f"{rows}"
    )


def _handle_training(db: Session, **_):
    jobs = db.query(TrainingJob).order_by(desc(TrainingJob.id)).limit(5).all()
    if not jobs:
        return "No training jobs found. Start a training run from the **Training** page!"

    rows = ""
    for j in jobs:
        progress = {}
        if j.progress_json:
            try:
                progress = json.loads(j.progress_json)
            except Exception:
                pass
        epoch = progress.get("epoch", "—")
        total = progress.get("total_epochs", "—")
        rows += f"| {j.status} | {epoch}/{total} | {j.started_at or '—'} |\n"

    return (
        f"**Recent Training Jobs** (last 5)\n\n"
        f"| Status | Progress | Started |\n"
        f"|---|---|---|\n"
        f"{rows}"
    )


def _handle_summary(db: Session, message: str, **_):
    start, label = _get_time_filter(message)

    total_inspections = db.query(func.count(InspectionResult.id)).filter(
        InspectionResult.created_at >= start
    ).scalar() or 0
    ok_count = db.query(func.count(InspectionResult.id)).filter(
        InspectionResult.created_at >= start,
        InspectionResult.verdict == "OK"
    ).scalar() or 0
    ng_count = db.query(func.count(InspectionResult.id)).filter(
        InspectionResult.created_at >= start,
        InspectionResult.verdict == "NG"
    ).scalar() or 0

    total_models = db.query(func.count(TrainedModel.id)).scalar() or 0
    trained_models = db.query(func.count(TrainedModel.id)).filter(
        TrainedModel.status == "trained"
    ).scalar() or 0
    total_datasets = db.query(func.count(Dataset.id)).scalar() or 0
    active_jobs = db.query(func.count(TrainingJob.id)).filter(
        TrainingJob.status.in_(["queued", "training"])
    ).scalar() or 0

    yield_rate = round((ok_count / total_inspections) * 100, 1) if total_inspections > 0 else 0

    return (
        f"**System Summary — {label.title()}**\n\n"
        f"| Metric | Value |\n"
        f"|---|---|\n"
        f"| Inspections ({label}) | **{total_inspections}** |\n"
        f"| Yield Rate | **{yield_rate}%** |\n"
        f"| OK / NG | **{ok_count}** / **{ng_count}** |\n"
        f"| Total Datasets | **{total_datasets}** |\n"
        f"| Models (Trained/Total) | **{trained_models}** / **{total_models}** |\n"
        f"| Active Training Jobs | **{active_jobs}** |\n\n"
        f"{'⚠️ Yield below 90%!' if yield_rate < 90 and total_inspections > 0 else '✅ System healthy.' if total_inspections > 0 else 'ℹ️ No inspections yet for this period.'}"
    )


def _classify_intent(message: str) -> str:
    """Classify the user's intent using a TF-IDF + LogisticRegression model."""
    
    # ── Conversational Bypass ──
    # If the user is asking for reasoning, advice, or explanations, bypass the structured
    # ML intents and force the LLM to handle it.
    lower_msg = message.lower()
    conversational_triggers = ["why", "how can", "how do", "what should", "explain", "meaning", "fix"]
    # We still allow "how many" (count) and "what is" (query) to go to heuristics
    
    if any(trigger in lower_msg.split() for trigger in conversational_triggers):
        class IntentStr(str): pass
        return IntentStr("unknown")

    X = _vectorizer.transform([message])
    probs = _clf.predict_proba(X)[0]
    
    top_idx = probs.argmax()
    top_intent = _clf.classes_[top_idx]
    confidence = probs[top_idx]
    
    if confidence < 0.4:
        class IntentStr(str):
            pass
        res = IntentStr("unknown")
        if confidence > 0.1:
            res.hint = f"closest match: {top_intent} at {confidence*100:.0f}% confidence"
        return res
    
    return top_intent


HANDLERS = {
    "help": _handle_help,
    "yield": _handle_yield,
    "defect": _handle_defects,
    "uncertain": _handle_uncertain,
    "count": _handle_count,
    "model": _handle_models,
    "dataset": _handle_datasets,
    "training": _handle_training,
    "summary": _handle_summary,
}

FALLBACK_RESPONSE = (
    "I'm not sure I understand that. Try asking me about:\n\n"
    "- **Yield** or **pass rate**\n"
    "- **Defects** or **NG parts**\n"
    "- **Model** status\n"
    "- **Dataset** info\n"
    "- **Training** jobs\n"
    "- **Summary** / overview\n\n"
    "Or type **help** to see all commands."
)


def _gather_system_context(db: Session) -> str:
    """Gather live system stats to give the LLM context about the current state."""
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    total = db.query(func.count(InspectionResult.id)).filter(
        InspectionResult.created_at >= today_start
    ).scalar() or 0
    ok = db.query(func.count(InspectionResult.id)).filter(
        InspectionResult.created_at >= today_start,
        InspectionResult.verdict == "OK"
    ).scalar() or 0
    ng = db.query(func.count(InspectionResult.id)).filter(
        InspectionResult.created_at >= today_start,
        InspectionResult.verdict == "NG"
    ).scalar() or 0
    yield_pct = round((ok / total) * 100, 1) if total > 0 else 0

    total_models = db.query(func.count(TrainedModel.id)).scalar() or 0
    deployed = db.query(func.count(TrainedModel.id)).filter(
        TrainedModel.status == "trained"
    ).scalar() or 0
    total_datasets = db.query(func.count(Dataset.id)).scalar() or 0
    active_jobs = db.query(func.count(TrainingJob.id)).filter(
        TrainingJob.status.in_(["queued", "training"])
    ).scalar() or 0

    return (
        f"Current time: {now.strftime('%Y-%m-%d %H:%M')}\n"
        f"Inspections today: {total} (OK: {ok}, NG: {ng})\n"
        f"Yield rate: {yield_pct}%\n"
        f"Models: {deployed} deployed / {total_models} total\n"
        f"Datasets: {total_datasets}\n"
        f"Active training jobs: {active_jobs}"
    )


def _try_ollama(message: str, system_context: str) -> str | None:
    """Try to get a response from Ollama. Returns None if unavailable."""
    try:
        with httpx.Client(timeout=OLLAMA_TIMEOUT) as client:
            # Check if Ollama is running
            health = client.get(f"{OLLAMA_BASE_URL}/api/tags")
            if health.status_code != 200:
                return None

            # Find the right model
            available = [m["name"] for m in health.json().get("models", [])]
            model_to_use = None
            for candidate in [OLLAMA_MODEL, "llama3.2:1b", "llama3.2", "llama3", "mistral", "phi3"]:
                matching = [m for m in available if candidate in m]
                if matching:
                    model_to_use = matching[0]
                    break
            if not model_to_use and available:
                model_to_use = available[0]
            if not model_to_use:
                return None

            prompt = (
                f"Here is the current system status:\n{system_context}\n\n"
                f"User question: {message}"
            )

            response = client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": model_to_use,
                    "system": CHATBOT_SYSTEM_PROMPT,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.7,
                        "num_predict": 250,
                    }
                },
                timeout=OLLAMA_TIMEOUT,
            )

            if response.status_code == 200:
                text = response.json().get("response", "").strip()
                if text and len(text) > 10:
                    return text
    except Exception as e:
        logger.info(f"Ollama unavailable for chat: {type(e).__name__}: {e}")

    return None


@router.post("/", response_model=ChatResponse)
def chat(req: ChatRequest, db: Session = Depends(get_db)):
    message = req.message.strip()
    if not message:
        return ChatResponse(
            id=f"bot_{int(datetime.utcnow().timestamp() * 1000)}",
            role="assistant",
            content="Please type a message!",
            timestamp=datetime.utcnow().isoformat(),
            source="heuristic",
        )

    intent = _classify_intent(message)
    handler = HANDLERS.get(intent)

    # ── Known intent → use heuristic handler (fast, structured) ──
    if handler:
        content = handler(db=db, message=message)
        return ChatResponse(
            id=f"bot_{int(datetime.utcnow().timestamp() * 1000)}",
            role="assistant",
            content=content,
            timestamp=datetime.utcnow().isoformat(),
            source="heuristic",
        )

    # ── Unknown intent → try LLM first, then fall back ──
    system_context = _gather_system_context(db)
    llm_response = _try_ollama(message, system_context)

    if llm_response:
        return ChatResponse(
            id=f"bot_{int(datetime.utcnow().timestamp() * 1000)}",
            role="assistant",
            content=llm_response,
            timestamp=datetime.utcnow().isoformat(),
            source="llm",
        )

    # ── LLM unavailable → heuristic fallback message ──
    content = FALLBACK_RESPONSE
    if getattr(intent, "hint", None):
        content = content.replace(
            "I'm not sure I understand that.",
            f"I'm not sure I understand that ({intent.hint})."
        )

    return ChatResponse(
        id=f"bot_{int(datetime.utcnow().timestamp() * 1000)}",
        role="assistant",
        content=content,
        timestamp=datetime.utcnow().isoformat(),
        source="heuristic",
    )
