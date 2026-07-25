# Draw.io Import Templates

Draw.io memiliki fitur luar biasa yang memungkinkan Anda untuk langsung mengkonversi teks berupa kode *Mermaid* menjadi blok diagram interaktif (bisa digeser dan diedit ulang warnanya).

### 🛠️ Cara Memasukkan ke Draw.io
1. Buka [app.diagrams.net](https://app.diagrams.net/) (Draw.io).
2. Di menu bagian atas, klik **Arrange** -> **Insert** -> **Advanced** -> **Mermaid...**
3. Salin (Copy) salah satu kode di bawah ini.
4. Tempel (Paste) ke dalam kotak teks yang muncul di Draw.io, lalu klik **Insert**.

---

## 1. ERD (Entity-Relationship Diagram)
*Pilih salah satu bahasa di bawah ini.*

### 🇮🇩 Versi Indonesia (ERD)
```mermaid
erDiagram
    USER {
        string id PK
        string username UK
        string password
        string peran
        datetime dibuat_pada
    }
    DATASET {
        string id PK
        string nama
        string tipe_task
        string path_folder
        int jumlah_gambar
        string status
    }
    TRAINED_MODEL {
        string id PK
        string dataset_id FK
        string nama
        string arsitektur
        string status
    }
    TRAINING_JOB {
        string id PK
        string model_id FK
        string dataset_id FK
        string status
    }
    INSPECTION_RESULT {
        string id PK
        string model_id FK
        string path_gambar
        string hasil_keputusan
        float tingkat_keyakinan
    }
    INTEGRATION {
        string id PK
        string model_id FK
        string nama
        string tipe
    }
    INTEGRATION_LOG {
        string id PK
        string integration_id FK
        string status
    }
    INSPECTION_TEMPLATE {
        string id PK
        string model_id FK
        string nama
        float batas_keyakinan
    }
    ALERT {
        string id PK
        string model_id FK
        string tipe_peringatan
        string tingkat_keparahan
    }

    DATASET ||--o{ TRAINED_MODEL : "memiliki"
    DATASET ||--o{ TRAINING_JOB : "memiliki"
    TRAINED_MODEL ||--o{ TRAINING_JOB : "dilatih oleh"
    TRAINED_MODEL ||--o{ INSPECTION_RESULT : "menghasilkan"
    TRAINED_MODEL ||--o{ INTEGRATION : "memicu"
    INTEGRATION ||--o{ INTEGRATION_LOG : "mencatat log"
    TRAINED_MODEL ||--o{ INSPECTION_TEMPLATE : "menggunakan"
    TRAINED_MODEL ||--o{ ALERT : "menghasilkan peringatan"
```

### 🇬🇧 English Version (ERD)
```mermaid
erDiagram
    USER {
        string id PK
        string username UK
        string password_hash
        string role
        datetime created_at
    }
    DATASET {
        string id PK
        string name
        string task_type
        string folder_path
        int num_images
        string status
    }
    TRAINED_MODEL {
        string id PK
        string dataset_id FK
        string name
        string architecture
        string status
    }
    TRAINING_JOB {
        string id PK
        string model_id FK
        string dataset_id FK
        string status
    }
    INSPECTION_RESULT {
        string id PK
        string model_id FK
        string image_path
        string verdict
        float confidence
    }
    INTEGRATION {
        string id PK
        string model_id FK
        string name
        string type
    }
    INTEGRATION_LOG {
        string id PK
        string integration_id FK
        string status
    }
    INSPECTION_TEMPLATE {
        string id PK
        string model_id FK
        string name
        float threshold
    }
    ALERT {
        string id PK
        string model_id FK
        string alert_type
        string severity
    }

    DATASET ||--o{ TRAINED_MODEL : "has"
    DATASET ||--o{ TRAINING_JOB : "has"
    TRAINED_MODEL ||--o{ TRAINING_JOB : "is trained by"
    TRAINED_MODEL ||--o{ INSPECTION_RESULT : "produces"
    TRAINED_MODEL ||--o{ INTEGRATION : "triggers"
    INTEGRATION ||--o{ INTEGRATION_LOG : "logs"
    TRAINED_MODEL ||--o{ INSPECTION_TEMPLATE : "uses"
    TRAINED_MODEL ||--o{ ALERT : "generates"
```

---

## 2. System Architecture / Pipeline
*Pilih salah satu bahasa di bawah ini. Diagram ini dioptimalkan khusus agar tidak error saat diimpor ke Draw.io.*

### 🇮🇩 Versi Indonesia (Pipeline)
```mermaid
flowchart TD
    subgraph Sumber_Data_Input
        C1[IP Camera RTSP]
        C2[Kamera Lokal / Webcam]
        U1[Upload Gambar]
    end

    subgraph Frontend_NextJS
        UI[Antarmuka Dashboard]
        LM[Layar Live Monitor]
    end

    subgraph Backend_FastAPI
        API[API Gateway]
        TS[Layanan Training]
        IS[Layanan Inspeksi]
        AS[Layanan Peringatan]
        YOLO[Model AI YOLOv8]
        SAM[Model MobileSAM]
        DB[(Database SQLite)]
        FS[(Penyimpanan File)]
    end

    subgraph Integrasi_Output
        WH[Webhook Sistem]
        MQTT[Broker MQTT]
        PLC[Mesin Pabrik PLC]
    end

    C1 -->|Streaming| LM
    C2 -->|Streaming| LM
    U1 -->|Upload| UI
    
    UI -->|REST API| API
    API --> UI
    LM -->|WebSocket| API
    API --> LM
    
    API --- TS
    API --- IS
    API --- AS
    
    TS -->|Melatih Model| YOLO
    TS -->|Simpan Weights| FS
    
    IS -->|Deteksi Objek| YOLO
    IS -->|Segmentasi| SAM
    IS -->|Simpan Gambar| FS
    IS -->|Simpan Hasil| DB
    
    AS -->|Baca Aturan| DB
    API --- DB
    TS --- DB
    
    IS -->|Kirim Sinyal| WH
    IS -->|Kirim Sinyal| MQTT
    MQTT --> PLC
    WH --> PLC
```

### 🇬🇧 English Version (Pipeline)
```mermaid
flowchart TD
    subgraph Input_Data_Sources
        C1[IP Camera RTSP]
        C2[Local Camera / Webcam]
        U1[Upload Images]
    end

    subgraph Frontend_NextJS
        UI[Dashboard UI]
        LM[Live Monitor Screen]
    end

    subgraph Backend_FastAPI
        API[API Gateway]
        TS[Training Service]
        IS[Inspection Service]
        AS[Alert Service]
        YOLO[YOLOv8 AI Models]
        SAM[MobileSAM Model]
        DB[(SQLite Database)]
        FS[(Local File Storage)]
    end

    subgraph External_Output
        WH[System Webhook]
        MQTT[MQTT Broker]
        PLC[Factory PLC Machine]
    end

    C1 -->|Video Stream| LM
    C2 -->|Video Stream| LM
    U1 -->|Upload Data| UI
    
    UI -->|RESTful API| API
    API --> UI
    LM -->|WebSocket| API
    API --> LM
    
    API --- TS
    API --- IS
    API --- AS
    
    TS -->|Train Model| YOLO
    TS -->|Save Weights| FS
    
    IS -->|Object Detection| YOLO
    IS -->|Segmentation| SAM
    IS -->|Save Image| FS
    IS -->|Save Result| DB
    
    AS -->|Read Rules| DB
    API --- DB
    TS --- DB
    
    IS -->|Send Signal| WH
    IS -->|Send Signal| MQTT
    MQTT --> PLC
    WH --> PLC
```
