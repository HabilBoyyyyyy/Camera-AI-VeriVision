"""
AI Shift Analyst — Local LLM integration for VeriVision.

Connects to a locally-running Ollama instance (e.g., Llama 3, Mistral, Phi-3)
to generate intelligent, human-readable shift insights from production data.

Falls back to a heuristic-based summary if Ollama is not available,
ensuring 100% offline capability.
"""

import httpx
import json
from datetime import datetime


# ── Configuration ─────────────────────────────────────────────────────────────
OLLAMA_BASE_URL = "http://127.0.0.1:11434"
OLLAMA_MODEL = "llama3"  # Change to whatever model you have pulled in Ollama
OLLAMA_TIMEOUT = 30.0    # seconds

SYSTEM_PROMPT = """You are VeriVision's AI Quality Analyst, embedded in a factory visual inspection system.
You analyze production inspection data and generate concise, actionable insights for factory operators.

Rules:
- Write in a professional but approachable tone.
- Be specific: mention exact numbers, percentages, and model names.
- If defect rates are high, suggest concrete next steps (check equipment, retrain model, review lighting).
- If confidence is dropping, explain what data drift means in simple terms.
- Keep your response to 2-4 sentences maximum.
- Do NOT use markdown formatting or bullet points — write plain text paragraphs.
- Do NOT greet the user or use filler phrases like "Based on the data" or "Here's my analysis".
"""


def _build_data_prompt(stats: dict) -> str:
    """Build a prompt from production statistics."""
    total = stats.get("total_today", 0)
    ok = stats.get("ok", 0)
    ng = stats.get("ng", 0)
    uncertain = stats.get("uncertain", 0)
    yield_pct = round((ok / total) * 100, 1) if total > 0 else 0

    lines = [
        f"Current time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
        f"Total inspections today: {total}",
        f"Results: {ok} OK, {ng} NG (defect), {uncertain} Uncertain",
        f"Yield rate: {yield_pct}%",
    ]

    # Add active alerts info
    active_alerts = stats.get("active_alerts", [])
    if active_alerts:
        lines.append(f"Active alerts ({len(active_alerts)}):")
        for alert in active_alerts[:5]:
            lines.append(f"  - [{alert['severity'].upper()}] {alert['title']}")

    # Add model drift info
    drift_models = stats.get("drift_models", [])
    if drift_models:
        lines.append("Models with confidence degradation:")
        for dm in drift_models:
            lines.append(f"  - {dm['name']}: {dm['historical_avg']}% → {dm['today_avg']}% (dropped {dm['drop_pct']}%)")

    # Add recent NG pattern info
    ng_classes = stats.get("ng_class_breakdown", {})
    if ng_classes:
        lines.append("Defect class breakdown (today):")
        for cls_name, count in ng_classes.items():
            lines.append(f"  - {cls_name}: {count}")

    return "\n".join(lines)


def _heuristic_fallback(stats: dict) -> str:
    """Generate a rule-based summary when Ollama is not available."""
    total = stats.get("total_today", 0)
    ok = stats.get("ok", 0)
    ng = stats.get("ng", 0)
    uncertain = stats.get("uncertain", 0)

    now_hour = datetime.utcnow().hour
    if now_hour < 12:
        shift = "Morning shift"
    elif now_hour < 18:
        shift = "Afternoon shift"
    else:
        shift = "Evening shift"

    if total == 0:
        return f"{shift} just started — no inspections recorded yet. Systems are online and ready."

    yield_rate = ok / total if total > 0 else 1.0
    pct = round(yield_rate * 100, 1)

    parts = []

    # Opening
    if yield_rate >= 0.95:
        parts.append(f"{shift} is running excellently with a {pct}% yield rate.")
    elif yield_rate >= 0.80:
        parts.append(f"{shift} is progressing with a {pct}% yield rate — within acceptable limits but worth monitoring.")
    else:
        parts.append(f"{shift} is under stress with only a {pct}% yield rate. Immediate attention may be required.")

    # Defects
    if ng == 0:
        parts.append("No defects detected so far.")
    elif ng == 1:
        parts.append("One defective part was detected.")
    else:
        parts.append(f"{ng} defective parts have been logged.")

    # Uncertainty
    if uncertain > 0:
        parts.append(f"{uncertain} uncertain inspection(s) are awaiting human review.")

    # Drift
    drift_models = stats.get("drift_models", [])
    if drift_models:
        model_names = ", ".join(dm["name"] for dm in drift_models)
        parts.append(f"⚠️ Confidence drift has been detected on: {model_names}. Consider retraining.")

    return " ".join(parts)


async def generate_ai_insight(stats: dict) -> dict:
    """
    Generate an AI-powered shift insight.

    Returns:
        dict: {
            "insight": str,          # The generated text
            "source": str,           # "ollama" or "heuristic"
            "model": str | None,     # The LLM model name, if used
            "generated_at": str,     # ISO timestamp
        }
    """
    data_prompt = _build_data_prompt(stats)

    # Try Ollama first
    try:
        async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
            # Check if Ollama is running
            health = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            if health.status_code != 200:
                raise ConnectionError("Ollama not responding")

            # Check if the requested model is available
            available_models = [m["name"] for m in health.json().get("models", [])]
            model_to_use = None

            # Try requested model first, then fallback to any available model
            for candidate in [OLLAMA_MODEL, "llama3", "llama3.2", "llama3.1", "mistral", "phi3", "gemma2", "qwen2"]:
                matching = [m for m in available_models if candidate in m]
                if matching:
                    model_to_use = matching[0]
                    break

            if not model_to_use and available_models:
                model_to_use = available_models[0]  # Use whatever is available

            if not model_to_use:
                raise ConnectionError("No models available in Ollama")

            # Generate insight
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": model_to_use,
                    "system": SYSTEM_PROMPT,
                    "prompt": f"Analyze this production data and provide a brief insight:\n\n{data_prompt}",
                    "stream": False,
                    "options": {
                        "temperature": 0.7,
                        "num_predict": 200,
                    }
                },
                timeout=OLLAMA_TIMEOUT,
            )

            if response.status_code == 200:
                result = response.json()
                insight_text = result.get("response", "").strip()
                if insight_text and len(insight_text) > 20:
                    return {
                        "insight": insight_text,
                        "source": "ollama",
                        "model": model_to_use,
                        "generated_at": datetime.utcnow().isoformat(),
                    }

    except Exception as e:
        print(f"[AI Analyst] Ollama unavailable ({type(e).__name__}: {e}), using heuristic fallback.")

    # Fallback to heuristic
    return {
        "insight": _heuristic_fallback(stats),
        "source": "heuristic",
        "model": None,
        "generated_at": datetime.utcnow().isoformat(),
    }
