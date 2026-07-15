"use client";

import { useState, useEffect, useRef } from "react";
import { getTrainingStatus, getTrainingHistory } from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

function CpuIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"/></svg>; }

export default function TrainingMonitor({ initialJobId = null, onComplete, onDismiss }) {
  const [jobId, setJobId] = useState(initialJobId);
  const [jobStatus, setJobStatus] = useState(null);
  const pollRef = useRef(null);

  // Check for active job on mount if no initialJobId provided
  useEffect(() => {
    if (!jobId) {
      getTrainingHistory().then(history => {
        const activeJob = history.find(j => j.status === "training" || j.status === "queued");
        if (activeJob) {
          setJobId(activeJob.job_id);
        }
      }).catch(console.error);
    }
  }, []);

  // Sync prop changes
  useEffect(() => {
    if (initialJobId) setJobId(initialJobId);
  }, [initialJobId]);

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
      } catch (e) {
        console.error("Polling error:", e);
      }
    }, 3000);
  };

  useEffect(() => {
    if (jobId) {
      // Fetch initial status immediately
      getTrainingStatus(jobId).then(status => {
        setJobStatus(status);
        if (status.status !== "completed" && status.status !== "failed") {
          startPolling(jobId);
        } else {
          if (onComplete) onComplete();
        }
      }).catch(console.error);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
      setJobStatus(null);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobId]);

  if (!jobId && !jobStatus) {
    return (
      <div className="glass-card p-5">
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-4">Training Monitor</h3>
        <div className="py-8 text-center">
          <CpuIcon className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500">No active training job</p>
        </div>
      </div>
    );
  }

  const progress = jobStatus?.progress;
  const progressPct = progress && progress.total_epochs > 0 ? (progress.epoch / progress.total_epochs) * 100 : 0;
  const epochsHistory = progress?.epochs_history || [];

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-4">Training Monitor</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest ${
            jobStatus?.status === "completed" ? "bg-emerald-500/15 text-emerald-400" :
            jobStatus?.status === "failed" ? "bg-red-500/15 text-red-400" :
            jobStatus?.status === "training" ? "bg-blue-500/15 text-blue-400" :
            "bg-amber-500/15 text-amber-400"
          }`}>
            {jobStatus?.status || "queued"}
          </span>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500 rounded-full" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="text-[10px] text-slate-500 mt-1 font-mono text-right">{progressPct.toFixed(0)}%</p>
        </div>

        {/* Metrics */}
        {progress && (
          <div className="grid grid-cols-2 gap-3">
            <div className="surface-inset p-3 rounded-lg">
              <div className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Epoch</div>
              <div className="text-lg font-bold text-slate-200 data-mono">{progress.epoch}/{progress.total_epochs}</div>
            </div>
            {progress.loss != null && (
              <div className="surface-inset p-3 rounded-lg">
                <div className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Loss</div>
                <div className="text-lg font-bold text-slate-200 data-mono">{Number(progress.loss).toFixed(4)}</div>
              </div>
            )}
            {progress.accuracy != null && (
              <div className="surface-inset p-3 rounded-lg">
                <div className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Accuracy</div>
                <div className="text-lg font-bold text-emerald-400 data-mono">{(Number(progress.accuracy) * 100).toFixed(1)}%</div>
              </div>
            )}
          </div>
        )}

        {/* Live Chart */}
        {epochsHistory.length > 0 && (
          <div className="mt-2 h-40 w-full bg-slate-900/50 rounded-lg p-2 border border-slate-800">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={epochsHistory} margin={{ top: 5, right: 5, bottom: -10, left: -25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="epoch" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '11px' }} 
                  itemStyle={{ color: '#e2e8f0' }} 
                />
                <Line type="monotone" dataKey="train_loss" name="Train Loss" stroke="#0ea5e9" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {jobStatus?.error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">{jobStatus.error}</div>
        )}

        {(jobStatus?.status === "completed" || jobStatus?.status === "failed") && onDismiss && (
          <button onClick={() => { setJobId(null); setJobStatus(null); onDismiss(); }} className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 transition-colors">
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
