# Camera AI — Dataset Recommendations

**Task**: Find datasets for binary OK/NG visual inspection (scratches, cracks, weld defects, etc.)  
**Source**: Kaggle & Roboflow  

Here are the top dataset recommendations for your student bootcamp project. These are chosen for their ease of use with binary classification (OK/NG) and suitability for training with PyTorch and MobileNetV2 on Google Colab.

---

## 🏆 Top Recommendation: Casting Product Image Data (BEST CHOICE)

**This is the fastest path to a working binary classifier for your 3-week timeline.**

- **URL**: [Kaggle: Real-life industrial dataset of casting product](https://www.kaggle.com/datasets/ravirajsinh45/real-life-industrial-dataset-of-casting-product)
- **Images**: 7,348 grayscale images (Submersible pump impeller top-view images: blowholes, pinholes, burrs, shrinkage)
- **Classes**: 2 classes (`ok_front` and `def_front`) — **Already binary OK/NG!**
- **Distribution**: 
  - Train: 6,633 (3,758 defective + 2,875 OK) 
  - Test: 715 (453 defective + 262 OK)
- **Why it's the best**:
  - It is already structured into train/test folders and OK/Defective folders, making it perfectly ready for PyTorch's `ImageFolder`.
  - It contains real industrial data.
  - The image size (512×512 or 300×300) can easily be resized to 224×224 for MobileNetV2.
  - You can start training immediately in Google Colab without complex preprocessing.

**How to use it in Colab:**
```bash
!pip install -q kaggle
# Ensure you upload your kaggle.json API key
!kaggle datasets download -d ravirajsinh45/real-life-industrial-dataset-of-casting-product
!unzip -q real-life-industrial-dataset-of-casting-product.zip
```

---

## Alternative Options

### 2. Synthetic Industrial Metal Surface Defects
- **Source**: Kaggle
- **Images**: 15,000 perfectly balanced images (3,000 per class)
- **Classes**: 5 classes (Normal, Scratch, Crack, Rust, Hole)
- **Binary OK/NG**: Yes. You map the "Normal" class to OK, and combine all other defect classes into NG.
- **Pros**: Very large, clean dataset. Includes a "Normal" class which is essential for binary classification.

### 3. NEU Surface Defect Database
- **URL**: [Kaggle: NEU Surface Defect Database](https://www.kaggle.com/datasets/kaustubhdikshit/neu-surface-defect-database)
- **Images**: 1,800 images (300 per class)
- **Classes**: 6 classes (Crazing, Inclusion, Patches, Pitted Surface, Rolled-in Scale, Scratches)
- **Pros**: A classic benchmark dataset. Excellent for multi-class defect classification.
- **Cons**: *All images are defective.* To use this for binary OK/NG, you would need to source "OK" (normal) metal surface images separately.

### 4. MVTec Anomaly Detection (MVTec AD)
- **URL**: [MVTec AD (Requires registration)](https://www.mvtec.com/company/research/datasets/mvtec-ad)
- **Images**: 5,354 high-resolution color images across 15 categories (e.g., bottle, cable, capsule).
- **Classes**: Normal (train) vs Anomalous (test) per category.
- **Pros**: The industry gold standard. Perfect structure for OK/NG. 
- **Cons**: More advanced setup; better suited for anomaly detection algorithms (like Autoencoders) rather than simple classification, though classification is possible.

### 5. Roboflow Universe Datasets
Roboflow is a great fallback and offers datasets in multiple export formats.
- [Surface Defect Detection (Metal)](https://universe.roboflow.com/metal-surface-defects/surface-defect-detection-boivj)
- [Weld Surface Defect Detection](https://universe.roboflow.com/weld-defect-detection-onlal/weld-surface-defect-detection-884h9)
- [Cast Defect](https://universe.roboflow.com/casting-defects/cast-defect-w5mh1)

---

## Next Steps for the AI Engineer (Habil)

1. Open **Google Colab**.
2. Download the **Casting Product Image Data** dataset.
3. Use the **MobileNetV2 transfer learning code** from our earlier research to train the model.
4. Export the final model as `.pt` and save it to the project's `backend/ai_models/` folder.
