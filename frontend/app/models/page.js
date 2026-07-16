"use client";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faCube,
  faDownload,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";

import {useState, useEffect} from "react";
import {
  fetchModels,
  deleteModel,
  getModelDownloadUrl,
  fetchModelVisualizations,
  getTrainingHistory,
} from "@/lib/api";
import TrainingMonitor from "@/components/TrainingMonitor";

function CubeIcon(p) {
  return <FontAwesomeIcon icon={faCube} className={p.className || ""} />;
}
function TrashIcon(p) {
  return <FontAwesomeIcon icon={faTrash} className={p.className || ""} />;
}
function DownloadIcon(p) {
  return <FontAwesomeIcon icon={faDownload} className={p.className || ""} />;
}
function ChevronIcon(p) {
  return <FontAwesomeIcon icon={faChevronDown} className={p.className || ""} />;
}

export default function ModelsPage() {
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
        } catch (e) {
          console.error(e);
        }
      }
    }
  };

  const loadModels = async () => {
    try {
      const data = await fetchModels();
      setModels(data || []);

      const history = await getTrainingHistory();
      const activeJob = history.find(
        (j) => j.status === "training" || j.status === "queued",
      );
      if (activeJob) {
        setActiveJobId(activeJob.job_id);
      } else {
        setActiveJobId(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  const handleDelete = async (id) => {
    try {
      await deleteModel(id);
      setDeleteConfirm(null);
      loadModels();
    } catch (e) {
      console.error(e);
    }
  };

  const statusColor = (s) => {
    if (s === "trained")
      return "bg-[#2fb380]/15 text-[#4fd39a] border-[#2fb380]/25";
    if (s === "training")
      return "bg-[#7a8ba8]/15 text-[#9db3d4] border-[#7a8ba8]/25";
    if (s === "failed")
      return "bg-[#e5484d]/15 text-[#f26e72] border-[#e5484d]/25";
    return "bg-[#3a4149]/15 text-[#8a93a3] border-[#3a4149]/25";
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-10">
      <div className="animate-fade-in stagger-1">
        <div className="flex items-center gap-3 mb-1">
          <CubeIcon className="w-5 h-5 text-[#f5a623]" />
          <h1 className="text-xl font-display font-bold text-[#e4e7eb] tracking-wide uppercase">
            Trained Models
          </h1>
        </div>
        <p className="text-sm text-[#5a6270] ml-8">
          View, manage, and download your trained AI models
        </p>
      </div>

      {activeJobId && (
        <div className="mb-6 animate-fade-in stagger-2">
          <TrainingMonitor
            initialJobId={activeJobId}
            onComplete={loadModels}
            onDismiss={() => setActiveJobId(null)}
          />
        </div>
      )}

      {loading ? (
        <div className="text-center py-20">
          <p className="text-[#5a6270] text-sm animate-pulse">
            Loading models...
          </p>
        </div>
      ) : models.length === 0 ? (
        <div className="glass-card p-12 text-center animate-fade-in stagger-2">
          <CubeIcon className="w-12 h-12 text-[#333b46] mx-auto mb-3" />
          <p className="text-sm text-[#5a6270]">No models trained yet</p>
          <p className="text-xs text-[#3a4149] mt-1">
            Go to Training to create your first model
          </p>
        </div>
      ) : (
        <div className="space-y-3 animate-fade-in stagger-2">
          {models.map((m) => (
            <div key={m.id} className="glass-card overflow-hidden">
              <div
                className="px-6 py-4 flex items-center justify-between hover:bg-[#1e232a] transition-colors cursor-pointer"
                onClick={() => handleExpand(m.id)}>
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded bg-[#f5a623]/10 border border-[#f5a623]/25 flex items-center justify-center shrink-0">
                    <CubeIcon className="w-5 h-5 text-[#f5a623]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-[#dbe0e6] truncate">
                        {m.name}
                      </h3>
                      <span className="text-[10px] font-mono text-[#5a6270]">
                        v{m.version}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#5a6270] mt-0.5">
                      {m.architecture} • {m.task_type} •{" "}
                      {new Date(m.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-sm border uppercase tracking-wider font-mono ${statusColor(m.status)}`}>
                    {m.status}
                  </span>
                  {m.metrics?.top1_accuracy != null && (
                    <span className="text-sm font-bold text-[#4fd39a] data-mono">
                      {(m.metrics.top1_accuracy * 100).toFixed(1)}%
                    </span>
                  )}
                  <ChevronIcon
                    className={`w-4 h-4 text-[#5a6270] transition-transform ${expandedId === m.id ? "rotate-180" : ""}`}
                  />
                </div>
              </div>

              {expandedId === m.id && (
                <div className="px-6 pb-5 bg-[#14171c] border-t border-[#232830]">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    <div className="surface-inset p-3 rounded">
                      <div className="text-[9px] uppercase tracking-wider font-bold text-[#5a6270] font-mono">
                        Architecture
                      </div>
                      <div className="text-sm font-bold text-[#dbe0e6] mt-1">
                        {m.architecture}
                      </div>
                    </div>
                    <div className="surface-inset p-3 rounded">
                      <div className="text-[9px] uppercase tracking-wider font-bold text-[#5a6270] font-mono">
                        Task Type
                      </div>
                      <div className="text-sm font-bold text-[#dbe0e6] mt-1 capitalize">
                        {m.task_type}
                      </div>
                    </div>
                    <div className="surface-inset p-3 rounded">
                      <div className="text-[9px] uppercase tracking-wider font-bold text-[#5a6270] font-mono">
                        Version
                      </div>
                      <div className="text-sm font-bold text-[#dbe0e6] mt-1">
                        {m.version}
                      </div>
                    </div>
                    {m.config?.epochs && (
                      <div className="surface-inset p-3 rounded">
                        <div className="text-[9px] uppercase tracking-wider font-bold text-[#5a6270] font-mono">
                          Epochs
                        </div>
                        <div className="text-sm font-bold text-[#dbe0e6] mt-1">
                          {m.config.epochs}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-4">
                    {m.weights_path && (
                      <a
                        href={getModelDownloadUrl(m.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded bg-[#f5a623]/10 hover:bg-[#f5a623]/20 text-[#f5a623] text-xs font-bold transition-colors border border-[#f5a623]/25">
                        <DownloadIcon className="w-3.5 h-3.5" /> Download
                        Weights
                      </a>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(m.id);
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded bg-[#e5484d]/10 hover:bg-[#e5484d]/20 text-[#f26e72] text-xs font-bold transition-colors border border-[#e5484d]/25">
                      <TrashIcon className="w-3.5 h-3.5" /> Delete Model
                    </button>
                  </div>

                  {deleteConfirm === m.id && (
                    <div className="mt-3 p-3 rounded bg-[#e5484d]/5 border border-[#e5484d]/25 flex items-center justify-between">
                      <p className="text-xs text-[#f26e72]">
                        Permanently delete this model?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-3 py-1 rounded text-xs font-bold text-[#8a93a3] hover:bg-[#232830]">
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="px-3 py-1 rounded text-xs font-bold bg-[#e5484d] hover:bg-[#f26e72] text-white">
                          Delete
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Visualizations */}
                  {visualizations[m.id] && visualizations[m.id].length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-xs font-bold text-[#5a6270] uppercase tracking-wider mb-3 font-mono">
                        Evaluation Visualizations
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {visualizations[m.id].map((vis, idx) => (
                          <div
                            key={idx}
                            className="surface-inset p-2 rounded flex flex-col group relative">
                            <div className="text-[10px] font-bold text-[#8a93a3] mb-2 truncate px-1">
                              {vis.name}
                            </div>
                            <div className="relative aspect-video rounded overflow-hidden bg-[#0f1216] border border-[#2b313a]">
                              <img
                                src={`http://localhost:8000${vis.url}`}
                                alt={vis.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                            </div>
                            <a
                              href={`http://localhost:8000${vis.url}`}
                              target="_blank"
                              rel="noreferrer"
                              className="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-[#0f1216]/60 rounded">
                              <span className="px-3 py-1.5 rounded bg-[#f5a623] text-[#14171c] text-xs font-bold shadow-lg">
                                View Full Size
                              </span>
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
