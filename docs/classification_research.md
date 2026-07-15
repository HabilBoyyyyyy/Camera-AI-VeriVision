# Camera AI — Classification Approach Research & Recommendation

**Task**: Research & select the best classification approach for binary OK/NG visual inspection  
**Owner**: Habil (AI Engineer)  
**Date**: July 2, 2026

---

## 1. Model Comparison

| Criteria | MobileNetV2 | ResNet18 | EfficientNet-B0 | Custom CNN (5-layer) |
|----------|-------------|----------|-----------------|---------------------|
| **Parameters** | 3.4M | 11.7M | 5.3M | ~0.5–1M |
| **File size** | ~14 MB | ~45 MB | ~20 MB | ~4–8 MB |
| **ImageNet Top-1** | 72.0% | 69.8% | 77.1% | N/A |
| **Binary accuracy (small dataset)** | 92–96% | 93–97% | 93–97% | 75–88% |
| **CPU inference** | ~15–25 ms | ~30–50 ms | ~25–40 ms | ~5–10 ms |
| **Min dataset (transfer)** | ~200–500 images | ~200–500 images | ~300–600 images | ~2000+ images |
| **Ease of implementation** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **PyTorch support** | `torchvision.models` | `torchvision.models` | `torchvision.models` | Manual build |
| **Best for** | Speed + edge deploy | Accuracy + simplicity | Balance | Learning only |

### Key Takeaways

- **Custom CNN from scratch** is eliminated — it needs 4–10× more data and will underperform vs. transfer learning. Not worth the effort for a 3-week project.
- **EfficientNet-B0** is the strongest on paper (highest ImageNet accuracy) but slightly more complex (compound scaling, specific preprocessing) and harder to debug for beginners.
- **ResNet18** gives the best raw accuracy for the effort, but is 3× larger than MobileNetV2 — overkill for binary classification on CPU.
- **MobileNetV2** is the sweet spot: small, fast, well-documented, excellent transfer learning performance with tiny datasets, and runs comfortably on CPU.

---

## 2. Framework: PyTorch ✅

| Factor | PyTorch | TensorFlow/Keras |
|--------|---------|------------------|
| Learning curve | Easier, Pythonic | More boilerplate |
| Debugging | Standard Python debugger | Harder (graph mode) |
| Transfer learning | `torchvision.models` — 3 lines | `tf.keras.applications` — similar |
| Community (2024+) | Dominant in research & education | Strong in production/deployment |
| FastAPI integration | Native Python, easy | Also works but heavier |
| Model file format | `.pt` / `.pth` (simple) | `.h5` / SavedModel (more complex) |

> [!IMPORTANT]
> **Recommendation: PyTorch**. It's the standard in education and research, integrates naturally with the FastAPI Python backend, and `torchvision` makes transfer learning trivially simple. Your project doc already specifies PyTorch.

---

## 3. Recommended Approach

### 🏆 Primary: MobileNetV2 + PyTorch Transfer Learning

**Why MobileNetV2 over ResNet18:**
- 3.4× fewer parameters → faster training, faster inference, smaller model file
- Designed for mobile/edge deployment → matches your "on-premise" use case
- With transfer learning on a small binary dataset, accuracy difference vs ResNet18 is negligible (1–2%)
- If MobileNetV2 isn't accurate enough, you can always upgrade to ResNet18 later — the architecture supports swapping models via `model_id`

### Transfer Learning Strategy

```
┌─────────────────────────────────────────────┐
│  MobileNetV2 (pretrained on ImageNet)       │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  Feature Extractor (all conv layers)  │  │
│  │  ❄️ FROZEN — do NOT retrain           │  │
│  │  These already know edges, textures,  │  │
│  │  shapes from ImageNet's 1M+ images    │  │
│  └───────────────────┬───────────────────┘  │
│                      │                       │
│  ┌───────────────────▼───────────────────┐  │
│  │  Classifier Head (final FC layers)    │  │
│  │  🔥 REPLACED + RETRAINED             │  │
│  │                                       │  │
│  │  Original: 1000 classes (ImageNet)    │  │
│  │  Replaced: 2 classes (OK / NG)        │  │
│  │                                       │  │
│  │  nn.Linear(1280, 2)                   │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**Training plan:**
1. Freeze all convolutional layers
2. Replace the final classifier: `model.classifier[1] = nn.Linear(1280, 2)`
3. Train only the classifier for 10–15 epochs (learning rate: 0.001)
4. Optionally unfreeze the last 2–3 convolutional blocks and fine-tune for 5–10 more epochs (learning rate: 0.0001)

### PyTorch Code Skeleton

```python
import torch
import torch.nn as nn
from torchvision import models, transforms
from torch.utils.data import DataLoader
from torchvision.datasets import ImageFolder

# 1. Load pretrained MobileNetV2
model = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.IMAGENET1K_V1)

# 2. Freeze feature extractor
for param in model.features.parameters():
    param.requires_grad = False

# 3. Replace classifier head (1280 → 2 classes)
model.classifier[1] = nn.Linear(1280, 2)

# 4. Define transforms (match ImageNet preprocessing)
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.RandomHorizontalFlip(),          # augmentation
    transforms.RandomRotation(10),              # augmentation
    transforms.ColorJitter(brightness=0.2),     # augmentation
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    ),
])

# 5. Load dataset (folder structure: dataset/OK/*.jpg, dataset/NG/*.jpg)
train_dataset = ImageFolder("dataset/train", transform=transform)
val_dataset   = ImageFolder("dataset/val",   transform=transform)

train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
val_loader   = DataLoader(val_dataset,   batch_size=32, shuffle=False)

