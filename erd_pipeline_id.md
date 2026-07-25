# Entity-Relationship Diagram (ERD) - Camera-AI-VeriVision

Berikut adalah ERD keseluruhan dari proyek Camera-AI-VeriVision berdasarkan skema database `backend/models.py`.

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

### Ringkasan Entitas & Alur (Pipeline):
1. **User**: Menyimpan data autentikasi dan peran (admin / inspector).
2. **Dataset**: Menyimpan metadata gambar yang digunakan untuk melatih model, dengan relasi ke *TrainedModel* dan *TrainingJob*.
3. **TrainedModel**: Sentral dari sistem AI. Model ini diturunkan dari sebuah *Dataset*. Digunakan untuk membuat *InspectionResult* (hasil deteksi), dihubungkan dengan *InspectionTemplate*, memicu *Integration*, dan terkait dengan *Alert* jika ada anomali.
4. **TrainingJob**: Menyimpan *state* dan *progress* saat sistem sedang melatih *TrainedModel* menggunakan data dari *Dataset*.
5. **InspectionResult**: Menyimpan hasil nyata deteksi per *frame*/gambar (Verdict OK/NG), serta menyediakan fitur *Manual Review* oleh *User* yang bisa di-export kembali ke *Dataset*.
6. **Integration & IntegrationLog**: Mengelola koneksi eksternal (Webhook / MQTT) yang dipicu ketika model melakukan deteksi tertentu (misal: mesin *reject* barang jika Verdict = NG). 
7. **InspectionTemplate**: Konfigurasi tingkat tinggi untuk skenario inspeksi (misal di *Line Alpha*, dengan threshold keyakinan tertentu).
8. **Alert**: Sistem notifikasi cerdas untuk memperingatkan pengguna tentang masalah (misal *burst_defect*, *low_yield*).

Pipeline di atas mendukung otomatisasi dari proses **Pengumpulan Data (Dataset) -> Training Model AI (TrainingJob & TrainedModel) -> Inspeksi Nyata (InspectionResult) -> Aksi Eksternal (Integration) -> Peringatan Cerdas (Alert)**.
