"use client";

import { useState, useEffect, useRef } from "react";
import { fetchInspectionModels, runInspection } from "@/lib/api";

function FocusIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 10V6a2 2 0 0 1 2-2h4"/><path d="M4 14v4a2 2 0 0 0 2 2h4"/><path d="M20 14v4a2 2 0 0 1-2 2h-4"/><path d="M20 10V6a2 2 0 0 0-2-2h-4"/><circle cx="12" cy="12" r="2"/></svg>; }
function CameraIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3"/></svg>; }
function UploadIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>; }
function TargetIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>; }
function XIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>; }

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
    fetchInspectionModels().then(ms => {
      setModels(ms || []);
      if (ms?.length > 0) setSelectedModelId(ms[0].id);
    }).catch(console.error);
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
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
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  };

  const captureAndInspect = async () => {
    if (!videoRef.current || !selectedModelId) return;
    
    // Ensure video is ready
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

      const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg"));
      if (!blob) {
        throw new Error("Failed to capture image from canvas (blob was null).");
      }
      
      const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
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

  const verdictStyle = (v) => {
    if (v === "OK") return { bg: "bg-emerald-950/70 border-emerald-500", text: "text-emerald-400", shadow: "shadow-emerald-500/20" };
    if (v === "NG") return { bg: "bg-red-950/70 border-red-500", text: "text-red-400", shadow: "shadow-red-500/20" };
    return { bg: "bg-amber-950/70 border-amber-500", text: "text-amber-400", shadow: "shadow-amber-500/20" };
  };

  return (
    <div className="flex flex-col h-full space-y-6 max-w-[1400px] mx-auto">
      <div className="animate-fade-in stagger-1">
        <div className="flex items-center gap-3 mb-1">
          <FocusIcon className="w-5 h-5 text-cyan-500" />
          <h1 className="text-xl font-semibold text-slate-100 tracking-tight">Live Inspection</h1>
        </div>
        <p className="text-sm text-slate-500 ml-8">Capture or upload images for AI-powered quality inspection</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1">
        {/* Camera / Preview */}
        <div className="w-full lg:w-[65%] flex flex-col gap-4 animate-fade-in stagger-2">
          <div className="glass-card-elevated flex-1 min-h-[450px] relative overflow-hidden flex items-center justify-center p-4">
            <div className="relative w-full h-full bg-[#02040a] rounded-lg border border-slate-800 overflow-hidden shadow-inner">
              {isStreaming && (
                <video ref={videoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
              )}
              {!isStreaming && previewSrc && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewSrc} alt="Preview" className="absolute inset-0 w-full h-full object-contain" />
              )}
              {!isStreaming && !previewSrc && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4 text-slate-600">
                    <TargetIcon className="w-16 h-16 opacity-30" />
                    <p className="text-xs uppercase tracking-widest font-bold">Camera Off</p>
                  </div>
                </div>
              )}

              {/* Verdict overlay */}
              {result && (
                <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                  <div className={`flex flex-col items-center gap-2 px-8 py-6 rounded-2xl shadow-2xl backdrop-blur-md border-2 ${verdictStyle(result.verdict).bg} ${verdictStyle(result.verdict).shadow}`}>
                    <span className={`text-5xl font-bold tracking-widest ${verdictStyle(result.verdict).text}`}>{result.verdict}</span>
                    <span className="text-lg font-mono text-slate-300">{(result.confidence * 100).toFixed(1)}%</span>
                  </div>
                </div>
              )}

              {/* HUD */}
              <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded border border-slate-800/80 backdrop-blur-md">
                <span className={`w-2 h-2 rounded-full ${isStreaming ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                <span className="text-[10px] font-bold text-slate-200 tracking-widest uppercase">{isStreaming ? "Live" : "Idle"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="w-full lg:w-[35%] flex flex-col gap-4 animate-fade-in stagger-3">
          {/* Model Selector */}
          <div className="glass-card p-4">
            <label className="section-label mb-2 block">Inspection Model</label>
            <select
              value={selectedModelId}
              onChange={(e) => setSelectedModelId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 text-sm focus:outline-none focus:border-cyan-500/50"
            >
              {models.length === 0 && <option value="">No trained models</option>}
              {models.map(m => <option key={m.id} value={m.id}>{m.name} v{m.version} ({m.task_type})</option>)}
            </select>
          </div>

          {/* Threshold */}
          <div className="glass-card p-4">
            <label className="section-label mb-2 block">Confidence Threshold</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="100"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="flex-1 accent-cyan-500"
              />
              <span className="text-lg font-bold text-cyan-400 data-mono w-14 text-right">{threshold}%</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">OK below this threshold → Uncertain</p>
          </div>

          {/* Camera Buttons */}
          <button
            onClick={isStreaming ? stopCamera : startCamera}
            disabled={!selectedModelId}
            className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 font-bold text-sm shadow-xl transition-all uppercase tracking-wide border ${
              isStreaming
                ? "bg-red-600 hover:bg-red-500 text-white shadow-red-500/25 border-red-500/50"
                : "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-500/25 border-cyan-500/50"
            } disabled:opacity-40`}
          >
            {isStreaming ? <><XIcon className="w-5 h-5" /> Stop Camera</> : <><CameraIcon className="w-5 h-5" /> Start Camera</>}
          </button>

          {isStreaming && (
            <button
              onClick={captureAndInspect}
              disabled={inspecting || !selectedModelId}
              className="w-full py-4 rounded-xl flex items-center justify-center gap-3 font-bold text-sm shadow-xl transition-all uppercase tracking-wide bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/25 border border-emerald-500/50 disabled:opacity-40"
            >
              {inspecting ? "Inspecting..." : "Capture & Inspect"}
            </button>
          )}

          {/* Upload */}
          <input type="file" accept="image/*" ref={fileRef} className="hidden" onChange={handleFileUpload} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={!selectedModelId || inspecting}
            className="w-full py-3 rounded-xl flex items-center justify-center gap-3 font-bold text-xs shadow-md transition-all uppercase tracking-wide bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-600 hover:border-slate-500 disabled:opacity-40"
          >
            <UploadIcon className="w-4 h-4" /> Upload Image for Inspection
          </button>

          {/* Result Card */}
          {result && (
            <div className="glass-card p-5">
              <h3 className="section-label mb-3">Inspection Result</h3>
              <div className={`p-4 rounded-xl border ${
                result.verdict === "OK" ? "bg-emerald-500/10 border-emerald-500/30" :
                result.verdict === "NG" ? "bg-red-500/10 border-red-500/30" :
                "bg-amber-500/10 border-amber-500/30"
              }`}>
                <div className="flex justify-between items-center mb-3">
                  <div className={`text-3xl font-bold data-mono ${
                    result.verdict === "OK" ? "text-emerald-400" :
                    result.verdict === "NG" ? "text-red-400" : "text-amber-400"
                  }`}>{result.verdict}</div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase text-slate-400">Confidence</div>
                    <div className="text-xl font-bold data-mono text-slate-200">{(result.confidence * 100).toFixed(1)}%</div>
                  </div>
                </div>
                <div className="h-2 bg-slate-900/80 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${
                    result.verdict === "OK" ? "bg-emerald-500" :
                    result.verdict === "NG" ? "bg-red-500" : "bg-amber-500"
                  }`} style={{ width: `${result.confidence * 100}%` }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
