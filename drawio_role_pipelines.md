# Draw.io Role Workflow Templates

Berikut adalah template *Mermaid* untuk alur kerja (*Workflow / Jobdesk Pipeline*) spesifik berdasarkan pembagian peran **Admin** dan **Inspector**. Diagram ini sangat cocok untuk menggambarkan *SOP* (Standar Operasional Prosedur) dari masing-masing pengguna.

### 🛠️ Cara Memasukkan ke Draw.io
1. Klik **Arrange** -> **Insert** -> **Advanced** -> **Mermaid...**
2. Salin (*Copy*) salah satu kode dari kotak di bawah.
3. Tempel (*Paste*) ke dalam *pop-up* Draw.io dan klik **Insert**.

---

## 1. Pipeline / Alur Kerja ADMIN

Sebagai **Admin**, tugas utamanya berfokus pada manajemen sistem, melatih (training) model kecerdasan buatan, dan mengatur integrasi perangkat keras eksternal.

### 🇮🇩 Versi Indonesia (Admin)
```mermaid
flowchart TD
    Start([Login Admin])
    Menu{Pilih Menu Utama}
    
    Menu -->|Manajemen Model| M1[Kelola Dataset AI]
    M1 --> M2[Mulai Training Model]
    M2 --> M3[Evaluasi Metrik Model]
    
    Menu -->|Konfigurasi Sistem| S1[Manajemen Pengguna]
    Menu -->|Atur Inspeksi| S2[Buat Template Inspeksi]
    Menu -->|Output Eksternal| S3[Atur Webhook & MQTT]
    
    M3 --> End([Selesai])
    S1 --> End
    S2 --> End
    S3 --> End
```

### 🇬🇧 English Version (Admin)
```mermaid
flowchart TD
    Start([Admin Login])
    Menu{Select Main Menu}
    
    Menu -->|Model Management| M1[Manage AI Datasets]
    M1 --> M2[Start Model Training]
    M2 --> M3[Evaluate Model Metrics]
    
    Menu -->|System Config| S1[User Management]
    Menu -->|Setup Inspection| S2[Create Inspection Template]
    Menu -->|External Output| S3[Configure Webhook & MQTT]
    
    M3 --> End([Finish])
    S1 --> End
    S2 --> End
    S3 --> End
```

---

## 2. Pipeline / Alur Kerja INSPECTOR

Sebagai **Inspector** (Operator Lini Produksi), tugas utamanya adalah memantau jalannya sistem deteksi secara *real-time*, menanggapi *alert* jika terjadi cacat (NG) beruntun, serta memvalidasi/melabeli ulang prediksi AI yang kurang akurat untuk bahan *training* selanjutnya.

### 🇮🇩 Versi Indonesia (Inspector)
```mermaid
flowchart TD
    Start([Login Inspector])
    Menu{Pilih Tugas}
    
    Menu -->|Pantau Produksi| P1[Buka Live Monitor]
    P1 --> P2{Ditemukan Cacat?}
    P2 -->|Ya| P3[Sistem Memicu Alert]
    P3 --> P4[Tanggapi / Acknowledge Alert]
    P2 -->|Tidak| P1
    
    Menu -->|Validasi Manual| V1[Lihat Riwayat Inspeksi]
    V1 --> V2[Review Hasil Prediksi AI]
    V2 --> V3[Koreksi Label OK/NG]
    V3 --> V4[Export ke Dataset AI]
    
    P4 --> End([Selesai])
    V4 --> End
```

### 🇬🇧 English Version (Inspector)
```mermaid
flowchart TD
    Start([Inspector Login])
    Menu{Select Task}
    
    Menu -->|Monitor Production| P1[Open Live Monitor]
    P1 --> P2{Defect Found?}
    P2 -->|Yes| P3[System Triggers Alert]
    P3 --> P4[Acknowledge Alert]
    P2 -->|No| P1
    
    Menu -->|Manual Validation| V1[View Inspection History]
    V1 --> V2[Review AI Predictions]
    V2 --> V3[Correct Label OK/NG]
    V3 --> V4[Export to AI Dataset]
    
    P4 --> End([Finish])
    V4 --> End
```
