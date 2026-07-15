# Camera AI — System Architecture Diagram

## High-Level Architecture

```mermaid
graph TB
    subgraph CLIENT["🖥️ Client Layer"]
        DESKTOP["Desktop Browser<br/><small>Configurator/Engineer</small>"]
        MOBILE["Mobile Browser<br/><small>Operator/Viewer</small>"]
    end

    subgraph FRONTEND["⚛️ Frontend — Next.js"]
        DASHBOARD["Dashboard<br/><small>KPI, Analytics, Alerts</small>"]
        LIVEVIEW["Live View<br/><small>Camera Feed + Inspection</small>"]
        TEMPLATEUI["Template Builder<br/><small>Form-based Config UI</small>"]
        RESULTSUI["Results & Models<br/><small>History, Model Mgmt</small>"]
        APIJS["api.js<br/><small>Centralized API Client</small>"]
    end

    subgraph BACKEND["🐍 Backend — FastAPI (Python)"]
        direction TB
        subgraph API["API Layer (Routers)"]
            TMPL_API["templates.py<br/><small>CRUD Templates</small>"]
            INSP_API["inspections.py<br/><small>Run Inspection<br/>+ Image Upload</small>"]
        end
        subgraph SERVICES["Services Layer"]
            EXECUTOR["workflow_executor.py<br/><small>Generic Template Executor</small>"]
            INFERENCE["ai_inference.py<br/><small>Model Loading + Prediction</small>"]
        end
        subgraph SCHEMAS["Validation"]
            PYDANTIC["template_schema.py<br/><small>Pydantic Models</small>"]
        end
    end

    subgraph STORAGE["🗄️ Data Layer"]
        DB[("SQLite / PostgreSQL<br/><small>Templates, Results, Logs</small>")]
        MODELS_DIR["ai_models/<br/><small>.pt model files</small>"]
    end

    subgraph CAMERA["📷 Camera Input"]
        WEBCAM["Webcam<br/><small>getUserMedia API</small>"]
        UPLOAD["Image Upload<br/><small>File input</small>"]
    end

    %% Client to Frontend
    DESKTOP --> DASHBOARD & LIVEVIEW & TEMPLATEUI & RESULTSUI
    MOBILE --> DASHBOARD & LIVEVIEW

    %% Frontend internal
    DASHBOARD & LIVEVIEW & TEMPLATEUI & RESULTSUI --> APIJS

    %% Frontend to Backend
    APIJS -- "REST API<br/>(JSON + FormData)" --> TMPL_API & INSP_API

    %% Camera to Frontend
    WEBCAM -- "Video Stream" --> LIVEVIEW
    UPLOAD -- "Image File" --> LIVEVIEW
    LIVEVIEW -- "captureFrame()<br/>canvas → Blob" --> APIJS

    %% Backend internal
    TMPL_API --> DB
    INSP_API --> EXECUTOR
    EXECUTOR --> INFERENCE
    EXECUTOR -- "Read Template" --> DB
    INFERENCE -- "Load Model" --> MODELS_DIR
    INSP_API -- "Save Result" --> DB

    %% Validation
    TMPL_API --> PYDANTIC
    INSP_API --> PYDANTIC

    %% Styling
    classDef client fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#e2e8f0
    classDef frontend fill:#0f172a,stroke:#06b6d4,stroke-width:2px,color:#e2e8f0
    classDef backend fill:#0f172a,stroke:#8b5cf6,stroke-width:2px,color:#e2e8f0
    classDef storage fill:#1e293b,stroke:#10b981,stroke-width:2px,color:#e2e8f0
    classDef camera fill:#1e293b,stroke:#f59e0b,stroke-width:2px,color:#e2e8f0

    class DESKTOP,MOBILE client
    class DASHBOARD,LIVEVIEW,TEMPLATEUI,RESULTSUI,APIJS frontend
    class TMPL_API,INSP_API,EXECUTOR,INFERENCE,PYDANTIC backend
    class DB,MODELS_DIR storage
    class WEBCAM,UPLOAD camera
```

---

## Inspection Flow — 9 Steps

This traces a single inspection from button click to result displayed:

```mermaid
sequenceDiagram
    participant User as 👤 Operator
    participant Browser as 🌐 Browser
    participant Camera as 📷 Camera
    participant API as 🔌 FastAPI
    participant DB as 🗄️ Database
    participant Executor as ⚙️ Workflow Executor
    participant AI as 🧠 AI Engine

    User->>Browser: 1. Click "Run Inspection"
    Browser->>Camera: 2. captureFrame() via <canvas>
    Camera-->>Browser: JPEG Blob
    Browser->>API: 3. POST /inspections/run/{template_id}<br/>(FormData with image)
    API->>DB: 4. Fetch template JSON
    DB-->>API: Template config
    API->>Executor: 5. run_workflow(template, image)

    Note over Executor: Loop: preprocessing_steps[]
    Executor->>Executor: resize → crop → normalize

    Executor->>AI: 6. classify_image(image, model_id)
    AI-->>Executor: 7. {label, confidence}

    Note over Executor: Apply decision_rule
    Executor->>Executor: confidence ≥ threshold?<br/>→ OK or NG

    Executor->>DB: 8. Save result
    Executor-->>API: {label, confidence, result}
    API-->>Browser: 9. JSON response
    Browser->>User: Update dashboard (no reload)
```

---

## Component Responsibilities

| Component             | Technology    | Responsibility                                            | Owner      |
| --------------------- | ------------- | --------------------------------------------------------- | ---------- |
| **Frontend**          | Next.js       | Dashboard, template builder, live view, results           | **Nabil**  |
| **API Layer**         | FastAPI       | REST endpoints, request validation, routing               | **Darrel** |
| **Workflow Executor** | Python        | Generic template runner — the "no hardcoded logic" engine | **Darrel** |
| **AI Inference**      | PyTorch       | Model loading, image preprocessing, prediction            | **Habil**  |
| **Database**          | SQLite        | Stores templates (config) and results (history)           | **Darrel** |
| **Camera Input**      | WebRTC / File | Captures frames from webcam or accepts uploaded images    | **Nabil**  |

---

## Key Architecture Principles

> [!IMPORTANT]
> **Configuration-driven, not hardcoded**: The same `run_workflow()` function handles every template. New inspection types = new database rows, not new code.

> [!TIP]
> **Separation of concerns**: Frontend never touches AI logic. Backend never renders UI. The API layer is the only bridge between them.

> [!NOTE]
> **Swappable components**: Camera, AI model, and client devices can all be changed independently without affecting other layers.
