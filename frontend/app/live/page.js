"use client";

import {useState, useEffect, useRef} from "react";
import {fetchInspectionModels, runInspection, listTemplates} from "@/lib/api";

export default function LiveInspectionPage() {
  const [models, setModels] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [threshold, setThreshold] = useState(70);
  const [isStreaming, setIsStreaming] = useState(false);
  const [result, setResult] = useState(null);
  const [inspecting, setInspecting] = useState(false);
  const [previewSrc, setPreviewSrc] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [liveEvents, setLiveEvents] = useState([]);
  // UI-only state: which sidebar panel is in front. Both panels stay mounted
  // at all times (toggled with CSS), so nothing about their behavior changes.
  const [sidebarTab, setSidebarTab] = useState("result");

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const logEndRef = useRef(null);
  const canvasOverlayRef = useRef(null);

  const drawBoundingBoxes = () => {
    const canvas = canvasOverlayRef.current;
    const model = models.find((m) => m.id === selectedModelId);
    if (!canvas || !result || model?.task_type !== "detection") return;

    const detections = result.details?.defect_detections || result.details?.all_detections || [];
    const origW = result.details?.image_width;
    const origH = result.details?.image_height;
    if (!origW || !origH) return;

    const container = canvas.parentElement;
    if (!container) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, cw, ch);

    const imgRatio = origW / origH;
    const containerRatio = cw / ch;
    let drawW = cw;
    let drawH = ch;
    let offsetX = 0;
    let offsetY = 0;

    if (imgRatio > containerRatio) {
      drawH = cw / imgRatio;
      offsetY = (ch - drawH) / 2;
    } else {
      drawW = ch * imgRatio;
      offsetX = (cw - drawW) / 2;
    }

    const scaleX = drawW / origW;
    const scaleY = drawH / origH;

    detections.forEach(det => {
      const [x1, y1, x2, y2] = det.bbox;
      const rx = offsetX + x1 * scaleX;
      const ry = offsetY + y1 * scaleY;
      const rw = (x2 - x1) * scaleX;
      const rh = (y2 - y1) * scaleY;

      ctx.strokeStyle = "rgba(186,26,26,0.8)";
      ctx.lineWidth = 2;
      ctx.strokeRect(rx, ry, rw, rh);

      const text = `${det.class} (${(det.confidence * 100).toFixed(1)}%)`;
      ctx.font = "12px sans-serif";
      const textWidth = ctx.measureText(text).width;
      ctx.fillStyle = "rgba(186,26,26,0.8)";
      ctx.fillRect(rx, ry - 18, textWidth + 8, 18);
      ctx.fillStyle = "#fff";
      ctx.fillText(text, rx + 4, ry - 5);
    });
  };

  useEffect(() => {
    drawBoundingBoxes();
    window.addEventListener("resize", drawBoundingBoxes);
    return () => window.removeEventListener("resize", drawBoundingBoxes);
  }, [result, selectedModelId, models]);

  useEffect(() => {
    fetchInspectionModels()
      .then((ms) => {
        setModels(ms || []);
        if (ms?.length > 0) setSelectedModelId(ms[0].id);
      })
      .catch(console.error);
    listTemplates()
      .then((ts) => setTemplates(ts || []))
      .catch(() => {});

    let eventSource = null;
    try {
      eventSource = new EventSource(`http://localhost:8000/api/integrations/events`, {
        withCredentials: true,
      });
      eventSource.onmessage = (e) => {
        try {
          const evt = JSON.parse(e.data);
          setLiveEvents((prev) => [...prev.slice(-49), evt]);
        } catch {}
      };
      eventSource.onerror = () => {};
    } catch {}

    return () => {
      stopCamera();
      if (eventSource) eventSource.close();
    };
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveEvents]);

  const loadTemplate = (templateId) => {
    if (!templateId) {
      setActiveTemplate(null);
      return;
    }
    const t = templates.find((t) => t.id === templateId);
    if (!t) return;
    setActiveTemplate(t);
    if (t.model_id) setSelectedModelId(t.model_id);
    if (t.threshold != null) setThreshold(Math.round(t.threshold * 100));
    
    if (t.camera_type && t.camera_ids && t.camera_ids.length > 0) {
      const firstCamId = t.camera_ids[0];
      if (/^\d+$/.test(firstCamId)) {
        startCamera(firstCamId);
      }
    }
  };

  const startCamera = async (deviceId = null) => {
    try {
      const constraints = { video: true };
      if (typeof deviceId === "string") {
        constraints.video = { deviceId: { exact: deviceId } };
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setIsStreaming(true);
      setResult(null);
      setPreviewSrc(null);
      // Assign stream after React renders the video element
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (e) {
      alert("Could not access camera: " + e.message);
    }
  };

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  }

  // Connect stream to video element when isStreaming changes and video element is mounted
  useEffect(() => {
    if (isStreaming && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [isStreaming]);

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
      if (res?.image_path) {
        setPreviewSrc(`http://localhost:8000${res.image_path}`);
        // Camera keeps running
      }
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
      if (res?.image_path) {
        setPreviewSrc(`http://localhost:8000${res.image_path}`);
      }
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

  const currentModel = models.find((m) => m.id === selectedModelId);

  return (
    <div className="max-w-[1680px] mx-auto pb-10 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[22px]" style={{color:"var(--clr-accent)"}}>precision_manufacturing</span>
          <div>
            <h2 className="text-2xl font-semibold leading-tight" style={{color:"var(--clr-text)"}}>Live Inspection</h2>
            <p className="text-sm" style={{color:"var(--clr-text-sub)"}}>
              Capture or upload images for AI-powered quality inspection
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{background:"var(--clr-surface-low)", border:"1px solid var(--clr-border)"}}>
          <span className={isStreaming ? "status-dot-active" : "status-dot-danger"} />
          <span className="text-[11px] font-mono font-semibold uppercase tracking-widest" style={{color:"var(--clr-text-sub)"}}>
            {isStreaming ? "● Streaming" : "● Offline"}
          </span>
        </div>
      </div>

      {/* Main layout: dominant camera console (left) + tabbed intel sidebar (right) */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-5 items-start">

        {/* ===== Camera Console ===== */}
        <div className="vv-card overflow-hidden flex flex-col">

          {/* Unified control strip: template / model / threshold + camera status */}
          <div
            className="flex flex-wrap items-center gap-4 px-4 py-3"
            style={{ borderBottom: "1px solid var(--clr-border)", background: "var(--clr-surface-low)" }}
          >
            {templates.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider" style={{color:"var(--clr-text-muted)"}}>
                  Template
                </label>
                <select
                  className="text-xs py-1.5 px-2 bg-transparent border rounded"
                  style={{borderColor:"var(--clr-border)", color:"var(--clr-text)"}}
                  value={activeTemplate?.id || ""}
                  onChange={(e) => loadTemplate(e.target.value)}
                >
                  <option value="">— Manual Configuration —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}{t.line_name ? ` (${t.line_name})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider" style={{color:"var(--clr-text-muted)"}}>
                Model
              </label>
              <select
                id="select-model"
                className="text-xs py-1.5 px-2 bg-transparent border rounded"
                style={{borderColor:"var(--clr-border)", color:"var(--clr-text)"}}
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

            <div className="flex items-center gap-3">
              <label className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2" style={{color:"var(--clr-text-muted)"}}>
                Threshold
                <span className="text-sm font-bold" style={{color:"var(--clr-accent)"}}>{threshold}%</span>
              </label>
              <input
                type="range" min="0" max="100"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-28"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap ml-auto">
              {activeTemplate && (
                <>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium" style={{background:"rgba(56,139,253,0.08)", border:"1px solid rgba(56,139,253,0.2)", color:"var(--clr-accent)"}}>
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    <span>
                      {activeTemplate.name} Active
                      {activeTemplate.camera_ids?.length > 0 ? ` • ${activeTemplate.camera_ids.join(", ")}` : ""}
                    </span>
                  </div>
                  {activeTemplate.trigger_type === "plc_signal" && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium" style={{background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.2)", color:"#f59e0b"}}>
                      <span className="material-symbols-outlined text-[14px]">bolt</span>
                      <span>PLC Trigger Active</span>
                    </div>
                  )}
                </>
              )}
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{color:"var(--clr-text-sub)"}}>
                {isStreaming ? "Camera Feed: Live" : "Camera Idle"}
              </span>
            </div>
          </div>

          {/* Video viewport — the focal point of the page */}
          <div className="relative w-full min-h-[420px] md:min-h-[560px] flex items-center justify-center" style={{background:"#050a12"}}>
            <div className="absolute inset-0 pattern-grid opacity-40" />

            {isStreaming && (
              <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-contain z-10" />
            )}
            {!isStreaming && previewSrc && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewSrc} alt="Preview" className="absolute inset-0 w-full h-full object-contain z-10" />
                <canvas ref={canvasOverlayRef} className="absolute inset-0 w-full h-full z-20 pointer-events-none" />
              </>
            )}
            {!isStreaming && !previewSrc && (
              <div className="relative z-10 flex flex-col items-center gap-3 text-center">
                <span className="material-symbols-outlined text-[64px] opacity-20" style={{color:"#94a3b8"}}>videocam_off</span>
                <p className="text-xs uppercase tracking-widest font-semibold" style={{color:"#4a5568"}}>Camera Off</p>
              </div>
            )}

            {/* Verdict overlay */}
            {result && currentModel?.task_type !== "detection" && (
              <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                <div
                  className="flex flex-col items-center gap-2 px-10 py-6 rounded-lg border-2 shadow-2xl"
                  style={{
                    background: verdictInfo(result.verdict).bg,
                    borderColor: verdictInfo(result.verdict).border,
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <span className="text-5xl font-black tracking-widest font-mono drop-shadow-md" style={{color: verdictInfo(result.verdict).color}}>
                    {verdictInfo(result.verdict).label}
                  </span>
                  <span className="text-lg font-mono drop-shadow" style={{color:"#cbd5e1"}}>
                    {(result.confidence * 100).toFixed(1)}% confidence
                  </span>
                </div>
              </div>
            )}

            {/* HUD status badge */}
            <div className="absolute top-3 left-3 z-20 flex items-center gap-2 px-3 py-1.5 rounded shadow" style={{background:"rgba(0,0,0,0.7)", border:"1px solid rgba(255,255,255,0.08)"}}>
              <span className={isStreaming ? "status-dot-active" : "status-dot-danger"} />
              <span className="text-[10px] font-bold tracking-widest uppercase font-mono text-white">
                {isStreaming ? "Live" : "Idle"}
              </span>
            </div>

            {/* Floating action dock, overlapping the bottom edge of the feed */}
            <div
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-wrap items-center justify-center gap-3 px-4 py-3 rounded-full shadow-2xl max-w-[92%]"
              style={{ background: "rgba(5,10,18,0.72)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(10px)" }}
            >
              <button
                id="btn-toggle-camera"
                onClick={isStreaming ? stopCamera : startCamera}
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
        </div>

        {/* ===== Intel Sidebar: tabbed Result / Monitor ===== */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: "var(--clr-surface-low)", border: "1px solid var(--clr-border)" }}>
            <button
              onClick={() => setSidebarTab("result")}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider py-2 rounded-md transition-colors"
              style={{
                background: sidebarTab === "result" ? "var(--clr-surface-mid)" : "transparent",
                color: sidebarTab === "result" ? "var(--clr-text)" : "var(--clr-text-muted)",
              }}
            >
              <span className="material-symbols-outlined text-[16px]">fact_check</span>
              Result
            </button>
            <button
              onClick={() => setSidebarTab("monitor")}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider py-2 rounded-md transition-colors"
              style={{
                background: sidebarTab === "monitor" ? "var(--clr-surface-mid)" : "transparent",
                color: sidebarTab === "monitor" ? "var(--clr-text)" : "var(--clr-text-muted)",
              }}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              Monitor
            </button>
          </div>

          {/* Result panel */}
          <div style={{ display: sidebarTab === "result" ? "flex" : "none" }} className="flex-col gap-3">
            {result ? (
              <>
                <div className="vv-card p-6 flex flex-col justify-center">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-4" style={{color:"var(--clr-text-muted)"}}>
                    Inspection Result
                  </h3>
                  <div className="flex flex-col gap-4">
                    {previewSrc && (
                      <div className="w-full shrink-0 bg-black/40 rounded-lg overflow-hidden border border-[var(--clr-border)] flex items-center justify-center relative min-h-[120px]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={previewSrc} alt="Snapshot" className="max-h-[160px] w-auto object-contain" />
                        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-[9px] rounded font-mono uppercase tracking-widest">Snapshot</div>
                      </div>
                    )}
                    <div
                      className="p-6 rounded-lg flex-1 flex flex-col justify-center"
                      style={{
                        background: verdictInfo(result.verdict).bg,
                        border: `1px solid ${verdictInfo(result.verdict).border}`,
                      }}
                    >
                      <div className="flex justify-between items-center mb-4">
                        <div className="text-4xl font-black font-mono" style={{color: verdictInfo(result.verdict).color}}>
                          {verdictInfo(result.verdict).label}
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold uppercase tracking-wider" style={{color:"var(--clr-text-muted)"}}>Confidence</div>
                          <div className="text-2xl font-bold font-mono mt-1" style={{color:"var(--clr-text)"}}>
                            {(result.confidence * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      <div className="pass-rate-bar h-2 rounded-full overflow-hidden" style={{background: "var(--clr-surface-mid)"}}>
                        <div
                          className="h-full transition-all duration-500 ease-out"
                          style={{
                            width: `${result.confidence * 100}%`,
                            background: verdictInfo(result.verdict).color,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {currentModel?.task_type === "detection" && (
                  <div className="vv-card p-6 flex-1 flex flex-col overflow-hidden">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-4" style={{color:"var(--clr-text-muted)"}}>
                      Defect Regions Detected ({result.details?.defect_detections?.length || 0})
                    </h3>
                    <div className="overflow-x-auto overflow-y-auto max-h-[300px]">
                      <table className="w-full text-left text-sm" style={{color:"var(--clr-text)"}}>
                        <thead>
                          <tr className="border-b" style={{borderColor:"var(--clr-border)", color:"var(--clr-text-muted)"}}>
                            <th className="pb-2 font-medium">Class</th>
                            <th className="pb-2 font-medium">Confidence</th>
                            <th className="pb-2 font-medium">Location</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.details?.defect_detections?.length > 0 ? (
                            result.details.defect_detections.map((det, i) => (
                              <tr key={i} className="border-b last:border-0" style={{borderColor:"var(--clr-border)"}}>
                                <td className="py-2.5 font-medium">{det.class}</td>
                                <td className="py-2.5">{(det.confidence * 100).toFixed(1)}%</td>
                                <td className="py-2.5 font-mono text-xs" style={{color:"var(--clr-text-sub)"}}>
                                  [{det.bbox.map(Math.round).join(", ")}]
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="3" className="py-4 text-center text-sm" style={{color:"var(--clr-text-muted)"}}>
                                No defects detected.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="vv-card p-6 h-full flex flex-col items-center justify-center text-center opacity-60 min-h-[200px]">
                <span className="material-symbols-outlined text-4xl mb-3" style={{color: "var(--clr-text-muted)"}}>image_search</span>
                <p className="text-sm font-medium" style={{color: "var(--clr-text-sub)"}}>No inspection results yet</p>
                <p className="text-xs mt-1" style={{color: "var(--clr-text-muted)"}}>Start the camera or upload an image to begin.</p>
              </div>
            )}
          </div>

          {/* Monitor panel */}
          <div style={{ display: sidebarTab === "monitor" ? "flex" : "none" }} className="flex-col flex-1">
            <div
              className="vv-card flex-1 flex flex-col overflow-hidden min-h-[420px]"
              style={{ background: "#0d1117" }}
            >
              {/* Terminal Header */}
              <div className="flex items-center gap-2 px-4 py-2.5 shrink-0" style={{ background: "#161b22", borderBottom: "1px solid #30363d" }}>
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full" style={{ background: "#ff5f57" }} />
                  <span className="w-3 h-3 rounded-full" style={{ background: "#febc2e" }} />
                  <span className="w-3 h-3 rounded-full" style={{ background: "#28c840" }} />
                </div>
                <span className="text-[11px] font-mono ml-2" style={{ color: "#8b949e" }}>verivision-monitor</span>
              </div>

              {/* Terminal Body */}
              <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed" style={{ color: "#c9d1d9" }}>
                {liveEvents.length === 0 ? (
                  <div className="text-center py-8" style={{ color: "#484f58" }}>
                    <p>Waiting for events...</p>
                  </div>
                ) : (
                  liveEvents.map((evt, i) => (
                    <div key={i} className="mb-2 flex gap-2">
                      <span style={{ color: "#484f58" }}>
                        [{evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : "—"}]
                      </span>
                      <span
                        style={{
                          color:
                            evt.status === "success"
                              ? "#3fb950"
                              : evt.status === "failed"
                              ? "#f85149"
                              : "#d29922",
                        }}
                      >
                        {evt.status === "success" ? "✓" : evt.status === "failed" ? "✗" : "⚡"}
                      </span>
                      <span>
                        <span style={{ color: "#79c0ff" }}>{evt.integration_name}</span>
                        {" "}
                        <span style={{ color: "#8b949e" }}>({evt.integration_type})</span>
                        {" → "}
                        <span
                          style={{
                            color:
                              evt.verdict === "NG"
                                ? "#f85149"
                                : evt.verdict === "OK"
                                ? "#3fb950"
                                : evt.verdict === "TEST"
                                ? "#d29922"
                                : "#8b949e",
                          }}
                        >
                          {evt.verdict}
                        </span>
                        {evt.confidence != null && (
                          <span style={{ color: "#8b949e" }}> ({(evt.confidence * 100).toFixed(1)}%)</span>
                        )}
                      </span>
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
