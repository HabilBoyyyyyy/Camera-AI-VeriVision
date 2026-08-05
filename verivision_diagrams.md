# VeriVision System Diagrams (Mermaid.js)

All diagrams below are based on the current VeriVision codebase.

---

## 1. Use Case Diagram

```mermaid
graph LR
    subgraph Actors
        Admin((Admin))
        Inspector((Inspector))
        Ollama((Ollama LLM))
        ExtSys((External Systems<br/>Webhook / MQTT))
    end

    subgraph "VeriVision System"
        UC1["Login / Logout"]
        UC2["View Dashboard"]
        UC3["Upload Dataset"]
        UC4["Create Empty Dataset"]
        UC5["Browse & Annotate Images"]
        UC6["Smart Polygon / Box Prompt AI"]
        UC7["Configure & Start Training"]
        UC8["Monitor Training Progress"]
        UC9["View & Download Models"]
        UC10["Run Live Inspection"]
        UC11["Review Inspection Results"]
        UC12["Submit Human Review Verdict"]
        UC13["Export Results to CSV"]
        UC14["View & Acknowledge Alerts"]
        UC15["Generate AI Shift Insight"]
        UC16["Chat with VeriAssist"]
        UC17["Manage Users"]
        UC18["Manage Integrations"]
        UC19["Manage Inspection Templates"]
        UC20["Delete Datasets / Models"]
        UC21["Configure Camera Assignment"]
    end

    Admin --- UC1
    Admin --- UC2
    Admin --- UC3
    Admin --- UC4
    Admin --- UC5
    Admin --- UC6
    Admin --- UC7
    Admin --- UC8
    Admin --- UC9
    Admin --- UC10
    Admin --- UC11
    Admin --- UC12
    Admin --- UC13
    Admin --- UC14
    Admin --- UC15
    Admin --- UC16
    Admin --- UC17
    Admin --- UC18
    Admin --- UC19
    Admin --- UC20
    Admin --- UC21

    Inspector --- UC1
    Inspector --- UC2
    Inspector --- UC9
    Inspector --- UC10
    Inspector --- UC11
    Inspector --- UC12
    Inspector --- UC13
    Inspector --- UC14
    Inspector --- UC15
    Inspector --- UC16

    UC15 -..->|"LLM Insight Generation"| Ollama
    UC16 -..->|"Conversational Fallback"| Ollama
    UC10 -..->|"Dispatch NG/OK Events"| ExtSys
```

---

## 2. Admin Workflow Flowchart

