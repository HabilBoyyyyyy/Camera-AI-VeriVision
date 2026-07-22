import sys, asyncio
sys.path.append('.')
from database import SessionLocal
import models
from services.alert_engine import run_alert_scan
from services.ai_analyst import generate_ai_insight

db = SessionLocal()
try:
    # Run alert scan
    result = run_alert_scan(db)
    print("=== Alert Scan Result ===")
    print("Created alerts:", result["created_count"])
    print("Stats:", result["stats"])
    
    # Check persisted alerts
    alerts = db.query(models.Alert).filter(models.Alert.is_acknowledged == False).all()
    print("\nActive alerts in DB:", len(alerts))
    for a in alerts:
        print(f"  [{a.severity.upper()}] {a.title}")
    
    # Test AI insight
    insight = asyncio.run(generate_ai_insight(result['stats']))
    print("\n=== AI Insight ===")
    print("Source:", insight["source"])
    print("Model:", insight["model"])
    print("Insight:", insight["insight"])
finally:
    db.close()
