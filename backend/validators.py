import zipfile
import shutil
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict

IMG_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
MIN_IMAGES_PER_CLASS = 2


@dataclass
class ValidationResult:
    valid: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    summary: Dict = field(default_factory=dict)


def safe_extract_zip(zip_path: Path, dest_dir: Path) -> None:
    """Extract with a zip-slip guard."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as zf:
        for member in zf.namelist():
            member_path = dest_dir / member
            if not member_path.resolve().is_relative_to(dest_dir.resolve()):
                raise ValueError(f"Unsafe path in zip: {member}")
        zf.extractall(dest_dir)


def _find_root(dest_dir: Path) -> Path:
    """Handle the common case where the zip contains one wrapping folder."""
    entries = [p for p in dest_dir.iterdir() if not p.name.startswith("__MACOSX")]
    if len(entries) == 1 and entries[0].is_dir():
        return entries[0]
    return dest_dir


def _count_images(directory: Path) -> int:
    """Count image files in a directory (non-recursive)."""
    return sum(1 for f in directory.iterdir() if f.is_file() and f.suffix.lower() in IMG_EXTS)


def _auto_split_dataset(root: Path) -> None:
    """If only OK/NG folders exist (no train/valid), auto-split 80/20."""
    ok_dir = None
    ng_dir = None
    for d in root.iterdir():
        if d.is_dir():
            name_lower = d.name.lower()
            if name_lower in ("ok", "good", "pass", "normal"):
                ok_dir = d
            elif name_lower in ("ng", "bad", "defect", "fail", "reject"):
                ng_dir = d
    
    if ok_dir and ng_dir:
        # Create train/valid structure
        train_dir = root / "train"
        valid_dir = root / "valid"
        for class_src in [ok_dir, ng_dir]:
            class_name = class_src.name
            train_class = train_dir / class_name
            valid_class = valid_dir / class_name
            train_class.mkdir(parents=True, exist_ok=True)
            valid_class.mkdir(parents=True, exist_ok=True)
            
            images = sorted([f for f in class_src.iterdir() if f.is_file() and f.suffix.lower() in IMG_EXTS])
            split_idx = max(1, int(len(images) * 0.8))
            for i, img in enumerate(images):
                dest = train_class if i < split_idx else valid_class
                shutil.copy2(img, dest / img.name)
        
        # Clean up original folders
        shutil.rmtree(ok_dir)
        shutil.rmtree(ng_dir)


def validate_classification_dataset(dest_dir: Path) -> ValidationResult:
    root = _find_root(dest_dir)
    result = ValidationResult(valid=True)
    
    # Check for auto-split case (only OK/NG, no train/valid)
    train_dir = root / "train"
    valid_dir = root / "valid"
    
    if not train_dir.is_dir() and not valid_dir.is_dir():
        # Try auto-split
        _auto_split_dataset(root)
        train_dir = root / "train"
        valid_dir = root / "valid"
    
    # Also accept "Train"/"Val" case variations
    if not train_dir.is_dir():
        for d in root.iterdir():
            if d.is_dir() and d.name.lower() in ("train", "training"):
                train_dir = d
                break
    if not valid_dir.is_dir():
        for d in root.iterdir():
            if d.is_dir() and d.name.lower() in ("valid", "validation", "val"):
                valid_dir = d
                break
    
    if not train_dir.is_dir():
        result.errors.append("Missing 'train/' folder.")
    if not valid_dir.is_dir():
        result.errors.append("Missing 'valid/' folder.")
    if result.errors:
        result.valid = False
        return result
    
    train_classes = {p.name for p in train_dir.iterdir() if p.is_dir()}
    valid_classes = {p.name for p in valid_dir.iterdir() if p.is_dir()}
    
    if not train_classes:
        result.errors.append("No class subfolders found inside 'train/'.")
    if train_classes != valid_classes:
        missing_in_valid = train_classes - valid_classes
        missing_in_train = valid_classes - train_classes
        if missing_in_valid:
            result.errors.append(f"Classes in train but not valid: {sorted(missing_in_valid)}")
        if missing_in_train:
            result.errors.append(f"Classes in valid but not train: {sorted(missing_in_train)}")
    
    class_counts = {}
    total_images = 0
    for split_name, split_dir, classes in [("train", train_dir, train_classes), ("valid", valid_dir, valid_classes)]:
        for cls in classes:
            n_images = _count_images(split_dir / cls)
            class_counts[f"{split_name}/{cls}"] = n_images
            total_images += n_images
            if n_images == 0:
                result.errors.append(f"'{split_name}/{cls}' contains no valid images.")
            elif n_images < MIN_IMAGES_PER_CLASS:
                result.warnings.append(
                    f"'{split_name}/{cls}' has only {n_images} images (recommend >= {MIN_IMAGES_PER_CLASS})."
                )
    
    result.summary = {
        "num_classes": len(train_classes),
        "classes": sorted(train_classes),
        "class_counts": class_counts,
        "total_images": total_images,
    }
    result.valid = len(result.errors) == 0
    return result


def _parse_data_yaml(yaml_path: Path) -> dict:
    """Parse a YOLO data.yaml file and return a dict with 'names' (class list)."""
    import yaml
    try:
        with open(yaml_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        if not isinstance(data, dict):
            return {}
        # data.yaml 'names' can be a list ["OK","NG"] or a dict {0:"OK", 1:"NG"}
        names_raw = data.get("names", [])
        if isinstance(names_raw, dict):
            # Sort by key (class index) and extract values
            names = [names_raw[k] for k in sorted(names_raw.keys())]
        elif isinstance(names_raw, list):
            names = list(names_raw)
        else:
            names = []
        return {"names": names, "nc": data.get("nc", len(names))}
    except Exception:
        return {}


def validate_detection_dataset(dest_dir: Path) -> ValidationResult:
    root = _find_root(dest_dir)
    result = ValidationResult(valid=True)
    
    if not (root / "data.yaml").exists():
        result.errors.append("Missing required file: data.yaml")
        result.valid = False
        return result

    # Parse data.yaml to extract class names
    yaml_info = _parse_data_yaml(root / "data.yaml")
    class_names = yaml_info.get("names", [])
    if not class_names:
        result.warnings.append("data.yaml does not contain class names ('names' field).")
        
    # Check which structure is being used
    structure_a = ["images/train", "images/valid", "labels/train", "labels/valid"]
    structure_b = ["train/images", "valid/images", "train/labels", "valid/labels"]
    
    is_a = all((root / rel).exists() for rel in structure_a)
    is_b = all((root / rel).exists() for rel in structure_b)
    
    if is_a:
        train_img_dir = root / "images/train"
        valid_img_dir = root / "images/valid"
        train_lbl_dir = root / "labels/train"
    elif is_b:
        train_img_dir = root / "train/images"
        valid_img_dir = root / "valid/images"
        train_lbl_dir = root / "train/labels"
    else:
        result.errors.append("Dataset must contain either 'images/train & labels/train' OR 'train/images & train/labels'.")
        result.valid = False
        return result
    
    train_images = [f for f in train_img_dir.iterdir() if f.suffix.lower() in IMG_EXTS]
    valid_images = [f for f in valid_img_dir.iterdir() if f.suffix.lower() in IMG_EXTS]
    train_labels = list(train_lbl_dir.glob("*.txt"))
    
    image_stems = {f.stem for f in train_images}
    label_stems = {f.stem for f in train_labels}
    unlabeled = image_stems - label_stems
    if unlabeled:
        result.warnings.append(f"{len(unlabeled)} training images have no matching label file.")
    
    if not train_images:
        result.errors.append("Training images folder contains no valid images.")
    
    total_images = len(train_images) + len(valid_images)
    result.summary = {
        "num_train_images": len(train_images),
        "num_valid_images": len(valid_images),
        "num_train_labels": len(train_labels),
        "total_images": total_images,
        "classes": class_names,
        "num_classes": len(class_names),
    }
    result.valid = len(result.errors) == 0
    return result


def validate_dataset(zip_path: Path, extract_to: Path, task_type: str) -> ValidationResult:
    try:
        safe_extract_zip(zip_path, extract_to)
    except (zipfile.BadZipFile, ValueError) as e:
        return ValidationResult(valid=False, errors=[str(e)])
    
    if task_type == "classification":
        return validate_classification_dataset(extract_to)
    elif task_type == "detection":
        return validate_detection_dataset(extract_to)
    else:
        return ValidationResult(valid=False, errors=[f"Unknown task_type: {task_type}"])


def cleanup(path: Path) -> None:
    shutil.rmtree(path, ignore_errors=True)