```mermaid
flowchart TD
    A([Admin Login]) --> B{Dashboard Overview}

    B --> C[View Yield, Alerts, Metrics]
    B --> DS[Dataset Management]
    B --> TR[Training Pipeline]
    B --> LI[Live Inspection]
    B --> CFG[System Configuration]

    %% Dataset flow
    DS --> DS1[Upload .zip Dataset]
    DS --> DS2[Create Empty Dataset]
    DS1 --> DS3[Validation & Extraction]
    DS3 --> DS4[Browse Images]
    DS2 --> DS5[Capture from Camera]
    DS5 --> DS4
    DS4 --> DS6[Annotate with ImageLabeler]
    DS6 --> DS7[Smart Polygon - SAM]
    DS6 --> DS8[Box Prompt AI - YOLO World]
    DS6 --> DS9[Manual Bounding Box / Polygon]
    DS7 --> DS10[Save YOLO Annotations]
    DS8 --> DS10
    DS9 --> DS10

    %% Training flow
    TR --> TR1[Select Dataset]
    TR1 --> TR2[Choose Architecture<br/>ResNet50 / EfficientNet / YOLOv8]
    TR2 --> TR3[Set Hyperparameters<br/>Epochs, Batch Size, LR]
    TR3 --> TR4[Start Training Job]
    TR4 --> TR5[Monitor Progress<br/>Loss & mAP Curves]
    TR5 --> TR6{Training Complete?}
    TR6 -->|Yes| TR7[Model Deployed<br/>View Metrics & Visualizations]
    TR6 -->|Failed| TR8[Review Error & Retry]
    TR7 --> TR9[Download .pt Weights]

    %% Live Inspection
    LI --> LI1[Select Template or Model]
    LI1 --> LI2[Start Camera / Upload Image]
    LI2 --> LI3[Run AI Inference]
    LI3 --> LI4{Verdict}
    LI4 -->|OK| LI5[Log Pass Result]
    LI4 -->|NG| LI6[Log Defect + Trigger Integrations]
    LI4 -->|Uncertain| LI7[Flag for Review]
    LI6 --> LI8[Webhook / MQTT Dispatch]

    %% Configuration
    CFG --> CFG1[Manage Users<br/>Add Inspectors]
    CFG --> CFG2[Manage Integrations<br/>Webhooks / MQTT]
    CFG --> CFG3[Manage Templates<br/>Model + Threshold + Camera]
    CFG --> CFG4[View System Diagnostics]

    %% Results Review
    B --> RR[Results Audit]
    RR --> RR1[Filter & Search Results]
    RR1 --> RR2[Review Inspection Detail]
    RR2 --> RR3[Override Verdict<br/>Approve / Reject]
    RR3 --> RR4[Auto-Export to Dataset<br/>Active Learning Loop]
    RR1 --> RR5[Export CSV Report]

    %% Alerts
    B --> AL[Alerts & AI Insights]
    AL --> AL1[View Active Alerts<br/>Burst Defect / Drift / Low Yield]
    AL1 --> AL2[Acknowledge Alerts]
    AL --> AL3[Generate AI Shift Summary<br/>Ollama LLM / Heuristic]

    style A fill:#4CAF50,color:#fff
    style B fill:#1e293b,color:#e2e8f0
    style DS fill:#2563eb,color:#fff
    style TR fill:#7c3aed,color:#fff
    style LI fill:#dc2626,color:#fff
    style CFG fill:#d97706,color:#fff
```

---

## 3. Inspector Workflow Flowchart

```mermaid
flowchart TD
    A([Inspector Login]) --> B{Dashboard}

    B --> C[View Yield Rate & Metrics]
    B --> D[View Active Alerts]

    B --> LI[Live Inspection]
    LI --> LI1[Select Pre-configured Template]
    LI1 --> LI2[Camera Auto-starts<br/>Based on Template Camera ID]
    LI2 --> LI3[Capture or Upload Image]
    LI3 --> LI4[AI Runs Inference<br/>Classification or Detection]
    LI4 --> LI5{Verdict?}
    LI5 -->|OK - Pass| LI6[Green Result Logged]
    LI5 -->|NG - Fail| LI7[Red Defect Logged<br/>Bounding Box Overlay]
    LI5 -->|Uncertain| LI8[Yellow Flag<br/>Needs Human Review]
    LI7 --> LI9[Integrations Fire<br/>Webhook / MQTT Alert]
    LI6 --> LI10[Continue Inspecting]
    LI8 --> LI10
    LI9 --> LI10
    LI10 --> LI3

    B --> RR[Results History]
    RR --> RR1[Browse Past Inspections<br/>Filter by Verdict, Date, Model]
    RR1 --> RR2[Open Inspection Detail]
    RR2 --> RR3{Agree with AI?}
    RR3 -->|Yes| RR4[Approve - Confirm Verdict]
    RR3 -->|No| RR5[Reject - Override Verdict<br/>Add Notes]
    RR4 --> RR6[Image Auto-Exported<br/>to Training Dataset]
    RR5 --> RR6
    RR1 --> RR7[Export Filtered Results<br/>as CSV]

    B --> AL[Alerts]
    AL --> AL1[View Severity-Coded Alerts]
    AL1 --> AL2[Acknowledge Alert]
    AL --> AL3[Request AI Insight<br/>Shift Quality Summary]

    B --> CH[VeriAssist Chatbot]
    CH --> CH1{Question Type?}
    CH1 -->|Structured: yield, defects,<br/>models, count, summary| CH2[Heuristic Engine<br/>Instant Data Tables]
    CH1 -->|Open-ended: why, how,<br/>explain, advice| CH3[Llama 3.2 AI<br/>Conversational Answer]
    CH3 -->|Ollama Offline| CH4[Fallback Message]

    style A fill:#3b82f6,color:#fff
    style B fill:#1e293b,color:#e2e8f0
    style LI fill:#dc2626,color:#fff
    style RR fill:#059669,color:#fff
    style AL fill:#d97706,color:#fff
    style CH fill:#8b5cf6,color:#fff
```

