"use client";

import {useState, useEffect, useRef} from "react";
import {getTrainingStatus, getTrainingHistory} from "@/lib/api";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";

export default function TrainingMonitor({initialJobId = null, onComplete, onDismiss}) {
  const [jobId, setJobId] = useState(initialJobId);
  const [jobStatus, setJobStatus] = useState(null);
  const pollRef = useRef(null);

  // Grab active job on mount if none provided
  useEffect(() => {
    if (!jobId) {
      getTrainingHistory()
        .then(history => {
          const active = history.find(j => j.status === "training" || j.status === "queued");
          if (active) setJobId(active.job_id);
        })
        .catch(console.error);
    }
  }, []);

  // Sync prop
  useEffect(() => { if (initialJobId) setJobId(initialJobId); }, [initialJobId]);

  const startPolling = (id) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const status = await getTrainingStatus(id);
        setJobStatus(status);
        if (status.status === "completed" || status.status === "failed") {
          clearInterval(pollRef.current);
          pollRef.current = null;
          if (onComplete) onComplete();
        }
      } catch (e) { console.error("Polling error:", e); }
    }, 3000);
  };

  useEffect(() => {
    if (jobId) {
      getTrainingStatus(jobId)
        .then(status => {
          setJobStatus(status);
          if (status.status !== "completed" && status.status !== "failed") {
            startPolling(jobId);
          } else {
            if (onComplete) onComplete();
          }
        })
        .catch(console.error);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
      setJobStatus(null);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobId]);

  const progress       = jobStatus?.progress;
  const progressPct    = progress?.total_epochs > 0 ? (progress.epoch / progress.total_epochs) * 100 : 0;
  const epochsHistory  = progress?.epochs_history || [];

  const statusCfg = {
    completed: {badge:"badge-pass",     label:"Completed"},
    failed:    {badge:"badge-fail",     label:"Failed"},
    training:  {badge:"badge-syncing",  label:"Training…"},
    queued:    {badge:"badge-review",   label:"Queued"},
  }[jobStatus?.status] || {badge:"badge-archived", label: jobStatus?.status || "Unknown"};

  // Empty state
  if (!jobId && !jobStatus) {
    return (
      <div className="vv-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-[18px]" style={{color:"var(--clr-text-muted)"}}>memory</span>
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{color:"var(--clr-text-sub)"}}>Training Monitor</h3>
        </div>
        <div className="py-8 text-center">
          <span className="material-symbols-outlined text-[40px] block mb-2" style={{color:"var(--clr-border)"}}>model_training</span>
          <p className="text-xs" style={{color:"var(--clr-text-muted)"}}>No active training job</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vv-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]" style={{color:"var(--clr-accent)"}}>memory</span>
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{color:"var(--clr-text-sub)"}}>Training Monitor</h3>
        </div>
        <span className={`badge ${statusCfg.badge}`}>{statusCfg.label}</span>
      </div>

      <div className="space-y-4">
        {/* Progress Bar */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{color:"var(--clr-text-muted)"}}>
              {progress ? `Epoch ${progress.epoch} / ${progress.total_epochs}` : "Waiting to start…"}
            </span>
            <span className="text-[11px] font-bold font-mono" style={{color:"var(--clr-accent)"}}>
              {progressPct.toFixed(0)}%
            </span>
          </div>
          <div className="pass-rate-bar" style={{height:8}}>
            <div
              className="pass-rate-fill"
              style={{width:`${progressPct}%`, background:"var(--clr-accent)"}}
            />
          </div>
        </div>

        {/* Metrics Grid */}
        {progress && (
          <div className="grid grid-cols-2 gap-3">
            <div className="vv-surface-low p-3 rounded">
              <div className="text-[9px] uppercase tracking-wider font-bold mb-1" style={{color:"var(--clr-text-muted)"}}>Epoch</div>
              <div className="text-lg font-bold font-mono" style={{color:"var(--clr-text)"}}>
                {progress.epoch}<span className="text-sm font-normal opacity-50">/{progress.total_epochs}</span>
              </div>
            </div>
            {progress.loss != null && (
              <div className="vv-surface-low p-3 rounded">
                <div className="text-[9px] uppercase tracking-wider font-bold mb-1" style={{color:"var(--clr-text-muted)"}}>Train Loss</div>
                <div className="text-lg font-bold font-mono" style={{color:"var(--clr-warn)"}}>
                  {Number(progress.loss).toFixed(4)}
                </div>
              </div>
            )}
            {progress.accuracy != null && (
              <div className="vv-surface-low p-3 rounded">
                <div className="text-[9px] uppercase tracking-wider font-bold mb-1" style={{color:"var(--clr-text-muted)"}}>Accuracy</div>
                <div className="text-lg font-bold font-mono" style={{color:"var(--clr-success)"}}>
                  {(Number(progress.accuracy) * 100).toFixed(1)}%
                </div>
              </div>
            )}
            {progress.val_accuracy != null && (
              <div className="vv-surface-low p-3 rounded">
                <div className="text-[9px] uppercase tracking-wider font-bold mb-1" style={{color:"var(--clr-text-muted)"}}>Val Acc</div>
                <div className="text-lg font-bold font-mono" style={{color:"var(--clr-success)"}}>
                  {(Number(progress.val_accuracy) * 100).toFixed(1)}%
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live Chart */}
        {epochsHistory.length > 0 && (
          <div className="mt-2 h-40 w-full rounded overflow-hidden"
            style={{background:"var(--clr-surface-low)", border:"1px solid var(--clr-border)", padding:8}}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={epochsHistory} margin={{top:4, right:4, bottom:-10, left:-25}}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--clr-border)" vertical={false} />
                <XAxis dataKey="epoch" tick={{fill:"var(--clr-text-muted)", fontSize:10}} tickLine={false} axisLine={false} />
                <YAxis tick={{fill:"var(--clr-text-muted)", fontSize:10}} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background:"var(--clr-surface)",
                    border:"1px solid var(--clr-border)",
                    borderRadius:4,
                    fontSize:11,
                    color:"var(--clr-text)",
                  }}
                />
                <Line type="monotone" dataKey="train_loss" name="Train Loss" stroke="var(--clr-warn)" strokeWidth={2} dot={false} isAnimationActive={false} />
                {epochsHistory[0]?.val_loss !== undefined && (
                  <Line type="monotone" dataKey="val_loss" name="Val Loss" stroke="var(--clr-accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Error */}
        {jobStatus?.error && (
          <div className="p-3 rounded text-xs" style={{background:"rgba(186,26,26,.08)", border:"1px solid rgba(186,26,26,.2)", color:"var(--clr-error)"}}>
            {jobStatus.error}
          </div>
        )}

        {/* Dismiss button */}
        {(jobStatus?.status === "completed" || jobStatus?.status === "failed") && onDismiss && (
          <button
            onClick={() => { setJobId(null); setJobStatus(null); onDismiss(); }}
            className="btn-outline w-full justify-center text-xs py-2"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
