"use client";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCamera, faTimes, faUpload} from "@fortawesome/free-solid-svg-icons";

import {useState, useEffect, useRef} from "react";
import {fetchInspectionModels, runInspection} from "@/lib/api";

function FocusIcon(p) {
  return (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5">
      <path d="M4 10V6a2 2 0 0 1 2-2h4" />
      <path d="M4 14v4a2 2 0 0 0 2 2h4" />
      <path d="M20 14v4a2 2 0 0 1-2 2h-4" />
      <path d="M20 10V6a2 2 0 0 0-2-2h-4" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}
function CameraIcon(p) {
  return <FontAwesomeIcon icon={faCamera} className={p.className || ""} />;
}
function UploadIcon(p) {
  return <FontAwesomeIcon icon={faUpload} className={p.className || ""} />;
}
function TargetIcon(p) {
  return (
    <svg
      {...p}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}
function XIcon(p) {
  return <FontAwesomeIcon icon={faTimes} className={p.className || ""} />;
}

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

    if (
      videoRef.current.videoWidth === 0 ||
      videoRef.current.videoHeight === 0
    ) {
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
      if (!blob) {
        throw new Error("Failed to capture image from canvas (blob was null).");
      }

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

  const verdictStyle = (v) => {
    if (v === "OK")
      return {bg: "bg-[#0d1f18]/85 border-[#2fb380]", text: "text-[#4fd39a]"};
    if (v === "NG")
      return {bg: "bg-[#25100f]/85 border-[#e5484d]", text: "text-[#f26e72]"};
    return {bg: "bg-[#241c0b]/85 border-[#f5a623]", text: "text-[#f5a623]"};
  };

  return (
    <div className="flex flex-col h-full space-y-6 max-w-[1400px] mx-auto">
      <div className="animate-fade-in stagger-1">
        <div className="flex items-center gap-3 mb-1">
          <FocusIcon className="w-5 h-5 text-[#f5a623]" />
          <h1 className="text-xl font-display font-bold text-[#e4e7eb] tracking-wide uppercase">
            Live Inspection
          </h1>
        </div>
        <p className="text-sm text-[#5a6270] ml-8">
          Capture or upload images for AI-powered quality inspection
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1">
        {/* Camera / Preview */}
        <div className="w-full lg:w-[65%] flex flex-col gap-4 animate-fade-in stagger-2">
          <div className="glass-card-elevated flex-1 min-h-[450px] relative overflow-hidden flex items-center justify-center p-4">
            <div className="relative w-full h-full bg-[#050708] rounded border border-[#2b313a] overflow-hidden shadow-inner pattern-grid">
              {isStreaming && (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              {!isStreaming && previewSrc && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewSrc}
                  alt="Preview"
                  className="absolute inset-0 w-full h-full object-contain"
                />
              )}
              {!isStreaming && !previewSrc && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4 text-[#3a4149]">
                    <TargetIcon className="w-16 h-16 opacity-40" />
                    <p className="text-xs uppercase tracking-widest font-bold font-mono">
                      Camera Off
                    </p>
                  </div>
                </div>
              )}

              {/* Verdict overlay */}
              {result && (
                <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                  <div
                    className={`flex flex-col items-center gap-2 px-8 py-6 rounded shadow-2xl border-2 ${verdictStyle(result.verdict).bg}`}>
                    <span
                      className={`text-5xl font-bold tracking-widest font-mono ${verdictStyle(result.verdict).text}`}>
                      {result.verdict}
                    </span>
                    <span className="text-lg font-mono text-[#8a93a3]">
                      {(result.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}

              {/* HUD */}
              <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-[#0f1216]/90 px-3 py-1.5 rounded border border-[#2b313a]">
                <span
                  className={
                    isStreaming ? "status-dot-active" : "status-dot-danger"
                  }
                />
                <span className="text-[10px] font-bold text-[#dbe0e6] tracking-widest uppercase font-mono">
                  {isStreaming ? "Live" : "Idle"}
                </span>
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
              className="w-full px-4 py-2.5 rounded bg-[#0f1216] border border-[#2b313a] text-[#dbe0e6] text-sm focus:outline-none focus:border-[#f5a623]/60">
              {models.length === 0 && (
                <option value="">No trained models</option>
              )}
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} v{m.version} ({m.task_type})
                </option>
              ))}
            </select>
          </div>

          {/* Threshold */}
          <div className="glass-card p-4">
            <label className="section-label mb-2 block">
              Confidence Threshold
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="100"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-lg font-bold text-[#f5a623] data-mono w-14 text-right">
                {threshold}%
              </span>
            </div>
            <p className="text-[10px] text-[#5a6270] mt-1">
              OK below this threshold → Uncertain
            </p>
          </div>

          {/* Camera Buttons */}
          <button
            onClick={isStreaming ? stopCamera : startCamera}
            disabled={!selectedModelId}
            className={`w-full py-4 rounded flex items-center justify-center gap-3 font-bold text-sm shadow-xl transition-colors uppercase tracking-wide border font-display ${
              isStreaming
                ? "bg-[#e5484d] hover:bg-[#f26e72] text-white border-[#e5484d]/60"
                : "bg-[#f5a623] hover:bg-[#ffb63f] text-[#14171c] border-[#f5a623]/60"
            } disabled:opacity-40`}>
            {isStreaming ? (
              <>
                <XIcon className="w-5 h-5" /> Stop Camera
              </>
            ) : (
              <>
                <CameraIcon className="w-5 h-5" /> Start Camera
              </>
            )}
          </button>

          {isStreaming && (
            <button
              onClick={captureAndInspect}
              disabled={inspecting || !selectedModelId}
              className="w-full py-4 rounded flex items-center justify-center gap-3 font-bold text-sm shadow-xl transition-colors uppercase tracking-wide bg-[#2fb380] hover:bg-[#4fd39a] text-[#0d1f18] border border-[#2fb380]/60 disabled:opacity-40 font-display">
              {inspecting ? "Inspecting..." : "Capture & Inspect"}
            </button>
          )}

          {/* Upload */}
          <input
            type="file"
            accept="image/*"
            ref={fileRef}
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={!selectedModelId || inspecting}
            className="w-full py-3 rounded flex items-center justify-center gap-3 font-bold text-xs shadow-md transition-colors uppercase tracking-wide bg-[#1a1e24] hover:bg-[#232830] text-[#8a93a3] border border-[#2b313a] hover:border-[#3a4149] disabled:opacity-40">
            <UploadIcon className="w-4 h-4" /> Upload Image for Inspection
          </button>

          {/* Result Card */}
          {result && (
            <div className="glass-card p-5">
              <h3 className="section-label mb-3">Inspection Result</h3>
              <div
                className={`p-4 rounded border ${
                  result.verdict === "OK"
                    ? "bg-[#2fb380]/10 border-[#2fb380]/30"
                    : result.verdict === "NG"
                      ? "bg-[#e5484d]/10 border-[#e5484d]/30"
                      : "bg-[#f5a623]/10 border-[#f5a623]/30"
                }`}>
                <div className="flex justify-between items-center mb-3">
                  <div
                    className={`text-3xl font-bold data-mono ${
                      result.verdict === "OK"
                        ? "text-[#4fd39a]"
                        : result.verdict === "NG"
                          ? "text-[#f26e72]"
                          : "text-[#f5a623]"
                    }`}>
                    {result.verdict}
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase text-[#5a6270] font-mono">
                      Confidence
                    </div>
                    <div className="text-xl font-bold data-mono text-[#dbe0e6]">
                      {(result.confidence * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
                <div className="pass-rate-bar">
                  <div
                    className={`pass-rate-fill ${
                      result.verdict === "OK"
                        ? "bg-[#2fb380]"
                        : result.verdict === "NG"
                          ? "bg-[#e5484d]"
                          : "bg-[#f5a623]"
                    }`}
                    style={{width: `${result.confidence * 100}%`}}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
