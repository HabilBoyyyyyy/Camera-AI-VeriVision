# Entity-Relationship Diagram (ERD) - Camera-AI-VeriVision

Below is the complete ERD of the Camera-AI-VeriVision project based on the `backend/models.py` database schema.

```mermaid
erDiagram
    User {
        String id PK
        String username UK
        String password_hash
        String role
        DateTime created_at
    }

    Dataset {
        String id PK
        String name
        String task_type
        String folder_path
        Integer num_images
        Text classes_json
        String status
        DateTime created_at
        DateTime updated_at
    }

    TrainedModel {
        String id PK
        String name
        String dataset_id FK
        Integer version
        String task_type
        String architecture
        Text config_json
        Text metrics_json
        String weights_path
        String status
        String parent_model_id
        DateTime created_at
    }

    TrainingJob {
        String id PK
        String model_id FK
        String dataset_id FK
        Text config_json
        String status
        Text progress_json
        DateTime started_at
        DateTime completed_at
        Text error_message
    }

    InspectionResult {
        String id PK
        String model_id FK
        String image_path
        String verdict
        Float confidence
        Text details_json
        DateTime created_at
        String review_verdict
        Text review_notes
        String reviewed_by
        DateTime reviewed_at
        Boolean exported_to_dataset
    }

    Integration {
        String id PK
        String name
        String type
        String trigger_on
        String model_id FK
        Boolean is_active
        Text config_json
        DateTime created_at
        DateTime updated_at
    }

    IntegrationLog {
        String id PK
        String integration_id FK
        String inspection_id
        String verdict
        String status
        Text response_text
        DateTime created_at
    }

    InspectionTemplate {
        String id PK
        String name
        Text description
        String model_id FK
        Float threshold
        Text integration_ids_json
        String line_name
        String created_by
        DateTime created_at
        DateTime updated_at
    }

    Alert {
        String id PK
        String alert_type
        String severity
        String title
        Text message
        String icon
        String action_label
        String action_url
        String related_model_id FK
        Boolean is_acknowledged
        String acknowledged_by
        DateTime acknowledged_at
        DateTime expires_at
        Text metadata_json
        DateTime created_at
    }

    %% Relationships
    Dataset ||--o{ TrainedModel : "has"
    Dataset ||--o{ TrainingJob : "has"
    TrainedModel ||--o{ TrainingJob : "is trained by"
    TrainedModel ||--o{ InspectionResult : "produces"
    TrainedModel ||--o{ Integration : "triggers"
    Integration ||--o{ IntegrationLog : "logs"
    TrainedModel ||--o{ InspectionTemplate : "uses"
    TrainedModel ||--o{ Alert : "generates"
```

### Entity & Pipeline Summary:
1. **User**: Stores authentication data and roles (admin / inspector).
2. **Dataset**: Stores image metadata used for training models, with relationships to *TrainedModel* and *TrainingJob*.
3. **TrainedModel**: The core of the AI system. Derived from a *Dataset*, it is used to generate *InspectionResult* (detection results), is linked to *InspectionTemplate*, triggers *Integration*, and is associated with *Alert* for anomalies.
4. **TrainingJob**: Tracks the state and progress of the system while training a *TrainedModel* using data from a *Dataset*.
5. **InspectionResult**: Stores the actual detection results per frame/image (Verdict OK/NG), and provides a Manual Review feature by a *User* which can be exported back to a *Dataset*.
6. **Integration & IntegrationLog**: Manages external connections (Webhook / MQTT) triggered when the model makes a specific detection (e.g., machinery rejecting an item if Verdict = NG). 
7. **InspectionTemplate**: High-level configuration for an inspection scenario (e.g., on "Line Alpha", with a specific confidence threshold).
8. **Alert**: A smart notification system to warn users about issues (e.g., *burst_defect*, *low_yield*).

The pipeline above supports the automation of the entire process: **Data Collection (Dataset) -> AI Model Training (TrainingJob & TrainedModel) -> Real-time Inspection (InspectionResult) -> External Actions (Integration) -> Smart Notifications (Alert)**.