---

## 4. DFD Level 0 (Context Diagram)

```mermaid
graph LR
    Admin((Admin))
    Inspector((Inspector))
    Ollama[("Ollama LLM<br/>(Local)")]
    ExtSys[("External Systems<br/>Webhook / MQTT")]
    FS[("File System<br/>Datasets, Models,<br/>Inspection Images")]

    Admin -->|"Auth credentials,<br/>Datasets, Training configs,<br/>Templates, Integrations"| VV
    VV -->|"Dashboard metrics,<br/>Model status, Alerts,<br/>Training progress"| Admin

    Inspector -->|"Auth credentials,<br/>Inspection images,<br/>Human review verdicts"| VV
    VV -->|"Inspection verdicts,<br/>Results history,<br/>Alerts, Chat responses"| Inspector

    VV -->|"Prompt + System context"| Ollama
    Ollama -->|"AI Insight / Chat response"| VV

    VV -->|"NG/OK event payloads"| ExtSys
    ExtSys -->|"Delivery status"| VV

    VV <-->|"Read/Write images,<br/>model weights, annotations"| FS

    VV["0<br/>VeriVision<br/>System"]

    style VV fill:#2563eb,color:#fff,stroke-width:3px
```

---

## 5. DFD Level 1

```mermaid
graph TB
    Admin((Admin))
    Inspector((Inspector))
    Ollama[("Ollama LLM")]
    ExtSys[("External<br/>Systems")]

    DB[("SQLite DB<br/>verivision.db")]
    FS[("File System<br/>data/")]

    P1["1.0<br/>Authentication<br/>& User Mgmt"]
    P2["2.0<br/>Dataset<br/>Management"]
    P3["3.0<br/>Model Training<br/>Pipeline"]
    P4["4.0<br/>Live Inspection<br/>Engine"]
    P5["5.0<br/>Results &<br/>Review"]
    P6["6.0<br/>Alerts &<br/>AI Analyst"]
    P7["7.0<br/>Chatbot<br/>Assistant"]
    P8["8.0<br/>Integration<br/>Dispatcher"]
    P9["9.0<br/>Template<br/>Management"]

    %% Auth
    Admin -->|"Login / Register users"| P1
    Inspector -->|"Login"| P1
    P1 <-->|"User records,<br/>session data"| DB

    %% Dataset
    Admin -->|"Upload .zip,<br/>Create datasets,<br/>Annotate images"| P2
    P2 <-->|"Dataset metadata"| DB
    P2 <-->|"Image files,<br/>YOLO labels"| FS

    %% Training
    Admin -->|"Training config<br/>(arch, epochs, LR)"| P3
    P2 -->|"Dataset path<br/>& classes"| P3
    P3 <-->|"TrainingJob,<br/>TrainedModel records"| DB
    P3 -->|"Model weights (.pt)"| FS

    %% Inspection
    Admin -->|"Inspection image"| P4
    Inspector -->|"Inspection image"| P4
    P9 -->|"Template config<br/>(model, threshold)"| P4
    P4 -->|"Load model weights"| FS
    P4 -->|"InspectionResult"| DB
    P4 -->|"Save annotated image"| FS
    P4 -->|"NG/OK event"| P8

    %% Results
    Admin -->|"Filter, review"| P5
    Inspector -->|"Filter, review"| P5
    P5 <-->|"InspectionResult,<br/>review verdicts"| DB
    P5 -->|"Export image<br/>to dataset"| FS

    %% Alerts
    P6 -->|"Scan inspection<br/>patterns"| DB
    P6 -->|"Prompt"| Ollama
    Ollama -->|"AI insight text"| P6
    P6 -->|"Alert records"| DB
    Admin -->|"Acknowledge"| P6
    Inspector -->|"Acknowledge"| P6

    %% Chatbot
    Admin -->|"Chat message"| P7
    Inspector -->|"Chat message"| P7
    P7 -->|"Query stats"| DB
    P7 -->|"LLM prompt"| Ollama
    Ollama -->|"LLM response"| P7

    %% Integrations
    Admin -->|"Create/Edit<br/>integrations"| P8
    P8 <-->|"Integration config,<br/>execution logs"| DB
    P8 -->|"HTTP POST / MQTT publish"| ExtSys

    %% Templates
    Admin -->|"Create/Edit<br/>templates"| P9
    P9 <-->|"Template records"| DB

    style P1 fill:#10b981,color:#fff
    style P2 fill:#3b82f6,color:#fff
    style P3 fill:#7c3aed,color:#fff
    style P4 fill:#ef4444,color:#fff
    style P5 fill:#059669,color:#fff
    style P6 fill:#f59e0b,color:#fff
    style P7 fill:#8b5cf6,color:#fff
    style P8 fill:#ec4899,color:#fff
    style P9 fill:#06b6d4,color:#fff
```

