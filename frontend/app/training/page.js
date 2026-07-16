"use client";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faMicrochip, faPlay} from "@fortawesome/free-solid-svg-icons";

import {useState, useEffect} from "react";
import {
  fetchDatasets,
  startTraining,
  getTrainingHistory,
  fetchModels,
} from "@/lib/api";
import TrainingMonitor from "@/components/TrainingMonitor";

function CpuIcon(p) {
  return <FontAwesomeIcon icon={faMicrochip} className={p.className || ""} />;
}
function PlayIcon(p) {
  return <FontAwesomeIcon icon={faPlay} className={p.className || ""} />;
}
function ClockIcon(p) {
  return (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

const CLASSIFICATION_ARCHS = ["resnet50", "efficientnet_b0"];
const DETECTION_ARCHS = ["yolov8n", "yolov8s"];

export default function TrainingPage() {
  const [datasets, setDatasets] = useState([]);
  const [models, setModels] = useState([]);
  const [history, setHistory] = useState([]);

  // Config form state
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

  // Training state
  const [submitting, setSubmitting] = useState(false);
  const [activeJobId, setActiveJobId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

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
    } catch (e) {
      console.error(e);
    }
  };

  // Auto-fill model name and task type when dataset changes
  useEffect(() => {
    const ds = datasets.find((d) => d.id === selectedDatasetId);
    if (ds) {
      setModelName(ds.name);
      setTaskType(ds.task_type);
      setArchitecture(
        ds.task_type === "classification" ? "resnet50" : "yolov8n",
      );
    }
  }, [selectedDatasetId, datasets]);

  const architectures =
    taskType === "classification" ? CLASSIFICATION_ARCHS : DETECTION_ARCHS;

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

  const fieldClass =
    "w-full px-4 py-2.5 rounded bg-[#0f1216] border border-[#2b313a] text-[#dbe0e6] text-sm focus:outline-none focus:border-[#f5a623]/60 transition-colors";
  const labelClass =
    "block text-xs font-bold text-[#5a6270] uppercase tracking-wider mb-1.5 font-mono";
  const checkboxClass =
    "w-4 h-4 rounded-sm border-[#333b46] bg-[#0f1216] text-[#f5a623] accent-[#f5a623]";

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-10">
      {/* Header */}
      <div className="animate-fade-in stagger-1">
        <div className="flex items-center gap-3 mb-1">
          <CpuIcon className="w-5 h-5 text-[#f5a623]" />
          <h1 className="text-xl font-display font-bold text-[#e4e7eb] tracking-wide uppercase">
            Model Training
          </h1>
        </div>
        <p className="text-sm text-[#5a6270] ml-8">
          Configure and train AI models from your datasets
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config Form */}
        <div className="lg:col-span-2 glass-card p-6 animate-fade-in stagger-2">
          <h2 className="section-label mb-5">Training Configuration</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Dataset */}
            <div className="sm:col-span-2">
              <label className={labelClass}>Dataset</label>
              <select
                value={selectedDatasetId}
                onChange={(e) => setSelectedDatasetId(e.target.value)}
                className={fieldClass}>
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
              <label className={labelClass}>Model Name</label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className={fieldClass}
              />
            </div>

            {/* Architecture */}
            <div>
              <label className={labelClass}>Architecture</label>
              <select
                value={architecture}
                onChange={(e) => setArchitecture(e.target.value)}
                className={fieldClass}>
                {architectures.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            {/* Epochs */}
            <div>
              <label className={labelClass}>Epochs</label>
              <input
                type="number"
                min="1"
                max="1000"
                value={epochs}
                onChange={(e) => setEpochs(Number(e.target.value))}
                className={fieldClass}
              />
            </div>

            {/* Batch Size */}
            <div>
              <label className={labelClass}>Batch Size</label>
              <input
                type="number"
                min="1"
                max="512"
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className={fieldClass}
              />
            </div>

            {/* Image Size */}
            <div>
              <label className={labelClass}>Image Size</label>
              <input
                type="number"
                min="32"
                max="1280"
                value={imageSize}
                onChange={(e) => setImageSize(Number(e.target.value))}
                className={fieldClass}
              />
            </div>

            {/* Learning Rate */}
            <div>
              <label className={labelClass}>Learning Rate</label>
              <input
                type="number"
                step="0.0001"
                min="0.0001"
                max="1"
                value={learningRate}
                onChange={(e) => setLearningRate(Number(e.target.value))}
                className={fieldClass}
              />
            </div>

            {/* Optimizer */}
            <div>
              <label className={labelClass}>Optimizer</label>
              <select
                value={optimizer}
                onChange={(e) => setOptimizer(e.target.value)}
                className={fieldClass}>
                <option value="adam">Adam</option>
                <option value="adamw">AdamW</option>
                <option value="sgd">SGD</option>
              </select>
            </div>

            {/* Early Stopping */}
            <div>
              <label className={labelClass}>Early Stopping Patience</label>
              <input
                type="number"
                min="0"
                max="100"
                value={earlyStoppingPatience}
                onChange={(e) =>
                  setEarlyStoppingPatience(Number(e.target.value))
                }
                className={fieldClass}
              />
            </div>

            {/* Toggles */}
            <div className="sm:col-span-2 flex flex-wrap gap-6 mt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pretrained}
                  onChange={(e) => setPretrained(e.target.checked)}
                  className={checkboxClass}
                />
                <span className="text-sm text-[#8a93a3]">
                  Pretrained Weights
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={horizontalFlip}
                  onChange={(e) => setHorizontalFlip(e.target.checked)}
                  className={checkboxClass}
                />
                <span className="text-sm text-[#8a93a3]">Horizontal Flip</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={randomCrop}
                  onChange={(e) => setRandomCrop(e.target.checked)}
                  className={checkboxClass}
                />
                <span className="text-sm text-[#8a93a3]">Random Crop</span>
              </label>
            </div>

            {/* Update Existing */}
            <div className="sm:col-span-2 mt-2 p-4 rounded bg-[#0f1216] border border-[#2b313a]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateExisting}
                  onChange={(e) => setUpdateExisting(e.target.checked)}
                  className={checkboxClass}
                />
                <span className="text-sm font-semibold text-[#8a93a3]">
                  Update Existing Model
                </span>
              </label>
              {updateExisting && (
                <select
                  value={existingModelId}
                  onChange={(e) => setExistingModelId(e.target.value)}
                  className={`mt-3 ${fieldClass}`}>
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
            disabled={
              !selectedDatasetId || !modelName || submitting || !!activeJobId
            }
            className="mt-6 w-full py-3.5 rounded bg-[#f5a623] hover:bg-[#ffb63f] text-[#14171c] font-bold text-sm shadow-lg transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider flex items-center justify-center gap-2 font-display">
            <PlayIcon className="w-4 h-4" />
            {submitting
              ? "Submitting..."
              : activeJobId
                ? "Training in Progress..."
                : "Start Training"}
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
          <div className="glass-card overflow-hidden">
            <div className="px-5 py-3 border-b border-[#2b313a] bg-[#181c22] flex items-center gap-2">
              <ClockIcon className="w-4 h-4 text-[#8a93a3]" />
              <h3 className="text-sm font-bold text-[#dbe0e6] font-display uppercase tracking-wide">
                History
              </h3>
            </div>
            <div className="divide-y divide-[#232830] max-h-64 overflow-y-auto">
              {history.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#5a6270]">
                  No training history
                </div>
              ) : (
                history.map((job) => (
                  <div
                    key={job.job_id}
                    className="px-5 py-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm text-[#8a93a3] truncate">
                        {job.model_name || "Model"}
                      </p>
                      <p className="text-[10px] text-[#5a6270] font-mono">
                        {new Date(
                          job.started_at || job.created_at,
                        ).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-sm uppercase font-mono ${
                        job.status === "completed"
                          ? "bg-[#2fb380]/15 text-[#4fd39a]"
                          : job.status === "failed"
                            ? "bg-[#e5484d]/15 text-[#f26e72]"
                            : "bg-[#f5a623]/15 text-[#f5a623]"
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
