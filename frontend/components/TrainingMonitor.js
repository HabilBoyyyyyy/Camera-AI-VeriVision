"use client";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faMicrochip} from "@fortawesome/free-solid-svg-icons";

import {useState, useEffect, useRef} from "react";
import {getTrainingStatus, getTrainingHistory} from "@/lib/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

function CpuIcon(p) {
  return <FontAwesomeIcon icon={faMicrochip} className={p.className || ""} />;
}

export default function TrainingMonitor({
  initialJobId = null,
  onComplete,
  onDismiss,
}) {
  const [jobId, setJobId] = useState(initialJobId);
  const [jobStatus, setJobStatus] = useState(null);
  const pollRef = useRef(null);

  // Check for active job on mount if no initialJobId provided
  useEffect(() => {
    if (!jobId) {
      getTrainingHistory()
        .then((history) => {
          const activeJob = history.find(
            (j) => j.status === "training" || j.status === "queued",
          );
          if (activeJob) {
            setJobId(activeJob.job_id);
          }
        })
        .catch(console.error);
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
      getTrainingStatus(jobId)
        .then((status) => {
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
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobId]);

  if (!jobId && !jobStatus) {
    return (
      <div className="glass-card p-5">
        <h3 className="section-label mb-4">Training Monitor</h3>
        <div className="py-8 text-center">
          <CpuIcon className="w-8 h-8 text-[#333b46] mx-auto mb-2" />
          <p className="text-xs text-[#5a6270]">No active training job</p>
        </div>
      </div>
    );
  }

  const progress = jobStatus?.progress;
  const progressPct =
    progress && progress.total_epochs > 0
      ? (progress.epoch / progress.total_epochs) * 100
      : 0;
  const epochsHistory = progress?.epochs_history || [];

  return (
    <div className="glass-card p-5">
      <h3 className="section-label mb-4">Training Monitor</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span
            className={`text-[10px] font-bold px-2 py-1 rounded-sm uppercase tracking-widest font-mono ${
              jobStatus?.status === "completed"
                ? "bg-[#2fb380]/15 text-[#4fd39a]"
                : jobStatus?.status === "failed"
                  ? "bg-[#e5484d]/15 text-[#f26e72]"
                  : jobStatus?.status === "training"
                    ? "bg-[#7a8ba8]/15 text-[#9db3d4]"
                    : "bg-[#f5a623]/15 text-[#f5a623]"
            }`}>
            {jobStatus?.status || "queued"}
          </span>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="pass-rate-bar" style={{height: "8px"}}>
            <div
              className="pass-rate-fill bg-[#f5a623]"
              style={{width: `${progressPct}%`}}
            />
          </div>
          <p className="text-[10px] text-[#5a6270] mt-1 font-mono text-right">
            {progressPct.toFixed(0)}%
          </p>
        </div>

        {/* Metrics */}
        {progress && (
          <div className="grid grid-cols-2 gap-3">
            <div className="surface-inset p-3 rounded">
              <div className="text-[9px] uppercase tracking-wider font-bold text-[#5a6270] font-mono">
                Epoch
              </div>
              <div className="text-lg font-bold text-[#dbe0e6] data-mono">
                {progress.epoch}/{progress.total_epochs}
              </div>
            </div>
            {progress.loss != null && (
              <div className="surface-inset p-3 rounded">
                <div className="text-[9px] uppercase tracking-wider font-bold text-[#5a6270] font-mono">
                  Loss
                </div>
                <div className="text-lg font-bold text-[#dbe0e6] data-mono">
                  {Number(progress.loss).toFixed(4)}
                </div>
              </div>
            )}
            {progress.accuracy != null && (
              <div className="surface-inset p-3 rounded">
                <div className="text-[9px] uppercase tracking-wider font-bold text-[#5a6270] font-mono">
                  Accuracy
                </div>
                <div className="text-lg font-bold text-[#4fd39a] data-mono">
                  {(Number(progress.accuracy) * 100).toFixed(1)}%
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live Chart */}
        {epochsHistory.length > 0 && (
          <div className="mt-2 h-40 w-full bg-[#0f1216] rounded p-2 border border-[#2b313a]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={epochsHistory}
                margin={{top: 5, right: 5, bottom: -10, left: -25}}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#232830"
                  vertical={false}
                />
                <XAxis
                  dataKey="epoch"
                  stroke="#5a6270"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#5a6270"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1e24",
                    border: "1px solid #333b46",
                    borderRadius: "4px",
                    fontSize: "11px",
                  }}
                  itemStyle={{color: "#dbe0e6"}}
                />
                <Line
                  type="monotone"
                  dataKey="train_loss"
                  name="Train Loss"
                  stroke="#f5a623"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {jobStatus?.error && (
          <div className="p-3 rounded bg-[#e5484d]/10 border border-[#e5484d]/30 text-xs text-[#f26e72]">
            {jobStatus.error}
          </div>
        )}

        {(jobStatus?.status === "completed" ||
          jobStatus?.status === "failed") &&
          onDismiss && (
            <button
              onClick={() => {
                setJobId(null);
                setJobStatus(null);
                onDismiss();
              }}
              className="w-full py-2 rounded bg-[#1a1e24] hover:bg-[#232830] text-sm text-[#8a93a3] transition-colors border border-[#2b313a]">
              Dismiss
            </button>
          )}
      </div>
    </div>
  );
}