---

## 6. DFD Level 2

### 6.1 — Process 2.0: Dataset Management (Detailed)

```mermaid
graph TB
    Admin((Admin))
    DB[("SQLite DB")]
    FS[("File System<br/>data/datasets/")]

    P2_1["2.1<br/>Upload & Validate<br/>ZIP Archive"]
    P2_2["2.2<br/>Create Empty<br/>Dataset Scaffold"]
    P2_3["2.3<br/>Image Browser<br/>& Gallery"]
    P2_4["2.4<br/>Manual Annotation<br/>Bounding Box / Polygon"]
    P2_5["2.5<br/>Smart Polygon<br/>MobileSAM"]
    P2_6["2.6<br/>Box Prompt AI<br/>YOLO-World"]
    P2_7["2.7<br/>Camera Capture<br/>Module"]

    Admin -->|".zip file +<br/>task type"| P2_1
    P2_1 -->|"Validate structure<br/>(train/valid/OK/NG)"| P2_1
    P2_1 -->|"Extract to<br/>data/datasets/{id}"| FS
    P2_1 -->|"Insert Dataset record"| DB

    Admin -->|"Name + task type"| P2_2
    P2_2 -->|"Create folder<br/>structure"| FS
    P2_2 -->|"Insert Dataset record"| DB

    P2_1 --> P2_3
    P2_2 --> P2_3
    P2_3 <-->|"List images"| FS
    P2_3 <-->|"Image metadata"| DB

    Admin -->|"Open ImageLabeler"| P2_4
    P2_3 --> P2_4
    P2_4 -->|"Save YOLO .txt labels"| FS

    Admin -->|"Draw bbox prompt"| P2_5
    P2_5 -->|"MobileSAM inference<br/>→ polygon coords"| P2_4

    Admin -->|"Text prompt +<br/>class label"| P2_6
    P2_6 -->|"YOLO-World detection<br/>→ bboxes"| P2_4

    Admin -->|"Capture frames<br/>from webcam"| P2_7
    P2_7 -->|"Save images to<br/>dataset folder"| FS
    P2_7 -->|"Update image count"| DB

    style P2_1 fill:#3b82f6,color:#fff
    style P2_2 fill:#3b82f6,color:#fff
    style P2_3 fill:#3b82f6,color:#fff
    style P2_4 fill:#3b82f6,color:#fff
    style P2_5 fill:#6366f1,color:#fff
    style P2_6 fill:#6366f1,color:#fff
    style P2_7 fill:#3b82f6,color:#fff
```

### 6.2 — Process 3.0: Model Training Pipeline (Detailed)

