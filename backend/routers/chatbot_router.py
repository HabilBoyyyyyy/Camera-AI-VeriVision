from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timedelta
import json
import re

from database import get_db
from models import InspectionResult, TrainedModel, Dataset, TrainingJob

router = APIRouter(prefix="/api/chat", tags=["chatbot"])


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    id: str
    role: str
    content: str
    timestamp: str


# ── Keyword patterns ──────────────────────────────────────────────────────────
PATTERNS = {
    "help": re.compile(r"\b(help|command|what can you do|how to use|guide)\b", re.I),
    "yield": re.compile(r"\b(yield|pass rate|ok rate|acceptance)\b", re.I),
    "defect": re.compile(r"\b(defect|ng|fail|reject|bad|defective)\b", re.I),
    "recent": re.compile(r"\b(recent|latest|last|newest)\b", re.I),
    "today": re.compile(r"\b(today|24 hour|this day)\b", re.I),
    "model": re.compile(r"\b(model|network|architecture|weight|trained)\b", re.I),
    "dataset": re.compile(r"\b(dataset|data set|training data|images|upload)\b", re.I),
    "training": re.compile(r"\b(training|train|epoch|job|queue)\b", re.I),
    "summary": re.compile(r"\b(summary|overview|dashboard|report|stats|status)\b", re.I),
    "uncertain": re.compile(r"\b(uncertain|unsure|low confidence|borderline)\b", re.I),
    "confidence": re.compile(r"\b(confidence|score|probability|threshold)\b", re.I),
    "count": re.compile(r"\b(count|how many|total|number of)\b", re.I),
}

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
    """Classify the user's intent based on keyword patterns."""
    matched = {}
    for intent, pattern in PATTERNS.items():
        m = pattern.search(message)
        if m:
            matched[intent] = m.start()

    if not matched:
        return "unknown"

    # Prioritise: help > specific intents > generic
    if "help" in matched:
        return "help"

    # If both "recent" and "defect" matched, it's a defect query
    if "defect" in matched or ("recent" in matched and "defect" in matched):
        return "defect"
    if "uncertain" in matched:
        return "uncertain"
    if "yield" in matched:
        return "yield"
    if "count" in matched and not any(k in matched for k in ["model", "dataset", "training"]):
        return "count"
    if "training" in matched:
        return "training"
    if "model" in matched:
        return "model"
    if "dataset" in matched:
        return "dataset"
    if "summary" in matched:
        return "summary"
    if "recent" in matched:
        return "defect"  # "recent" alone → show recent defects

    # Fallback: pick the first matched
    return list(matched.keys())[0]


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


@router.post("/", response_model=ChatResponse)
def chat(req: ChatRequest, db: Session = Depends(get_db)):
    message = req.message.strip()
    if not message:
        return ChatResponse(
            id=f"bot_{int(datetime.utcnow().timestamp() * 1000)}",
            role="assistant",
            content="Please type a message!",
            timestamp=datetime.utcnow().isoformat(),
        )

    intent = _classify_intent(message)
    handler = HANDLERS.get(intent)

    if handler:
        content = handler(db=db, message=message)
    else:
        content = FALLBACK_RESPONSE

    return ChatResponse(
        id=f"bot_{int(datetime.utcnow().timestamp() * 1000)}",
        role="assistant",
        content=content,
        timestamp=datetime.utcnow().isoformat(),
    )
