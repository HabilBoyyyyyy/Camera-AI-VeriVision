# Camera AI – Dynamic Software

## Project Objective

This project is based on WINTEQ's "Camera AI – Dynamic Software" use case: a flexible, on-premise AI vision platform that lets industries deploy, train, and scale visual inspection applications without engineers rewriting code for every new customer.

### Business Problem
The legacy Camera AI application relies heavily on hardcoded configurations and business logic, requiring direct source code changes by the development team. This makes the solution difficult to adapt and replicate across different customers, limiting scalability. Maintaining and deploying customized versions increases both development effort and long-term support costs.

### Goal
Transform Camera AI into a flexible, configurable platform that adapts to different customer needs.
Enable users to configure workflows and integrate with external systems without code changes.
Reduce dependency on the development team for routine customization requests.

## Getting Started

**Requirements:** Python 3.11+, Node.js 18+.

```bash
# Backend (FastAPI) — runs on http://localhost:8000
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
python main.py

# Frontend (Next.js) — runs on http://localhost:3000, in a second terminal
cd frontend
npm install
npm run dev
```

Log in with a seeded account: `admin` / `admin123` (full access) or
`inspector` / `inspect123` (operator role). First run downloads the base
YOLO/MobileSAM weights automatically via `ultralytics` — needs internet
access the first time.

Prefer containers? `docker compose up --build` from the repo root runs
both services together — see [DEPLOYMENT.md](./DEPLOYMENT.md).

## System Architecture / Pipeline

The pipeline of the system involves input data sources, frontend interfaces, backend AI services, and external outputs.

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

## Entity-Relationship Diagram (ERD)

The database schema and relations for users, datasets, models, training jobs, and inspection results.

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

## Role Workflows

### Admin Pipeline
As an **Admin**, the primary focus is on system management, training artificial intelligence models, and configuring integrations with external hardware.

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

### Inspector Pipeline
As an **Inspector** (Production Line Operator), the main task is to monitor the detection system in real-time, respond to alerts when consecutive defects (NG) occur, and manually validate or re-label inaccurate AI predictions for future model training.

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

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full guide — recommended
platforms (Vercel for the frontend, Render/Railway/Fly for the backend),
required environment variables, and a single-VPS `docker compose` option.
