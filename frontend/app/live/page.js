"use client";

import {useState, useEffect, useRef} from "react";
import {fetchInspectionModels, runInspection} from "@/lib/api";

export default function LiveInspectionPage() {
  const [models, setModels] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [threshold, setThreshold] = useState(70);
  const [isStreaming, setIsStreaming] = useState(false);
  const [result, setResult] = useState(null);
  const [inspecting, setInspecting] = useState(false);
  const [previewSrc, setPreviewSrc] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    fetchInspectionModels()
      .then((ms) => {
        setModels(ms || []);
        if (ms?.length > 0) setSelectedModelId(ms[0].id);
      })
      .catch(console.error);
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({video: true});
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsStreaming(true);
      setResult(null);
      setPreviewSrc(null);
    } catch (e) {
      alert("Could not access camera: " + e.message);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  };

  const captureAndInspect = async () => {
    if (!videoRef.current || !selectedModelId) return;
    if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
      alert("Camera is still initializing, please wait a moment.");
      return;
    }
    setInspecting(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg");
      setPreviewSrc(dataUrl);
      const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg"));
      if (!blob) throw new Error("Failed to capture image from canvas.");
      const file = new File([blob], "capture.jpg", {type: "image/jpeg"});
      const formData = new FormData();
      formData.append("file", file);
      formData.append("model_id", selectedModelId);
      formData.append("threshold", (threshold / 100).toString());
      const res = await runInspection(formData);
      setResult(res);
    } catch (e) {
      console.error(e);
      alert("Inspection failed: " + e.message);
    } finally {
      setInspecting(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedModelId) return;
    setInspecting(true);
    stopCamera();
    setPreviewSrc(URL.createObjectURL(file));
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("model_id", selectedModelId);
      formData.append("threshold", (threshold / 100).toString());
      const res = await runInspection(formData);
      setResult(res);
    } catch (e) {
      console.error(e);
      alert("Inspection failed: " + e.message);
    } finally {
      setInspecting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const verdictInfo = (v) => {
    if (v === "OK")  return {color:"#16a34a", bg:"rgba(22,163,74,0.1)",  border:"rgba(22,163,74,0.3)",  label:"PASS"};
    if (v === "NG")  return {color:"#ba1a1a", bg:"rgba(186,26,26,0.1)",  border:"rgba(186,26,26,0.3)",  label:"FAIL"};
    return              {color:"#e65100", bg:"rgba(230,81,0,0.1)",    border:"rgba(230,81,0,0.3)",    label:"UNCERTAIN"};
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <span className="material-symbols-outlined text-[22px]" style={{color:"var(--clr-accent)"}}>precision_manufacturing</span>
          <h2 className="text-2xl font-semibold" style={{color:"var(--clr-text)"}}>Live Inspection</h2>
        </div>
        <p className="text-sm" style={{color:"var(--clr-text-sub)"}}>
          Capture or upload images for AI-powered quality inspection
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Camera / Preview Panel */}
        <div className="flex-1 vv-card overflow-hidden flex flex-col">
          {/* Camera Header */}
          <div className="px-4 py-3 flex items-center justify-between shrink-0" style={{borderBottom:"1px solid var(--clr-border)", background:"var(--clr-surface-low)"}}>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isStreaming ? "bg-green-500" : "bg-red-500"}`} />
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{color:"var(--clr-text-sub)"}}>
                {isStreaming ? "Camera Feed: Live" : "Camera Idle"}
              </span>
            </div>
            <span className="text-[11px] font-mono" style={{color:"var(--clr-text-muted)"}}>
              {isStreaming ? "● STREAMING" : "● OFFLINE"}
            </span>
          </div>
          {/* Video area */}
          <div className="relative flex-1 min-h-[420px] flex items-center justify-center" style={{background:"#050a12"}}>
            {/* Grid pattern overlay */}
            <div className="absolute inset-0 pattern-grid opacity-40" />

            {isStreaming && (
              <video ref={videoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover z-10" />
            )}
            {!isStreaming && previewSrc && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewSrc} alt="Preview" className="absolute inset-0 w-full h-full object-contain z-10" />
            )}
            {!isStreaming && !previewSrc && (
              <div className="relative z-10 flex flex-col items-center gap-3 text-center">
                <span className="material-symbols-outlined text-[64px] opacity-20" style={{color:"#94a3b8"}}>videocam_off</span>
                <p className="text-xs uppercase tracking-widest font-semibold" style={{color:"#4a5568"}}>Camera Off</p>
              </div>
            )}

            {/* Verdict overlay */}
            {result && (
              <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                <div
                  className="flex flex-col items-center gap-2 px-10 py-6 rounded-lg border-2"
                  style={{
                    background: verdictInfo(result.verdict).bg,
                    borderColor: verdictInfo(result.verdict).border,
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <span className="text-5xl font-black tracking-widest font-mono" style={{color: verdictInfo(result.verdict).color}}>
                    {verdictInfo(result.verdict).label}
                  </span>
                  <span className="text-lg font-mono" style={{color:"#94a3b8"}}>
                    {(result.confidence * 100).toFixed(1)}% confidence
                  </span>
                </div>
              </div>
            )}

            {/* HUD status badge */}
            <div className="absolute top-3 left-3 z-20 flex items-center gap-2 px-3 py-1.5 rounded" style={{background:"rgba(0,0,0,0.7)", border:"1px solid rgba(255,255,255,0.08)"}}>
              <span className={isStreaming ? "status-dot-active" : "status-dot-danger"} />
              <span className="text-[10px] font-bold tracking-widest uppercase font-mono text-white">
                {isStreaming ? "Live" : "Idle"}
              </span>
            </div>
          </div>

          {/* Bottom actions bar */}
          <div className="px-4 py-3 flex flex-wrap items-center gap-3 shrink-0" style={{borderTop:"1px solid var(--clr-border)", background:"var(--clr-surface-low)"}}>
            <button
              id="btn-toggle-camera"
              onClick={isStreaming ? stopCamera : startCamera}
              disabled={!selectedModelId}
              className="btn-primary"
              style={{
                background: isStreaming ? "var(--clr-error)" : "var(--clr-text)",
                minWidth: "140px",
                justifyContent: "center",
              }}
            >
              <span className="material-symbols-outlined text-[18px]">
                {isStreaming ? "videocam_off" : "videocam"}
              </span>
              {isStreaming ? "Stop Camera" : "Start Camera"}
            </button>

            {isStreaming && (
              <button
                id="btn-capture-inspect"
                onClick={captureAndInspect}
                disabled={inspecting || !selectedModelId}
                className="btn-primary"
                style={{background:"var(--clr-success)", minWidth:"160px", justifyContent:"center"}}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {inspecting ? "hourglass_top" : "center_focus_strong"}
                </span>
                {inspecting ? "Inspecting..." : "Capture & Inspect"}
              </button>
            )}

            <input type="file" accept="image/*" ref={fileRef} className="hidden" onChange={handleFileUpload} />
            <button
              id="btn-upload-image"
              onClick={() => fileRef.current?.click()}
              disabled={!selectedModelId || inspecting}
              className="btn-outline"
            >
              <span className="material-symbols-outlined text-[18px]">upload</span>
              Upload Image
            </button>
          </div>
        </div>

        {/* Controls Panel */}
        <div className="w-full lg:w-72 flex flex-col gap-4">
          {/* Model Selector */}
          <div className="vv-card p-4">
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-2" style={{color:"var(--clr-text-muted)"}}>
              Inspection Model
            </label>
            <select
              id="select-model"
              value={selectedModelId}
              onChange={(e) => setSelectedModelId(e.target.value)}
            >
              {models.length === 0 && <option value="">No trained models</option>}
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} v{m.version} ({m.task_type})
                </option>
              ))}
            </select>
          </div>

          {/* Threshold */}
          <div className="vv-card p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider" style={{color:"var(--clr-text-muted)"}}>
                Confidence Threshold
              </label>
              <span className="text-base font-bold" style={{color:"var(--clr-accent)"}}>{threshold}%</span>
            </div>
            <input
              type="range" min="0" max="100"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px]" style={{color:"var(--clr-text-muted)"}}>Loose</span>
              <span className="text-[10px]" style={{color:"var(--clr-text-muted)"}}>Strict</span>
            </div>
          </div>

          {/* Result Card */}
          {result && (
            <div className="vv-card p-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{color:"var(--clr-text-muted)"}}>
                Inspection Result
              </h3>
              <div
                className="p-4 rounded"
                style={{
                  background: verdictInfo(result.verdict).bg,
                  border: `1px solid ${verdictInfo(result.verdict).border}`,
                }}
              >
                <div className="flex justify-between items-center mb-3">
                  <div className="text-3xl font-black font-mono" style={{color: verdictInfo(result.verdict).color}}>
                    {verdictInfo(result.verdict).label}
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase" style={{color:"var(--clr-text-muted)"}}>Confidence</div>
                    <div className="text-xl font-bold font-mono" style={{color:"var(--clr-text)"}}>
                      {(result.confidence * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
                <div className="pass-rate-bar">
                  <div
                    className="pass-rate-fill"
                    style={{
                      width: `${result.confidence * 100}%`,
                      background: verdictInfo(result.verdict).color,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="vv-card p-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{color:"var(--clr-text-muted)"}}>
              Instructions
            </h3>
            <ol className="text-xs space-y-1.5" style={{color:"var(--clr-text-sub)"}}>
              {[
                "Select an inspection model",
                "Start camera or upload an image",
                "Click Capture & Inspect to run AI analysis",
                "Review the result and confidence score",
              ].map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold" style={{background:"var(--clr-surface-mid)", color:"var(--clr-text-sub)"}}>
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