# 6. Training setup
criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(model.classifier.parameters(), lr=0.001)

# 7. Training loop
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)

for epoch in range(15):
    model.train()
    for images, labels in train_loader:
        images, labels = images.to(device), labels.to(device)
        outputs = model(images)
        loss = criterion(outputs, labels)
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

    # Validation
    model.eval()
    correct, total = 0, 0
    with torch.no_grad():
        for images, labels in val_loader:
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)
            _, predicted = torch.max(outputs, 1)
            total += labels.size(0)
            correct += (predicted == labels).sum().item()

    print(f"Epoch {epoch+1}: Val Accuracy = {100 * correct / total:.1f}%")

# 8. Save model
torch.save(model.state_dict(), "ai_models/model_scratch_v1.pt")
```

---

## 4. Dataset Requirements

### Minimum Size
| Scenario | Images needed | Expected accuracy |
|----------|:------------:|:-----------------:|
| **Minimum viable** | 200 OK + 200 NG | ~88–92% |
| **Recommended** | 500 OK + 500 NG | ~93–96% |
| **Ideal** | 1000 OK + 1000 NG | ~95–98% |

> [!TIP]
> With aggressive data augmentation, 500 total images can perform nearly as well as 2000 without augmentation.

### Folder Structure
```
dataset/
├── train/          (80% of data)
│   ├── OK/
│   │   ├── ok_001.jpg
│   │   ├── ok_002.jpg
│   │   └── ...
│   └── NG/
│       ├── ng_001.jpg
│       ├── ng_002.jpg
│       └── ...
├── val/            (10% of data)
│   ├── OK/
│   └── NG/
└── test/           (10% of data)
    ├── OK/
    └── NG/
```

### Split Ratios
| Split | Percentage | Purpose |
|-------|:----------:|---------|
| Train | 80% | Model learns from these |
| Validation | 10% | Tune hyperparameters, monitor overfitting |
| Test | 10% | Final accuracy report (never used during training) |

> [!IMPORTANT]
> **Never mix splits!** A test image must never appear in training. Use `random_split()` or manual folder sorting.

---

## 5. Data Augmentation

Essential for small industrial datasets — artificially multiplies your training data:

| Technique | What it does | Why it helps |
|-----------|-------------|--------------|
| `RandomHorizontalFlip()` | Mirror image left-right | Parts can appear from either side |
| `RandomVerticalFlip()` | Mirror top-bottom | Adds orientation variety |
| `RandomRotation(15)` | Rotate ±15° | Parts aren't always perfectly aligned |
| `ColorJitter(brightness=0.2, contrast=0.2)` | Vary lighting | Factory lighting changes throughout the day |
| `RandomResizedCrop(224, scale=(0.8, 1.0))` | Random zoom+crop | Simulates different camera distances |
| `GaussianBlur(kernel_size=3)` | Slight blur | Simulates slight camera defocus |

> [!WARNING]
> **Don't augment test/validation sets!** Only augment training data. Validation and test transforms should only resize + normalize.

---

## 6. Image Preprocessing

| Setting | Value | Reason |
|---------|-------|--------|
| **Input size** | **224 × 224** | Standard for MobileNetV2/ResNet; matches ImageNet pretrained weights |
| **Color space** | RGB | All torchvision models expect RGB |
| **Normalization** | mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225] | ImageNet statistics — must match for transfer learning to work |
| **File format** | JPEG or PNG | Either works; JPEG is smaller for storage |

---

## 7. Common Pitfalls to Avoid

| Pitfall | What goes wrong | How to avoid |
|---------|----------------|--------------|
| **Class imbalance** | 90% OK, 10% NG → model predicts "OK" for everything | Balance the dataset (equal OK/NG), or use weighted loss |
| **Data leakage** | Same image in train + test → inflated accuracy | Split BEFORE augmentation, verify no duplicates |
| **Forgetting to freeze** | Training all layers with tiny dataset → overfitting | Freeze features, only train classifier head |
| **Wrong normalization** | Using [0.5, 0.5, 0.5] instead of ImageNet stats | Always use the pretrained model's expected normalization |
| **Testing on augmented data** | Validation uses flips/rotations → unreliable metrics | Only augment training transforms |
| **Overfitting** | Training accuracy 99%, validation 70% | Use early stopping, dropout, more augmentation |
| **Ignoring confidence** | Model says "OK" with 51% confidence → treated same as 99% | Use `decision_rule.min_confidence_to_pass` from template JSON |

---

## 8. Final Recommendation Summary

```
┌─────────────────────────────────────────────────────┐
│                FINAL DECISION                        │
│                                                      │
│  Model:        MobileNetV2 (pretrained ImageNet)     │
│  Framework:    PyTorch                                │
│  Strategy:     Transfer learning (freeze + retrain)  │
│  Input:        224×224 RGB, ImageNet normalization    │
│  Output:       2 classes (OK=0, NG=1)                │
│  Dataset:      500+ OK + 500+ NG (with augmentation) │
│  Training:     15 epochs classifier, 5–10 fine-tune  │
│  Expected:     93–96% accuracy                        │
│  Inference:    ~15–25ms on CPU                        │
│  Model file:   ~14 MB (.pt)                           │
│                                                      │
│  Backup plan:  If accuracy < 90%, switch to ResNet18 │
│                (same code, change 1 line)             │
└─────────────────────────────────────────────────────┘
```

> [!TIP]
> **For the presentation**: Emphasize that the architecture lets you swap MobileNetV2 → ResNet18 → EfficientNet by changing only the `model_id` in the template JSON — no code change needed. This proves the "configurable, not hardcoded" claim at the AI layer too.
