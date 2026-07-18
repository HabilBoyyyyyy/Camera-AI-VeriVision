"use client";

import {useState, useEffect} from "react";
import {
  fetchModels,
  deleteModel,
  getModelDownloadUrl,
  fetchModelVisualizations,
  getTrainingHistory,
} from "@/lib/api";
import TrainingMonitor from "@/components/TrainingMonitor";

function StatusBadge({status}) {
  const cfg = {
    trained:  {cls:"badge-pass",       label:"Deployed"},
    training: {cls:"badge-training",   label:"Training"},
    failed:   {cls:"badge-failed-sm",  label:"Failed"},
  }[status] || {cls:"badge-review", label: status};
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>;
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
    <div className="space-y-6 max-w-5xl mx-auto pb-10 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="material-symbols-outlined text-[22px]" style={{color:"var(--clr-accent)"}}>deployed_code</span>
            <h2 className="text-2xl font-semibold" style={{color:"var(--clr-text)"}}>Models Management</h2>
          </div>
          <p className="text-sm" style={{color:"var(--clr-text-sub)"}}>
            Registry, deployment, and performance monitoring.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="btn-outline" onClick={loadModels}>
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Refresh
          </button>
          <a href="/training" className="btn-primary">
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Training Job
          </a>
        </div>
      </div>

      {/* Training Monitor */}
      {activeJobId && (
        <div className="animate-fade-in stagger-1">
          <TrainingMonitor initialJobId={activeJobId} onComplete={loadModels} onDismiss={() => setActiveJobId(null)} />
        </div>
      )}

      {/* Stats Row */}
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

      {/* Model Registry */}
      <div className="vv-card overflow-hidden">
        {/* Table header */}
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
                  // Main row
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

                  // Expanded details row
                  if (expandedId === m.id) {
                    rows.push(
                      <tr key={m.id + "-exp"} style={{borderBottom:"1px solid var(--clr-border)", background:"var(--clr-surface-low)"}}>
                        <td colSpan={6} className="px-5 py-5">
                          {/* Detail cards */}
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

                          {/* Delete confirm banner */}
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

                          {/* Metrics */}
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

                          {/* Visualizations */}
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
