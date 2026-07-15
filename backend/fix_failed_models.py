"""
One-time fix: recover models that were marked 'failed' but actually
produced a valid best.pt under the runs/ directory.
"""
import sqlite3
from pathlib import Path

DB = "verivision.db"
RUNS_ROOT = Path("runs")

con = sqlite3.connect(DB)
cur = con.cursor()

# Get all failed models
cur.execute("SELECT id, name FROM trained_models WHERE status='failed'")
failed = cur.fetchall()

fixed = 0
for model_id, model_name in failed:
    # Search everywhere under runs/ for this model's best.pt
    pattern = f"*{model_id}*/weights/best.pt"
    found = list(RUNS_ROOT.rglob(f"*{model_id}*"))
    
    # Also search data/models directly
    data_model_dir = Path("data") / "models" / model_id
    
    best_pt = None
    # Search runs/
    for pt in RUNS_ROOT.rglob("best.pt"):
        if model_id in str(pt):
            best_pt = pt
            break
    # Also search data/models/<id>
    if not best_pt and data_model_dir.exists():
        for pt in data_model_dir.rglob("best.pt"):
            best_pt = pt
            break
    
    if best_pt:
        print(f"RECOVERING: {model_name} ({model_id[:8]}) -> {best_pt}")
        cur.execute(
            "UPDATE trained_models SET status='trained', weights_path=? WHERE id=?",
            (str(best_pt), model_id)
        )
        # Also fix the corresponding training job
        cur.execute(
            "UPDATE training_jobs SET status='completed', error_message=NULL WHERE model_id=? AND status='failed'",
            (model_id,)
        )
        fixed += 1
    else:
        print(f"STILL FAILED (no weights found): {model_name} ({model_id[:8]})")

con.commit()
con.close()
print(f"\nDone. Recovered {fixed}/{len(failed)} models.")
