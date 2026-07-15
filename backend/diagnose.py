import sqlite3
import json
from pathlib import Path
from validators import _find_root

con = sqlite3.connect('verivision.db')
cur = con.cursor()

print("=" * 60)
print("LAST 3 TRAINING JOBS")
print("=" * 60)
cur.execute('SELECT id, status, error_message, config_json, progress_json FROM training_jobs ORDER BY rowid DESC LIMIT 3')
for row in cur.fetchall():
    job_id, status, error, config_json, progress_json = row
    cfg = json.loads(config_json or '{}')
    progress = json.loads(progress_json or '{}')
    print(f"Job: {job_id[:8]} | Status: {status}")
    print(f"  Task: {cfg.get('task_type')} | Arch: {cfg.get('architecture')} | Epochs: {cfg.get('epochs')}")
    print(f"  Patience: {cfg.get('early_stopping_patience')} | LR: {cfg.get('learning_rate')}")
    print(f"  Error: {error}")
    if progress.get('epochs_history'):
        hist = progress['epochs_history']
        print(f"  Epochs completed: {len(hist)}")
        if hist:
            print(f"  Last epoch loss: {hist[-1].get('train_loss')}")
    print()

print("=" * 60)
print("DATASET ANALYSIS")
print("=" * 60)
cur.execute('SELECT id, name, folder_path, task_type FROM datasets ORDER BY rowid DESC LIMIT 3')
for row in cur.fetchall():
    ds_id, ds_name, folder_path, task_type = row
    print(f"Dataset: {ds_name} ({task_type})")
    print(f"  Path: {folder_path}")
    if folder_path and Path(folder_path).exists():
        root = _find_root(Path(folder_path))
        print(f"  Root: {root}")
        for p in sorted(root.rglob('*')):
            depth = len(p.relative_to(root).parts)
            if depth <= 2:
                count = ""
                if p.is_dir():
                    imgs = [f for f in p.iterdir() if f.is_file() and f.suffix.lower() in {'.jpg','.jpeg','.png','.bmp'}]
                    count = f" ({len(imgs)} images)" if imgs else ""
                print(f"  {'  ' * depth}{p.name}{'/' if p.is_dir() else ''}{count}")
    else:
        print("  !! Folder not found on disk")
    print()
