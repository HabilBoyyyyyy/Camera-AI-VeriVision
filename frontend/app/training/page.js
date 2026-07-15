"use client";

import { useState, useEffect } from "react";
import { fetchDatasets, startTraining, getTrainingHistory, fetchModels } from "@/lib/api";
import TrainingMonitor from "@/components/TrainingMonitor";

function CpuIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"/></svg>; }
function PlayIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>; }
function ClockIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }

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
      const [ds, ms, h] = await Promise.all([fetchDatasets(), fetchModels(), getTrainingHistory()]);
      setDatasets(ds || []);
      setModels(ms || []);
      setHistory(h || []);
    } catch (e) { console.error(e); }
  };

  // Auto-fill model name and task type when dataset changes
  useEffect(() => {
    const ds = datasets.find(d => d.id === selectedDatasetId);
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
    <div className="space-y-8 max-w-5xl mx-auto pb-10">
      {/* Header */}
      <div className="animate-fade-in stagger-1">
        <div className="flex items-center gap-3 mb-1">
          <CpuIcon className="w-5 h-5 text-cyan-500" />
          <h1 className="text-xl font-semibold text-slate-100 tracking-tight">Model Training</h1>
        </div>
        <p className="text-sm text-slate-500 ml-8">Configure and train AI models from your datasets</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config Form */}
        <div className="lg:col-span-2 glass-card p-6 animate-fade-in stagger-2">
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-5">Training Configuration</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Dataset */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Dataset</label>
              <select value={selectedDatasetId} onChange={(e) => setSelectedDatasetId(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 text-sm focus:outline-none focus:border-cyan-500/50">
                <option value="">Select dataset...</option>
                {datasets.map(d => <option key={d.id} value={d.id}>{d.name} ({d.task_type})</option>)}
              </select>
            </div>

            {/* Model Name */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Model Name</label>
              <input type="text" value={modelName} onChange={(e) => setModelName(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 text-sm focus:outline-none focus:border-cyan-500/50" />
            </div>

            {/* Architecture */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Architecture</label>
              <select value={architecture} onChange={(e) => setArchitecture(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 text-sm focus:outline-none focus:border-cyan-500/50">
                {architectures.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {/* Epochs */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Epochs</label>
              <input type="number" min="1" max="1000" value={epochs} onChange={(e) => setEpochs(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 text-sm focus:outline-none focus:border-cyan-500/50" />
            </div>

            {/* Batch Size */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Batch Size</label>
              <input type="number" min="1" max="512" value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 text-sm focus:outline-none focus:border-cyan-500/50" />
            </div>

            {/* Image Size */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Image Size</label>
              <input type="number" min="32" max="1280" value={imageSize} onChange={(e) => setImageSize(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 text-sm focus:outline-none focus:border-cyan-500/50" />
            </div>

            {/* Learning Rate */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Learning Rate</label>
              <input type="number" step="0.0001" min="0.0001" max="1" value={learningRate} onChange={(e) => setLearningRate(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 text-sm focus:outline-none focus:border-cyan-500/50" />
            </div>

            {/* Optimizer */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Optimizer</label>
              <select value={optimizer} onChange={(e) => setOptimizer(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 text-sm focus:outline-none focus:border-cyan-500/50">
                <option value="adam">Adam</option>
                <option value="adamw">AdamW</option>
                <option value="sgd">SGD</option>
              </select>
            </div>

            {/* Early Stopping */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Early Stopping Patience</label>
              <input type="number" min="0" max="100" value={earlyStoppingPatience} onChange={(e) => setEarlyStoppingPatience(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 text-sm focus:outline-none focus:border-cyan-500/50" />
            </div>

            {/* Toggles */}
            <div className="sm:col-span-2 flex flex-wrap gap-6 mt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={pretrained} onChange={(e) => setPretrained(e.target.checked)} className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500" />
                <span className="text-sm text-slate-300">Pretrained Weights</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={horizontalFlip} onChange={(e) => setHorizontalFlip(e.target.checked)} className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500" />
                <span className="text-sm text-slate-300">Horizontal Flip</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={randomCrop} onChange={(e) => setRandomCrop(e.target.checked)} className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500" />
                <span className="text-sm text-slate-300">Random Crop</span>
              </label>
            </div>

            {/* Update Existing */}
            <div className="sm:col-span-2 mt-2 p-4 rounded-xl bg-slate-800/30 border border-slate-700/50">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500" />
                <span className="text-sm font-semibold text-slate-300">Update Existing Model</span>
              </label>
              {updateExisting && (
                <select value={existingModelId} onChange={(e) => setExistingModelId(e.target.value)} className="mt-3 w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 text-sm focus:outline-none focus:border-cyan-500/50">
                  <option value="">Select model to update...</option>
                  {models.filter(m => m.status === "trained").map(m => <option key={m.id} value={m.id}>{m.name} (v{m.version})</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Start Button */}
          <button
            onClick={handleStartTraining}
            disabled={!selectedDatasetId || !modelName || submitting || !!activeJobId}
            className="mt-6 w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/20 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider flex items-center justify-center gap-2"
          >
            <PlayIcon className="w-4 h-4" />
            {submitting ? "Submitting..." : activeJobId ? "Training in Progress..." : "Start Training"}
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
            <div className="px-5 py-3 border-b border-slate-700/30 bg-slate-800/30 flex items-center gap-2">
              <ClockIcon className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-bold text-slate-200">History</h3>
            </div>
            <div className="divide-y divide-slate-800/50 max-h-64 overflow-y-auto">
              {history.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">No training history</div>
              ) : history.map((job) => (
                <div key={job.job_id} className="px-5 py-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-300 truncate">{job.model_name || "Model"}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{new Date(job.started_at || job.created_at).toLocaleString()}</p>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                    job.status === "completed" ? "bg-emerald-500/15 text-emerald-400" :
                    job.status === "failed" ? "bg-red-500/15 text-red-400" :
                    "bg-amber-500/15 text-amber-400"
                  }`}>
                    {job.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
