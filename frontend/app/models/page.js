"use client";

import { useState, useEffect } from "react";
import { fetchModels, deleteModel, getModelDownloadUrl, fetchModelVisualizations, getTrainingHistory } from "@/lib/api";
import TrainingMonitor from "@/components/TrainingMonitor";

function CubeIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.27 6.96 8.73 5.05 8.73-5.05M12 22.08V12"/></svg>; }
function TrashIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>; }
function DownloadIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>; }
function ChevronIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>; }

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
          setVisualizations(prev => ({ ...prev, [id]: data || [] }));
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
      const activeJob = history.find(j => j.status === "training" || j.status === "queued");
      if (activeJob) {
        setActiveJobId(activeJob.job_id);
      } else {
        setActiveJobId(null);
      }
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

  const statusColor = (s) => {
    if (s === "trained") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
    if (s === "training") return "bg-blue-500/15 text-blue-400 border-blue-500/20";
    if (s === "failed") return "bg-red-500/15 text-red-400 border-red-500/20";
    return "bg-slate-500/15 text-slate-400 border-slate-500/20";
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-10">
      <div className="animate-fade-in stagger-1">
        <div className="flex items-center gap-3 mb-1">
          <CubeIcon className="w-5 h-5 text-cyan-500" />
          <h1 className="text-xl font-semibold text-slate-100 tracking-tight">Trained Models</h1>
        </div>
        <p className="text-sm text-slate-500 ml-8">View, manage, and download your trained AI models</p>
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
        <div className="text-center py-20"><p className="text-slate-500 text-sm animate-pulse">Loading models...</p></div>
      ) : models.length === 0 ? (
        <div className="glass-card p-12 text-center animate-fade-in stagger-2">
          <CubeIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No models trained yet</p>
          <p className="text-xs text-slate-600 mt-1">Go to Training to create your first model</p>
        </div>
      ) : (
        <div className="space-y-3 animate-fade-in stagger-2">
          {models.map((m) => (
            <div key={m.id} className="glass-card overflow-hidden">
              <div
                className="px-6 py-4 flex items-center justify-between hover:bg-slate-800/20 transition-colors cursor-pointer"
                onClick={() => handleExpand(m.id)}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/15 to-blue-500/15 border border-cyan-500/20 flex items-center justify-center shrink-0">
                    <CubeIcon className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-200 truncate">{m.name}</h3>
                      <span className="text-[10px] font-mono text-slate-500">v{m.version}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {m.architecture} • {m.task_type} • {new Date(m.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${statusColor(m.status)}`}>{m.status}</span>
                  {m.metrics?.top1_accuracy != null && (
                    <span className="text-sm font-bold text-emerald-400 data-mono">{(m.metrics.top1_accuracy * 100).toFixed(1)}%</span>
                  )}
                  <ChevronIcon className={`w-4 h-4 text-slate-500 transition-transform ${expandedId === m.id ? "rotate-180" : ""}`} />
                </div>
              </div>

              {expandedId === m.id && (
                <div className="px-6 pb-5 bg-slate-800/10 border-t border-slate-800/50">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    <div className="surface-inset p-3 rounded-lg">
                      <div className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Architecture</div>
                      <div className="text-sm font-bold text-slate-200 mt-1">{m.architecture}</div>
                    </div>
                    <div className="surface-inset p-3 rounded-lg">
                      <div className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Task Type</div>
                      <div className="text-sm font-bold text-slate-200 mt-1 capitalize">{m.task_type}</div>
                    </div>
                    <div className="surface-inset p-3 rounded-lg">
                      <div className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Version</div>
                      <div className="text-sm font-bold text-slate-200 mt-1">{m.version}</div>
                    </div>
                    {m.config?.epochs && (
                      <div className="surface-inset p-3 rounded-lg">
                        <div className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Epochs</div>
                        <div className="text-sm font-bold text-slate-200 mt-1">{m.config.epochs}</div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-4">
                    {m.weights_path && (
                      <a
                        href={getModelDownloadUrl(m.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-bold transition-colors border border-cyan-500/20"
                      >
                        <DownloadIcon className="w-3.5 h-3.5" /> Download Weights
                      </a>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(m.id); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold transition-colors border border-red-500/20"
                    >
                      <TrashIcon className="w-3.5 h-3.5" /> Delete Model
                    </button>
                  </div>

                  {deleteConfirm === m.id && (
                    <div className="mt-3 p-3 rounded-lg bg-red-500/5 border border-red-500/20 flex items-center justify-between">
                      <p className="text-xs text-red-300">Permanently delete this model?</p>
                      <div className="flex gap-2">
                        <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1 rounded text-xs font-bold text-slate-400 hover:bg-slate-800">Cancel</button>
                        <button onClick={() => handleDelete(m.id)} className="px-3 py-1 rounded text-xs font-bold bg-red-600 hover:bg-red-500 text-white">Delete</button>
                      </div>
                    </div>
                  )}

                  {/* Visualizations */}
                  {visualizations[m.id] && visualizations[m.id].length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Evaluation Visualizations</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {visualizations[m.id].map((vis, idx) => (
                          <div key={idx} className="surface-inset p-2 rounded-xl flex flex-col group relative">
                            <div className="text-[10px] font-bold text-slate-300 mb-2 truncate px-1">{vis.name}</div>
                            <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-900 border border-slate-700/50">
                              <img src={`http://localhost:8000${vis.url}`} alt={vis.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            </div>
                            <a href={`http://localhost:8000${vis.url}`} target="_blank" rel="noreferrer" className="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/40 backdrop-blur-sm rounded-xl">
                              <span className="px-3 py-1.5 rounded-lg bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/20">View Full Size</span>
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