```mermaid
graph TB
    Admin((Admin))
    DB[("SQLite DB")]
    FS[("File System<br/>data/models/")]

    P3_1["3.1<br/>Receive Training<br/>Configuration"]
    P3_2["3.2<br/>Create Model &<br/>Job Records"]
    P3_3["3.3<br/>Background<br/>YOLO Training"]
    P3_4["3.4<br/>Epoch Progress<br/>Tracker"]
    P3_5["3.5<br/>Evaluation &<br/>Metrics Collection"]
    P3_6["3.6<br/>Model Versioning<br/>& Deployment"]

    Admin -->|"Dataset ID, Architecture,<br/>Epochs, Batch, LR"| P3_1
    P3_1 -->|"Validate config"| P3_2
    P3_2 -->|"Insert TrainedModel<br/>+ TrainingJob"| DB
    P3_2 -->|"Launch background<br/>thread"| P3_3
    P3_3 -->|"Load dataset from disk"| FS
    P3_3 -->|"Update progress<br/>(epoch, loss, acc)"| P3_4
    P3_4 -->|"Write progress_json"| DB
    P3_3 -->|"Training complete"| P3_5
    P3_5 -->|"Compute accuracy,<br/>mAP50, F1, confusion matrix"| P3_5
    P3_5 -->|"Save metrics_json"| DB
    P3_5 -->|"Save best.pt weights<br/>+ eval plots"| FS
    P3_5 --> P3_6
    P3_6 -->|"Set status = trained,<br/>link parent model,<br/>increment version"| DB

    style P3_1 fill:#7c3aed,color:#fff
    style P3_2 fill:#7c3aed,color:#fff
    style P3_3 fill:#7c3aed,color:#fff
    style P3_4 fill:#7c3aed,color:#fff
    style P3_5 fill:#7c3aed,color:#fff
    style P3_6 fill:#7c3aed,color:#fff
```

### 6.3 — Process 4.0: Live Inspection Engine (Detailed)

```mermaid
graph TB
    User((Admin /<br/>Inspector))
    DB[("SQLite DB")]
    FS[("File System")]
    ExtSys[("External<br/>Systems")]

    P4_1["4.1<br/>Receive Image<br/>& Parameters"]
    P4_2["4.2<br/>Load YOLO Model<br/>Weights"]
    P4_3["4.3<br/>Run Inference<br/>Classification / Detection"]
    P4_4["4.4<br/>Verdict Logic<br/>OK / NG / Uncertain"]
    P4_5["4.5<br/>Save Result<br/>& Annotated Image"]
    P4_6["4.6<br/>Dispatch to<br/>Integration Service"]

    User -->|"Image file,<br/>model_id, threshold"| P4_1
    P4_1 -->|"Save uploaded image"| FS
    P4_1 --> P4_2
    P4_2 -->|"Load best.pt<br/>from disk"| FS
    P4_2 --> P4_3
    P4_3 -->|"Classification:<br/>class probs"| P4_4
    P4_3 -->|"Detection:<br/>bboxes + scores"| P4_4
    P4_4 -->|"If max_conf ≥ threshold<br/>& class = OK → OK"| P4_5
    P4_4 -->|"If any NG detection<br/>found → NG"| P4_5
    P4_4 -->|"If max_conf < threshold<br/>→ Uncertain"| P4_5
    P4_5 -->|"Insert InspectionResult"| DB
    P4_5 -->|"Save annotated image<br/>with overlays"| FS
    P4_5 --> P4_6
    P4_6 -->|"Match active integrations<br/>by trigger_on"| DB
    P4_6 -->|"Fire Webhook POST<br/>or MQTT Publish"| ExtSys
    P4_6 -->|"Log execution result"| DB

    style P4_1 fill:#ef4444,color:#fff
    style P4_2 fill:#ef4444,color:#fff
    style P4_3 fill:#ef4444,color:#fff
    style P4_4 fill:#ef4444,color:#fff
    style P4_5 fill:#ef4444,color:#fff
    style P4_6 fill:#ec4899,color:#fff
```

### 6.4 — Process 6.0: Alerts & AI Analyst (Detailed)

