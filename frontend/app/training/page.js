"use client";

import {useState, useEffect} from "react";
import {
  fetchDatasets,
  startTraining,
  getTrainingHistory,
  fetchModels,
} from "@/lib/api";
import TrainingMonitor from "@/components/TrainingMonitor";

const CLASSIFICATION_ARCHS = ["resnet50", "efficientnet_b0"];
const DETECTION_ARCHS = ["yolov8n", "yolov8s"];

export default function TrainingPage() {
  const [datasets, setDatasets] = useState([]);
  const [models, setModels] = useState([]);
  const [history, setHistory] = useState([]);

  const [selectedDatasetId, setSelectedDatasetId] = useState("");
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
    <div className="space-y-8 max-w-5xl mx-auto pb-10 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <span className="material-symbols-outlined text-[22px]" style={{color:"var(--clr-accent)"}}>model_training</span>
          <h2 className="text-2xl font-semibold" style={{color:"var(--clr-text)"}}>Model Training</h2>
        </div>
        <p className="text-sm" style={{color:"var(--clr-text-sub)"}}>
          Configure and train AI models from your datasets
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config Form */}
        <div className="lg:col-span-2 vv-card p-6 animate-fade-in stagger-2">
          <h3 className="text-sm font-semibold mb-5 uppercase tracking-wider" style={{color:"var(--clr-text-sub)"}}>
            Training Configuration
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Dataset */}
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

            {/* Model Name */}
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

            {/* Architecture */}
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

            {/* Epochs */}
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

            {/* Batch Size */}
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

            {/* Image Size */}
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

            {/* Learning Rate */}
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

            {/* Optimizer */}
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

            {/* Early Stopping */}
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

            {/* Toggles */}
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

            {/* Update Existing */}
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

          {/* Start Button */}
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

        {/* Right Column: Monitor + History */}
        <div className="space-y-6 animate-fade-in stagger-3">
          <TrainingMonitor
            initialJobId={activeJobId}
            onComplete={loadData}
            onDismiss={() => setActiveJobId(null)}
          />

          {/* Training History */}
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
                      <p className="text-sm font-medium truncate" style={{color:"var(--clr-text)"}}>{job.model_name || "Model"}</p>
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
    </div>
  );
}
