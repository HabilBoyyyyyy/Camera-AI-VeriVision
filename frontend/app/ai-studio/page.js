"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  fetchDatasets, uploadDataset, deleteDataset, createDataset,
  startTraining, getTrainingHistory, fetchModels,
  deleteModel, getModelDownloadUrl, fetchModelVisualizations
} from "@/lib/api";
import DatasetExplorer from "@/components/DatasetExplorer";
import CameraCapture from "@/components/CameraCapture";
import TrainingMonitor from "@/components/TrainingMonitor";

const CLASSIFICATION_ARCHS = ["resnet50", "efficientnet_b0"];
const DETECTION_ARCHS = ["yolov8n", "yolov8s"];

function StatusBadge({status}) {
  const cfg = {
    trained:  {cls:"badge-pass",       label:"Deployed"},
    training: {cls:"badge-training",   label:"Training"},
    failed:   {cls:"badge-failed-sm",  label:"Failed"},
  }[status] || {cls:"badge-review", label: status};
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>;
}

// ============================================================================
// DATASETS TAB
// ============================================================================
function DatasetsTab({ onTrainDataset }) {
  const [datasets, setDatasets] = useState([]);
  const [file, setFile] = useState(null);
  const [taskType, setTaskType] = useState("classification");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const [sourceTab, setSourceTab] = useState("upload");
  const [cameraTarget, setCameraTarget] = useState(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [newDsName, setNewDsName] = useState("");
  const [newDsTaskType, setNewDsTaskType] = useState("classification");
  const [creatingDs, setCreatingDs] = useState(false);

  const loadDatasets = async () => {
    try {
      const data = await fetchDatasets();
      setDatasets(data || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadDatasets(); }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("task_type", taskType);
      const result = await uploadDataset(formData);
      setUploadResult(result);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      loadDatasets();
    } catch (err) {
      try {
        const parsed = JSON.parse(err.message);
        setUploadError(parsed);
      } catch {
        setUploadError({errors: [err.message]});
      }
    } finally { setUploading(false); }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDataset(id);
      setDeleteConfirm(null);
      loadDatasets();
    } catch (e) { console.error(e); }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith(".zip")) setFile(f);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="vv-card p-6 animate-fade-in stagger-2">
        <h3 className="text-sm font-semibold mb-5 uppercase tracking-wider" style={{color:"var(--clr-text-sub)"}}>
          Add Data
        </h3>

        <div className="source-tabs mb-5">
          <button
            className={`source-tab ${sourceTab === "upload" ? "active" : ""}`}
            onClick={() => setSourceTab("upload")}
          >
            <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
            Upload File
          </button>
          <button
            className={`source-tab ${sourceTab === "camera" ? "active" : ""}`}
            onClick={() => setSourceTab("camera")}
          >
            <span className="material-symbols-outlined text-[18px]">photo_camera</span>
            Camera Capture
          </button>
        </div>

        {sourceTab === "upload" && (
          <>
            <div className="mb-4">
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{color:"var(--clr-text-muted)"}}>
                Task Type
              </label>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                className="w-full max-w-xs"
              >
                <option value="classification">Classification (OK/NG)</option>
                <option value="detection">Detection (YOLO)</option>
              </select>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className="relative border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-all duration-200"
              style={{
                borderColor: dragOver ? "var(--clr-accent)" : file ? "var(--clr-success)" : "var(--clr-border)",
                background: dragOver ? "rgba(0,140,199,0.05)" : file ? "rgba(22,163,74,0.04)" : "var(--clr-surface-low)",
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => { if (e.target.files[0]) setFile(e.target.files[0]); }}
              />
              <span
                className="material-symbols-outlined block mb-3 text-[48px]"
                style={{color: file ? "var(--clr-success)" : "var(--clr-text-muted)"}}
              >
                {file ? "check_circle" : "cloud_upload"}
              </span>
              {file ? (
                <>
                  <p className="text-sm font-semibold" style={{color:"var(--clr-success)"}}>{file.name}</p>
                  <p className="text-xs mt-1" style={{color:"var(--clr-text-muted)"}}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB — click or drop to replace
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold" style={{color:"var(--clr-text-sub)"}}>Drop your .zip dataset here</p>
                  <p className="text-xs mt-1" style={{color:"var(--clr-text-muted)"}}>or click to browse</p>
                  <p className="text-[10px] mt-3 max-w-sm mx-auto font-mono" style={{color:"var(--clr-text-muted)"}}>
                    {taskType === "classification"
                      ? "Expected: train/(OK,NG)/*.jpg + valid/(OK,NG)/*.jpg"
                      : "Expected: images/ + labels/ + data.yaml"}
                  </p>
                </>
              )}
            </div>

            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="btn-primary mt-4"
            >
              <span className="material-symbols-outlined text-[18px]">
                {uploading ? "hourglass_top" : "upload"}
              </span>
              {uploading ? "Uploading & Validating..." : "Upload Dataset"}
            </button>

            {uploadResult && (
              <div className="mt-4 p-4 rounded" style={{background:"rgba(22,163,74,0.07)", border:"1px solid rgba(22,163,74,0.2)"}}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-[18px]" style={{color:"var(--clr-success)"}}>check_circle</span>
                  <span className="text-sm font-bold" style={{color:"var(--clr-success)"}}>Dataset uploaded successfully!</span>
                </div>
                {uploadResult.summary && (
                  <div className="text-xs space-y-1 mt-2" style={{color:"var(--clr-text-sub)"}}>
                    <p>Total images: <span className="font-mono font-bold">{uploadResult.summary.total_images}</span></p>
                    {uploadResult.summary.classes && (
                      <p>Classes: <span className="font-mono font-bold">{uploadResult.summary.classes.join(", ")}</span></p>
                    )}
                  </div>
                )}
                {uploadResult.warnings?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {uploadResult.warnings.map((w, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs" style={{color:"var(--clr-warn)"}}>
                        <span className="material-symbols-outlined text-[14px] mt-0.5">warning</span>
                        {w}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {uploadError && (
              <div className="mt-4 p-4 rounded" style={{background:"rgba(186,26,26,0.07)", border:"1px solid rgba(186,26,26,0.2)"}}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-[18px]" style={{color:"var(--clr-error)"}}>error</span>
                  <span className="text-sm font-bold" style={{color:"var(--clr-error)"}}>Validation Failed</span>
                </div>
                {uploadError.errors?.map((e, i) => (
                  <p key={i} className="text-xs mt-1" style={{color:"var(--clr-error)"}}>• {e}</p>
                ))}
                {uploadError.warnings?.map((w, i) => (
                  <p key={i} className="text-xs mt-1" style={{color:"var(--clr-warn)"}}>⚠ {w}</p>
                ))}
              </div>
            )}
          </>
        )}

        {sourceTab === "camera" && (
          <div>
            <div className="vv-surface-low p-5 mb-4" style={{borderRadius: 8}}>
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-[18px]" style={{color:"var(--clr-accent)"}}>add_circle</span>
                <span className="text-sm font-semibold" style={{color:"var(--clr-text)"}}>Create New Dataset from Camera</span>
              </div>
              <p className="text-xs mb-4" style={{color:"var(--clr-text-muted)"}}>
                Capture images from your webcam, label them, and save as a new dataset.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1" style={{color:"var(--clr-text-muted)"}}>
                    Dataset Name
                  </label>
                  <input
                    type="text"
                    value={newDsName}
                    onChange={(e) => setNewDsName(e.target.value)}
                    placeholder="e.g. Defect-Samples-July"
                    style={{maxWidth: 320}}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1" style={{color:"var(--clr-text-muted)"}}>
                    Task Type
                  </label>
                  <select value={newDsTaskType} onChange={(e) => setNewDsTaskType(e.target.value)} style={{minWidth: 180}}>
                    <option value="classification">Classification (OK/NG)</option>
                    <option value="detection">Detection (YOLO)</option>
                  </select>
                </div>
              </div>
              <button
                className="btn-primary"
                disabled={!newDsName.trim() || creatingDs}
                onClick={async () => {
                  setCreatingDs(true);
                  try {
                    const result = await createDataset(newDsName.trim(), newDsTaskType);
                    setCameraTarget({id: result.dataset_id, name: result.name, task_type: result.task_type});
                    setShowCameraModal(true);
                    setNewDsName("");
                    loadDatasets();
                  } catch (err) {
                    alert("Failed to create dataset: " + err.message);
                  } finally {
                    setCreatingDs(false);
                  }
                }}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {creatingDs ? "hourglass_top" : "photo_camera"}
                </span>
                {creatingDs ? "Creating…" : "Create & Open Camera"}
              </button>
            </div>

            {datasets.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[18px]" style={{color:"var(--clr-text-muted)"}}>folder_open</span>
                  <span className="text-sm font-semibold" style={{color:"var(--clr-text-sub)"}}>Or add to existing dataset</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {datasets.map(ds => (
                    <button
                      key={ds.id}
                      onClick={() => {
                        setCameraTarget(ds);
                        setShowCameraModal(true);
                      }}
                      className="flex items-center gap-3 p-4 rounded-lg border text-left transition-all"
                      style={{
                        background: "var(--clr-surface-low)",
                        borderColor: "var(--clr-border)",
                        cursor: "pointer",
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = "var(--clr-accent)";
                        e.currentTarget.style.background = "var(--clr-surface)";
                        e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,140,199,0.1)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = "var(--clr-border)";
                        e.currentTarget.style.background = "var(--clr-surface-low)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <span className="material-symbols-outlined text-[28px]" style={{color:"var(--clr-accent)"}}>photo_camera</span>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold truncate" style={{color:"var(--clr-text)"}}>{ds.name}</h4>
                        <p className="text-[11px]" style={{color:"var(--clr-text-muted)"}}>
                          {ds.num_images} images · {ds.task_type}
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-[20px]" style={{color:"var(--clr-text-muted)"}}>chevron_right</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="vv-card overflow-hidden animate-fade-in stagger-3">
        <div className="px-5 py-3 flex items-center justify-between" style={{borderBottom:"1px solid var(--clr-border)", background:"var(--clr-surface-low)"}}>
          <h3 className="text-sm font-semibold" style={{color:"var(--clr-text)"}}>Available Datasets</h3>
          <span className="text-xs font-mono" style={{color:"var(--clr-text-muted)"}}>{datasets.length} total</span>
        </div>

        {datasets.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-[48px] block mb-3" style={{color:"var(--clr-border)"}}>folder_open</span>
            <p className="text-sm" style={{color:"var(--clr-text-muted)"}}>No datasets uploaded yet</p>
          </div>
        ) : (
          <div>
            {datasets.map((ds) => (
              <div key={ds.id}>
                <div
                  className="px-5 py-4 flex items-center justify-between hover:bg-[var(--clr-surface-low)] transition-colors cursor-pointer"
                  style={{borderBottom:"1px solid var(--clr-border)"}}
                  onClick={() => setExpandedId(expandedId === ds.id ? null : ds.id)}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="material-symbols-outlined text-[22px] shrink-0" style={{color:"var(--clr-accent)"}}>folder</span>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold truncate" style={{color:"var(--clr-text)"}}>{ds.name}</h4>
                      <p className="text-[11px] mt-0.5" style={{color:"var(--clr-text-muted)"}}>
                        {ds.num_images} images · {new Date(ds.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`badge ${ds.task_type === "classification" ? "badge-ready" : "badge-syncing"} shrink-0`}>
                      {ds.task_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Cross-tab flow: Train this dataset */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTrainDataset(ds.id);
                      }}
                      className="p-1.5 rounded transition-colors hover:text-[var(--clr-accent)]"
                      style={{color:"var(--clr-text-muted)"}}
                      title="Train this Dataset"
                    >
                      <span className="material-symbols-outlined text-[18px]">model_training</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCameraTarget(ds);
                        setShowCameraModal(true);
                      }}
                      className="p-1.5 rounded transition-colors hover:text-[var(--clr-accent)]"
                      style={{color:"var(--clr-text-muted)"}}
                      title="Camera Capture"
                    >
                      <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(ds.id); }}
                      className="p-1.5 rounded transition-colors hover:text-[var(--clr-error)]"
                      style={{color:"var(--clr-text-muted)"}}
                      title="Delete"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                    <span
                      className={`material-symbols-outlined text-[20px] transition-transform ${expandedId === ds.id ? "rotate-180" : ""}`}
                      style={{color:"var(--clr-text-muted)"}}
                    >
                      expand_more
                    </span>
                  </div>
                </div>

                {expandedId === ds.id && (
                  <div className="px-5 pb-5" style={{background:"var(--clr-surface-low)", borderBottom:"1px solid var(--clr-border)"}}>
                    {ds.classes && (
                      <div className="flex gap-2 mt-3 flex-wrap">
                        {JSON.parse(ds.classes || "[]").map((cls, i) => (
                          <span key={i} className="badge badge-archived">{cls}</span>
                        ))}
                      </div>
                    )}
                    <div className="mt-4">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{color:"var(--clr-text-muted)"}}>Dataset Explorer</h4>
                      <DatasetExplorer datasetId={ds.id} />
                    </div>
                    <p className="text-[10px] mt-4 font-mono" style={{color:"var(--clr-text-muted)"}}>ID: {ds.id}</p>
                  </div>
                )}

                {deleteConfirm === ds.id && (
                  <div className="px-5 py-3 flex items-center justify-between" style={{background:"rgba(186,26,26,0.05)", borderTop:"1px solid rgba(186,26,26,0.15)", borderBottom:"1px solid var(--clr-border)"}}>
                    <p className="text-sm" style={{color:"var(--clr-error)"}}>Delete this dataset permanently?</p>
                    <div className="flex gap-2">
                      <button onClick={() => setDeleteConfirm(null)} className="btn-outline px-3 py-1.5 text-xs">Cancel</button>
                      <button onClick={() => handleDelete(ds.id)} className="btn-primary px-3 py-1.5 text-xs" style={{background:"var(--clr-error)"}}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showCameraModal && cameraTarget && (
        <CameraCapture
          datasetId={cameraTarget.id}
          currentPath=""
          onClose={() => {
            setShowCameraModal(false);
            setCameraTarget(null);
          }}
          onSaved={() => {
            loadDatasets();
            setShowCameraModal(false);
            setCameraTarget(null);
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// TRAINING TAB
// ============================================================================
function TrainingTab({ preselectedDatasetId, onGoToModels }) {
  const [datasets, setDatasets] = useState([]);
  const [models, setModels] = useState([]);
  const [history, setHistory] = useState([]);

  const [selectedDatasetId, setSelectedDatasetId] = useState(preselectedDatasetId || "");
  const [modelName, setModelName] = useState("");
  const [taskType, setTaskType] = useState("classification");
  const [architecture, setArchitecture] = useState("resnet50");
  const [epochs, setEpochs] = useState(50);
  const [batchSize, setBatchSize] = useState(16);
  const [imageSize, setImageSize] = useState(224);
  const [learningRate, setLearningRate] = useState(0.001);
  const [optimizer, setOptimizer] = useState("adam");
  const [pretrained, setPretrained] = useState(true);
  const [earlyStoppingPatience, setEarlyStoppingPatience] = useState(10);
  const [horizontalFlip, setHorizontalFlip] = useState(true);
  const [rotationDeg, setRotationDeg] = useState(10);
  const [brightnessJitter, setBrightnessJitter] = useState(0.2);
  const [randomCrop, setRandomCrop] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [existingModelId, setExistingModelId] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [activeJobId, setActiveJobId] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [ds, ms, h] = await Promise.all([
        fetchDatasets(),
        fetchModels(),
        getTrainingHistory(),
      ]);
      setDatasets(ds || []);
      setModels(ms || []);
      setHistory(h || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (preselectedDatasetId) {
      setSelectedDatasetId(preselectedDatasetId);
    }
  }, [preselectedDatasetId]);

  useEffect(() => {
    const ds = datasets.find((d) => d.id === selectedDatasetId);
    if (ds) {
      setModelName(ds.name);
      setTaskType(ds.task_type);
      setArchitecture(ds.task_type === "classification" ? "resnet50" : "yolov8n");
    }
  }, [selectedDatasetId, datasets]);

  const architectures = taskType === "classification" ? CLASSIFICATION_ARCHS : DETECTION_ARCHS;

  const handleStartTraining = async () => {
    setSubmitting(true);
    try {
      const config = {
        dataset_id: selectedDatasetId,
        model_name: modelName,
        task_type: taskType,
        architecture,
        epochs,
        batch_size: batchSize,
        image_size: imageSize,
        learning_rate: learningRate,
        optimizer,
        pretrained,
        early_stopping_patience: earlyStoppingPatience,
        augmentation: {
          horizontal_flip: horizontalFlip,
          rotation_degrees: rotationDeg,
          brightness_jitter: brightnessJitter,
          random_crop: randomCrop,
        },
        update_existing: updateExisting,
        existing_model_id: updateExisting ? existingModelId : null,
      };
      const result = await startTraining(config);
      setActiveJobId(result.job_id);
      loadData();
    } catch (e) {
      alert("Failed to start training: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
      <div className="lg:col-span-2 vv-card p-6 animate-fade-in stagger-2">
        <h3 className="text-sm font-semibold mb-5 uppercase tracking-wider" style={{color:"var(--clr-text-sub)"}}>
          Training Configuration
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{color:"var(--clr-text-muted)"}}>
              Target Dataset
            </label>
            <select
              value={selectedDatasetId}
              onChange={(e) => setSelectedDatasetId(e.target.value)}
            >
              <option value="">Select dataset...</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.task_type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{color:"var(--clr-text-muted)"}}>
              Model Name
            </label>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="e.g. Weld_Inspector_v1"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{color:"var(--clr-text-muted)"}}>
              Architecture Base
            </label>
            <select value={architecture} onChange={(e) => setArchitecture(e.target.value)}>
              {architectures.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{color:"var(--clr-text-muted)"}}>
              Epochs
            </label>
            <input
              type="number" min="1" max="1000"
              value={epochs}
              onChange={(e) => setEpochs(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{color:"var(--clr-text-muted)"}}>
              Batch Size
            </label>
            <input
              type="number" min="1" max="512"
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{color:"var(--clr-text-muted)"}}>
              Image Size
            </label>
            <input
              type="number" min="32" max="1280"
              value={imageSize}
              onChange={(e) => setImageSize(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{color:"var(--clr-text-muted)"}}>
              Learning Rate
            </label>
            <input
              type="number" step="0.0001" min="0.0001" max="1"
              value={learningRate}
              onChange={(e) => setLearningRate(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{color:"var(--clr-text-muted)"}}>
              Optimizer
            </label>
            <select value={optimizer} onChange={(e) => setOptimizer(e.target.value)}>
              <option value="adam">Adam</option>
              <option value="adamw">AdamW</option>
              <option value="sgd">SGD</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{color:"var(--clr-text-muted)"}}>
              Early Stopping Patience
            </label>
            <input
              type="number" min="0" max="100"
              value={earlyStoppingPatience}
              onChange={(e) => setEarlyStoppingPatience(Number(e.target.value))}
            />
          </div>

          <div className="sm:col-span-2 flex flex-wrap gap-5 mt-1 pt-3" style={{borderTop:"1px solid var(--clr-border)"}}>
            {[
              {label:"Pretrained Weights", val:pretrained, set:setPretrained},
              {label:"Horizontal Flip",   val:horizontalFlip, set:setHorizontalFlip},
              {label:"Random Crop",       val:randomCrop, set:setRandomCrop},
            ].map(({label, val, set}) => (
              <label key={label} className="flex items-center gap-2 cursor-pointer text-sm" style={{color:"var(--clr-text-sub)"}}>
                <input
                  type="checkbox"
                  checked={val}
                  onChange={(e) => set(e.target.checked)}
                  style={{accentColor:"var(--clr-accent)", width:"15px", height:"15px"}}
                />
                {label}
              </label>
            ))}
          </div>

          <div className="sm:col-span-2 mt-2 p-4 rounded" style={{background:"var(--clr-surface-low)", border:"1px solid var(--clr-border)"}}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={updateExisting}
                onChange={(e) => setUpdateExisting(e.target.checked)}
                style={{accentColor:"var(--clr-accent)", width:"15px", height:"15px"}}
              />
              <span className="text-sm font-semibold" style={{color:"var(--clr-text-sub)"}}>
                Update Existing Model
              </span>
            </label>
            {updateExisting && (
              <select
                value={existingModelId}
                onChange={(e) => setExistingModelId(e.target.value)}
                className="mt-3"
              >
                <option value="">Select model to update...</option>
                {models
                  .filter((m) => m.status === "trained")
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} (v{m.version})
                    </option>
                  ))}
              </select>
            )}
          </div>
        </div>

        <button
          onClick={handleStartTraining}
          disabled={!selectedDatasetId || !modelName || submitting || !!activeJobId}
          className="btn-primary mt-6 w-full justify-center py-3"
        >
          <span className="material-symbols-outlined text-[18px]">
            {submitting || activeJobId ? "hourglass_top" : "play_arrow"}
          </span>
          {submitting
            ? "Submitting..."
            : activeJobId
              ? "Training in Progress..."
              : "Initialize Training"}
        </button>
      </div>

      <div className="space-y-6 animate-fade-in stagger-3">
        <TrainingMonitor
          initialJobId={activeJobId}
          onComplete={loadData}
          onDismiss={() => setActiveJobId(null)}
        />
        
        {/* Cross-tab flow: link to Models */}
        <div className="flex justify-end">
          <button onClick={onGoToModels} className="btn-outline text-sm">
            Go to Models <span className="material-symbols-outlined text-[18px] ml-1">arrow_forward</span>
          </button>
        </div>

        <div className="vv-card overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-2" style={{borderBottom:"1px solid var(--clr-border)", background:"var(--clr-surface-low)"}}>
            <span className="material-symbols-outlined text-[18px]" style={{color:"var(--clr-text-muted)"}}>history</span>
            <h3 className="text-sm font-semibold" style={{color:"var(--clr-text)"}}>Training History</h3>
          </div>
          <div className="divide-y max-h-64 overflow-y-auto" style={{divideColor:"var(--clr-border)"}}>
            {history.length === 0 ? (
              <div className="p-8 text-center text-xs" style={{color:"var(--clr-text-muted)"}}>
                No training history
              </div>
            ) : (
              history.map((job) => (
                <div key={job.job_id} className="px-4 py-3 flex items-center justify-between gap-2" style={{borderBottom:"1px solid var(--clr-border)"}}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{color:"var(--clr-text)"}}>
                      {job.model_name || "Model"}
                      {/* Cross-tab flow: view model */}
                      {job.status === "completed" && (
                        <button onClick={onGoToModels} className="ml-2 text-[var(--clr-accent)] hover:underline text-xs font-normal">
                          View Model
                        </button>
                      )}
                    </p>
                    <p className="text-[10px] font-mono" style={{color:"var(--clr-text-muted)"}}>
                      {new Date(job.started_at || job.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className={`badge shrink-0 ${
                    job.status === "completed"
                      ? "badge-pass"
                      : job.status === "failed"
                        ? "badge-fail"
                        : "badge-syncing"
                  }`}>
                    {job.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MODELS TAB
// ============================================================================
function ModelsTab({ onNewTraining }) {
  const [models, setModels] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [visualizations, setVisualizations] = useState({});
  const [activeJobId, setActiveJobId] = useState(null);

  const handleExpand = async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      if (!visualizations[id]) {
        try {
          const data = await fetchModelVisualizations(id);
          setVisualizations((prev) => ({...prev, [id]: data || []}));
        } catch (e) { console.error(e); }
      }
    }
  };

  const loadModels = async () => {
    try {
      const [data, history] = await Promise.all([fetchModels(), getTrainingHistory()]);
      setModels(data || []);
      const active = (history || []).find(j => j.status === "training" || j.status === "queued");
      setActiveJobId(active ? active.job_id : null);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadModels(); }, []);

  const handleDelete = async (id) => {
    try {
      await deleteModel(id);
      setDeleteConfirm(null);
      loadModels();
    } catch (e) { console.error(e); }
  };

  const totalDeployed = models.filter(m => m.status === "trained").length;
  const totalFailed   = models.filter(m => m.status === "failed").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div />
        <div className="flex items-center gap-2 flex-wrap">
          <button className="btn-outline" onClick={loadModels}>
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Refresh
          </button>
          {/* Cross-tab flow */}
          <button className="btn-primary" onClick={onNewTraining}>
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Training Job
          </button>
        </div>
      </div>

      {activeJobId && (
        <div className="animate-fade-in stagger-1">
          <TrainingMonitor initialJobId={activeJobId} onComplete={loadModels} onDismiss={() => setActiveJobId(null)} />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {label:"Total Deployed",      value: totalDeployed, icon:"cloud_upload",   color:"var(--clr-accent)"},
          {label:"Avg. Inference Time", value: "24 ms",        icon:"speed",          color:"var(--clr-accent)"},
          {label:"Failed Checks",       value: totalFailed,    icon:"warning",        color: totalFailed > 0 ? "var(--clr-error)" : "var(--clr-text-muted)"},
        ].map((s) => (
          <div key={s.label} className="vv-card p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{color:"var(--clr-text-muted)"}}>{s.label}</p>
              <p className="text-2xl font-bold" style={{color: s.label === "Failed Checks" && totalFailed > 0 ? "var(--clr-error)" : "var(--clr-text)"}}>{s.value}</p>
            </div>
            <span className="material-symbols-outlined text-[28px]" style={{color:s.color, opacity:0.6}}>{s.icon}</span>
          </div>
        ))}
      </div>

      <div className="vv-card overflow-hidden">
        <div className="px-5 py-3 flex items-center justify-between" style={{borderBottom:"1px solid var(--clr-border)", background:"var(--clr-surface-low)"}}>
          <h3 className="text-sm font-semibold" style={{color:"var(--clr-text)"}}>Model Registry</h3>
          <div className="flex items-center gap-1">
            <button className="p-1.5 rounded transition-colors" style={{color:"var(--clr-text-muted)"}}
              onMouseEnter={e => e.currentTarget.style.background="var(--clr-surface-mid)"}
              onMouseLeave={e => e.currentTarget.style.background=""}>
              <span className="material-symbols-outlined text-[18px]">filter_list</span>
            </button>
            <button className="p-1.5 rounded transition-colors" style={{color:"var(--clr-text-muted)"}}
              onMouseEnter={e => e.currentTarget.style.background="var(--clr-surface-mid)"}
              onMouseLeave={e => e.currentTarget.style.background=""}>
              <span className="material-symbols-outlined text-[18px]">more_vert</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead style={{background:"var(--clr-surface-low)"}}>
              <tr style={{borderBottom:"1px solid var(--clr-border)"}}>
                {["Model Name","Version","Status","Accuracy","Updated","Actions"].map(h => (
                  <th key={h} className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{color:"var(--clr-text-muted)"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1,2,3].map(i => (
                  <tr key={i} style={{borderBottom:"1px solid var(--clr-border)"}}>
                    <td colSpan={6} className="px-5 py-8 text-center">
                      <div className="w-5 h-5 border-2 rounded-full animate-spin mx-auto" style={{borderColor:"var(--clr-border)", borderTopColor:"var(--clr-accent)"}} />
                    </td>
                  </tr>
                ))
              ) : models.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center" style={{color:"var(--clr-text-muted)"}}>
                    No models trained yet. Go to Training to create your first model.
                  </td>
                </tr>
              ) : (
                models.flatMap((m) => {
                  const rows = [];
                  rows.push(
                    <tr
                      key={m.id}
                      style={{
                        borderBottom:"1px solid var(--clr-border)",
                        background: expandedId === m.id ? "var(--clr-surface-low)" : undefined,
                        cursor:"pointer",
                      }}
                      onClick={() => handleExpand(m.id)}
                      onMouseEnter={e => { if (expandedId !== m.id) e.currentTarget.style.background="var(--clr-surface-low)"; }}
                      onMouseLeave={e => { if (expandedId !== m.id) e.currentTarget.style.background=""; }}
                    >
                      <td className="px-5 py-4 font-semibold" style={{color: m.status === "failed" ? "var(--clr-error)" : "var(--clr-text)"}}>{m.name}</td>
                      <td className="px-5 py-4 font-mono text-[12px]" style={{color:"var(--clr-text-muted)"}}>v{m.version}</td>
                      <td className="px-5 py-4"><StatusBadge status={m.status} /></td>
                      <td className="px-5 py-4 font-semibold" style={{color:"var(--clr-text)"}}>
                        {m.metrics?.top1_accuracy != null ? `${(m.metrics.top1_accuracy*100).toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-5 py-4 text-[12px]" style={{color:"var(--clr-text-sub)"}}>
                        {m.created_at ? new Date(m.created_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          {m.weights_path && (
                            <a
                              href={getModelDownloadUrl(m.id)}
                              onClick={e => e.stopPropagation()}
                              title="Download weights"
                              className="p-1.5 rounded transition-colors"
                              style={{color:"var(--clr-text-muted)"}}
                              onMouseEnter={e => { e.currentTarget.style.color="var(--clr-accent)"; e.currentTarget.style.background="var(--clr-surface-mid)"; }}
                              onMouseLeave={e => { e.currentTarget.style.color="var(--clr-text-muted)"; e.currentTarget.style.background=""; }}
                            >
                              <span className="material-symbols-outlined text-[18px]">download</span>
                            </a>
                          )}
                          <button
                            onClick={e => { e.stopPropagation(); setDeleteConfirm(m.id); }}
                            title="Delete model"
                            className="p-1.5 rounded transition-colors"
                            style={{color:"var(--clr-text-muted)"}}
                            onMouseEnter={e => { e.currentTarget.style.color="var(--clr-error)"; e.currentTarget.style.background="rgba(186,26,26,.08)"; }}
                            onMouseLeave={e => { e.currentTarget.style.color="var(--clr-text-muted)"; e.currentTarget.style.background=""; }}
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                          <span
                            className="material-symbols-outlined text-[20px] transition-transform"
                            style={{color:"var(--clr-text-muted)", transform: expandedId===m.id ? "rotate(180deg)" : "rotate(0deg)"}}
                          >expand_more</span>
                        </div>
                      </td>
                    </tr>
                  );

                  if (expandedId === m.id) {
                    rows.push(
                      <tr key={m.id + "-exp"} style={{borderBottom:"1px solid var(--clr-border)", background:"var(--clr-surface-low)"}}>
                        <td colSpan={6} className="px-5 py-5">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                            {[
                              {label:"Architecture", val: m.architecture || "—"},
                              {label:"Task Type",    val: m.task_type || "—"},
                              {label:"Version",      val: m.version || "—"},
                              {label:"Epochs",       val: m.config?.epochs ?? "—"},
                            ].map(({label, val}) => (
                              <div key={label} className="vv-card p-3">
                                <div className="text-[9px] uppercase tracking-wider font-bold mb-1" style={{color:"var(--clr-text-muted)"}}>{label}</div>
                                <div className="text-sm font-semibold capitalize" style={{color:"var(--clr-text)"}}>{val}</div>
                              </div>
                            ))}
                          </div>

                          {deleteConfirm === m.id && (
                            <div className="mb-4 p-3 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                              style={{background:"rgba(186,26,26,.06)", border:"1px solid rgba(186,26,26,.2)", borderRadius:6}}>
                              <p className="text-sm" style={{color:"var(--clr-error)"}}>Permanently delete this model?</p>
                              <div className="flex gap-2">
                                <button onClick={() => setDeleteConfirm(null)} className="btn-outline text-xs px-3 py-1.5">Cancel</button>
                                <button onClick={() => handleDelete(m.id)} className="btn-primary text-xs px-3 py-1.5" style={{background:"var(--clr-error)"}}>Delete</button>
                              </div>
                            </div>
                          )}

                          {m.metrics && Object.keys(m.metrics).length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                              {Object.entries(m.metrics).slice(0,4).map(([k, v]) => (
                                <div key={k} className="vv-card p-3">
                                  <div className="text-[9px] uppercase tracking-wider font-bold mb-1" style={{color:"var(--clr-text-muted)"}}>{k.replace(/_/g," ")}</div>
                                  <div className="text-sm font-bold font-mono" style={{color:"var(--clr-accent)"}}>
                                    {typeof v === "number" ? (v < 1 ? `${(v*100).toFixed(1)}%` : v.toFixed(3)) : v}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {visualizations[m.id]?.length > 0 && (
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{color:"var(--clr-text-muted)"}}>Evaluation Visualizations</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {visualizations[m.id].map((vis, idx) => (
                                  <div key={idx} className="vv-card overflow-hidden group relative">
                                    <div className="text-[10px] font-bold px-3 py-2 truncate" style={{color:"var(--clr-text-sub)", borderBottom:"1px solid var(--clr-border)"}}>{vis.name}</div>
                                    <div className="relative aspect-video overflow-hidden" style={{background:"var(--clr-surface-mid)"}}>
                                      <img src={`http://localhost:8000${vis.url}`} alt={vis.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    </div>
                                    <a href={`http://localhost:8000${vis.url}`} target="_blank" rel="noreferrer"
                                      className="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                      style={{background:"rgba(0,0,0,.4)"}}>
                                      <span className="btn-primary text-xs px-3 py-1.5">Full Size</span>
                                    </a>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {visualizations[m.id]?.length === 0 && (
                            <p className="text-xs" style={{color:"var(--clr-text-muted)"}}>No visualizations available for this model.</p>
                          )}
                        </td>
                      </tr>
                    );
                  }

                  return rows;
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================
function AIStudioContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const tabQuery = searchParams.get('tab');
  const initialTab = ['datasets', 'training', 'models'].includes(tabQuery) ? tabQuery : 'datasets';
  const [activeTab, setActiveTab] = useState(initialTab);

  const [preselectedDatasetId, setPreselectedDatasetId] = useState("");

  const setTab = (tab) => {
    setActiveTab(tab);
    router.replace(`${pathname}?tab=${tab}`, { scroll: false });
  };

  const tabs = [
    { id: 'datasets', label: 'Datasets', icon: 'database' },
    { id: 'training', label: 'Training', icon: 'model_training' },
    { id: 'models', label: 'Models', icon: 'deployed_code' },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10 animate-fade-in">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <span className="material-symbols-outlined text-[22px]" style={{color:"var(--clr-accent)"}}>view_cozy</span>
          <h2 className="text-2xl font-semibold" style={{color:"var(--clr-text)"}}>AI Studio</h2>
        </div>
        <p className="text-sm" style={{color:"var(--clr-text-sub)"}}>
          Manage datasets, train AI models, and monitor deployments
        </p>
      </div>

      <div className="flex gap-1 p-1 rounded-lg w-fit" style={{background:'var(--clr-surface-low)'}}>
        {tabs.map(tab => (
          <button key={tab.id}
            onClick={() => setTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${activeTab === tab.id ? '' : 'hover:bg-[var(--clr-surface-mid)]'}`}
            style={activeTab === tab.id ? {
              background: 'var(--clr-surface)',
              color: 'var(--clr-text)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
            } : {
              color: 'var(--clr-text-muted)'
            }}
          >
            <span className="material-symbols-outlined text-[18px] align-middle mr-1.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {activeTab === 'datasets' && (
          <DatasetsTab
            onTrainDataset={(dsId) => {
              setPreselectedDatasetId(dsId);
              setTab('training');
            }}
          />
        )}
        {activeTab === 'training' && (
          <TrainingTab
            preselectedDatasetId={preselectedDatasetId}
            onGoToModels={() => setTab('models')}
          />
        )}
        {activeTab === 'models' && (
          <ModelsTab
            onNewTraining={() => setTab('training')}
          />
        )}
      </div>
    </div>
  );
}

export default function AIStudioPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center" style={{color:"var(--clr-text-muted)"}}>Loading AI Studio...</div>}>
      <AIStudioContent />
    </Suspense>
  );
}