```mermaid
graph TB
    User((Admin /<br/>Inspector))
    DB[("SQLite DB")]
    Ollama[("Ollama LLM<br/>llama3.2:1b")]

    P6_1["6.1<br/>Alert Engine Scan<br/>(Lazy on GET /alerts)"]
    P6_2["6.2<br/>Burst Defect<br/>Rule (>40% NG)"]
    P6_3["6.3<br/>Data Drift<br/>Rule (8%+ drop)"]
    P6_4["6.4<br/>Low Yield<br/>Rule (<80%)"]
    P6_5["6.5<br/>Uncertainty Triage<br/>Rule (>3 uncertain)"]
    P6_6["6.6<br/>Training Complete<br/>Notification"]
    P6_7["6.7<br/>AI Insight<br/>Generator"]
    P6_8["6.8<br/>Alert<br/>Acknowledgement"]

    User -->|"GET /api/alerts"| P6_1
    P6_1 -->|"Query recent<br/>inspections"| DB
    P6_1 --> P6_2
    P6_1 --> P6_3
    P6_1 --> P6_4
    P6_1 --> P6_5
    P6_1 --> P6_6
    P6_2 -->|"Critical alert"| DB
    P6_3 -->|"Warning alert"| DB
    P6_4 -->|"Warning alert"| DB
    P6_5 -->|"Info alert"| DB
    P6_6 -->|"Info alert"| DB

    User -->|"Request insight"| P6_7
    P6_7 -->|"Build data prompt<br/>+ system stats"| P6_7
    P6_7 -->|"Send to Ollama"| Ollama
    Ollama -->|"Insight text"| P6_7
    P6_7 -->|"Heuristic fallback<br/>if Ollama offline"| P6_7
    P6_7 -->|"Save as alert"| DB

    User -->|"Acknowledge"| P6_8
    P6_8 -->|"Update is_acknowledged"| DB

    style P6_1 fill:#f59e0b,color:#fff
    style P6_2 fill:#dc2626,color:#fff
    style P6_3 fill:#f59e0b,color:#fff
    style P6_4 fill:#f59e0b,color:#fff
    style P6_5 fill:#3b82f6,color:#fff
    style P6_6 fill:#3b82f6,color:#fff
    style P6_7 fill:#8b5cf6,color:#fff
    style P6_8 fill:#6b7280,color:#fff
```

### 6.5 — Process 7.0: Chatbot Assistant (Detailed)

```mermaid
graph TB
    User((Admin /<br/>Inspector))
    DB[("SQLite DB")]
    Ollama[("Ollama LLM<br/>llama3.2:1b")]

    P7_1["7.1<br/>Receive User<br/>Message"]
    P7_2["7.2<br/>Conversational<br/>Bypass Check"]
    P7_3["7.3<br/>TF-IDF + LogReg<br/>Intent Classifier"]
    P7_4["7.4<br/>Heuristic Handler<br/>(yield, defect, count,<br/>model, dataset, training,<br/>summary, help)"]
    P7_5["7.5<br/>Gather System<br/>Context"]
    P7_6["7.6<br/>Ollama LLM<br/>Query"]
    P7_7["7.7<br/>Fallback<br/>Response"]

    User -->|"Chat message"| P7_1
    P7_1 --> P7_2
    P7_2 -->|"Contains: why, how do,<br/>explain, fix, what should"| P7_5
    P7_2 -->|"Normal query"| P7_3
    P7_3 -->|"Confidence ≥ 0.4<br/>Known intent"| P7_4
    P7_3 -->|"Confidence < 0.4<br/>Unknown intent"| P7_5
    P7_4 -->|"Query DB for<br/>yield, defects, etc."| DB
    P7_4 -->|"Structured response<br/>source: heuristic"| User
    P7_5 -->|"Fetch live stats"| DB
    P7_5 --> P7_6
    P7_6 -->|"System prompt +<br/>context + question"| Ollama
    Ollama -->|"Natural language<br/>response"| P7_6
    P7_6 -->|"LLM response<br/>source: llm"| User
    P7_6 -->|"Ollama offline"| P7_7
    P7_7 -->|"Fallback help text<br/>source: heuristic"| User

    style P7_1 fill:#8b5cf6,color:#fff
    style P7_2 fill:#8b5cf6,color:#fff
    style P7_3 fill:#8b5cf6,color:#fff
    style P7_4 fill:#6366f1,color:#fff
    style P7_5 fill:#8b5cf6,color:#fff
    style P7_6 fill:#a855f7,color:#fff
    style P7_7 fill:#6b7280,color:#fff
```
