"use client";

import {useState, useRef, useCallback, useEffect} from "react";
import {addImagesToDataset, saveAnnotations} from "@/lib/api";
import ImageLabeler from "@/components/ImageLabeler";

/**
 * CameraCapture — Full-screen modal for capturing images from the webcam,
 * labeling them in-browser, and saving them into a dataset.
 *
 * Props:
 *   datasetId   – target dataset to upload captured images into
 *   currentPath – sub-folder path within the dataset
 *   onClose     – callback to close the modal
 *   onSaved     – callback after images are successfully saved
 */
export default function CameraCapture({datasetId, currentPath = "", onClose, onSaved}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [captures, setCaptures] = useState([]);      // {id, blob, url, filename, annotations}
  const [flash, setFlash] = useState(false);
  const [saving, setSaving] = useState(false);
  const [facingMode, setFacingMode] = useState("environment");
  const [resolution, setResolution] = useState(null);

  // Labeler state
  const [labelerIdx, setLabelerIdx] = useState(-1); // index of capture being labeled

  // ── Start camera ──────────────────────────────────────
  const startCamera = useCallback(async (facing) => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {facingMode: facing || facingMode, width: {ideal: 1920}, height: {ideal: 1080}},
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsStreaming(true);
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      setResolution({w: settings.width, h: settings.height});
    } catch (e) {
      alert("Could not access camera: " + e.message);
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Switch camera ─────────────────────────────────────
  const switchCamera = () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    startCamera(next);
  };

  // ── Capture snapshot ──────────────────────────────────
  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const id = Date.now() + "-" + Math.random().toString(36).slice(2, 6);
      const filename = `camera_${new Date().toISOString().replace(/[:.]/g, "-")}_${captures.length}.jpg`;
      const url = URL.createObjectURL(blob);
      setCaptures(prev => [...prev, {id, blob, url, filename, annotations: []}]);
    }, "image/jpeg", 0.92);

    setFlash(true);
    setTimeout(() => setFlash(false), 200);
  };

  // ── Remove a captured image ───────────────────────────
  const removeCapture = (id) => {
    setCaptures(prev => {
      const item = prev.find(c => c.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return prev.filter(c => c.id !== id);
    });
  };

  // ── Save all captures to dataset ──────────────────────
  const saveToDataset = async () => {
    if (captures.length === 0) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("path", currentPath);
      captures.forEach((cap) => {
        formData.append("files", cap.blob, cap.filename);
      });
      await addImagesToDataset(datasetId, formData);

      // Save annotations for captures that have them
      for (const cap of captures) {
        if (cap.annotations && cap.annotations.length > 0) {
          const relPath = currentPath ? `${currentPath}${cap.filename}` : cap.filename;
          await saveAnnotations(datasetId, relPath, cap.annotations);
        }
      }

      captures.forEach(c => URL.revokeObjectURL(c.url));
      setCaptures([]);
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      alert("Failed to save images: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Close & cleanup ───────────────────────────────────
  const handleClose = () => {
    stopCamera();
    captures.forEach(c => URL.revokeObjectURL(c.url));
    onClose();
  };

  // ── Keyboard shortcut ─────────────────────────────────
  useEffect(() => {
    if (labelerIdx >= 0) return; // don't capture keys when labeler is open
    const handler = (e) => {
      if (e.key === "Escape") handleClose();
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); capture(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Labeler callbacks ─────────────────────────────────
  const openLabeler = (idx) => {
    // Pause camera while labeling
    setLabelerIdx(idx);
  };

  const closeLabeler = () => {
    setLabelerIdx(-1);
  };

  const handleLabelerSaved = (idx, annotations) => {
    setCaptures(prev => prev.map((c, i) => i === idx ? {...c, annotations} : c));
    setLabelerIdx(-1);
  };

  // ── Show inline labeler ───────────────────────────────
  if (labelerIdx >= 0 && captures[labelerIdx]) {
    const cap = captures[labelerIdx];
    return (
      <InlineCaptureLabeler
        imageUrl={cap.url}
        filename={cap.filename}
        existingAnnotations={cap.annotations || []}
        onClose={closeLabeler}
        onSave={(annotations) => handleLabelerSaved(labelerIdx, annotations)}
      />
    );
  }

  return (
    <div className="camera-modal-overlay">
      <canvas ref={canvasRef} style={{display: "none"}} />

      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{display: "flex", alignItems: "center", gap: 10}}>
          <span className="material-symbols-outlined" style={{color: "#fff", fontSize: 22}}>photo_camera</span>
          <span style={{color: "#fff", fontSize: 14, fontWeight: 700, letterSpacing: ".04em"}}>CAMERA CAPTURE</span>
          {resolution && (
            <span style={{color: "rgba(255,255,255,0.4)", fontSize: 11, fontFamily: "monospace"}}>
              {resolution.w}×{resolution.h}
            </span>
          )}
        </div>
        <div style={{display: "flex", alignItems: "center", gap: 8}}>
          {captures.length > 0 && (
            <span style={{color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 600}}>
              {captures.length} captured
              {captures.filter(c => c.annotations?.length > 0).length > 0 && (
                <span style={{color: "var(--clr-accent)", marginLeft: 6}}>
                  · {captures.filter(c => c.annotations?.length > 0).length} labeled
                </span>
              )}
            </span>
          )}
          <button onClick={handleClose} style={{
            background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)",
            color: "#fff", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            <span className="material-symbols-outlined" style={{fontSize: 16, verticalAlign: "middle", marginRight: 4}}>close</span>
            Close
          </button>
        </div>
      </div>

      {/* Video preview */}
      <div className="camera-preview">
        {isStreaming ? (
          <video ref={videoRef} autoPlay playsInline muted style={{transform: facingMode === "user" ? "scaleX(-1)" : "none"}} />
        ) : (
          <div style={{color: "rgba(255,255,255,0.4)", textAlign: "center"}}>
            <span className="material-symbols-outlined" style={{fontSize: 64, display: "block", marginBottom: 12}}>videocam_off</span>
            <p style={{fontSize: 14}}>Camera not active</p>
            <button onClick={() => startCamera()} className="btn-primary" style={{marginTop: 16}}>
              <span className="material-symbols-outlined" style={{fontSize: 18}}>videocam</span>
              Start Camera
            </button>
          </div>
        )}
        {flash && <div className="shutter-flash" />}
      </div>

      {/* Controls */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 20,
        padding: "16px 20px", background: "rgba(0,0,0,0.6)",
      }}>
        <button onClick={switchCamera} disabled={!isStreaming} style={{
          width: 44, height: 44, borderRadius: "50%", display: "flex",
          alignItems: "center", justifyContent: "center",
          background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
          color: isStreaming ? "#fff" : "rgba(255,255,255,0.3)", cursor: isStreaming ? "pointer" : "not-allowed",
          transition: "all 0.15s",
        }}>
          <span className="material-symbols-outlined" style={{fontSize: 22}}>cameraswitch</span>
        </button>

        <button className="capture-btn" onClick={capture} disabled={!isStreaming}>
          <span className="material-symbols-outlined" style={{fontSize: 28, color: "#fff"}}>photo_camera</span>
        </button>

        <button onClick={saveToDataset} disabled={captures.length === 0 || saving} style={{
          height: 44, borderRadius: 22, display: "flex",
          alignItems: "center", justifyContent: "center", gap: 6, padding: "0 20px",
          background: captures.length > 0 ? "var(--clr-success)" : "rgba(255,255,255,0.1)",
          border: "none",
          color: captures.length > 0 ? "#fff" : "rgba(255,255,255,0.3)",
          cursor: captures.length > 0 ? "pointer" : "not-allowed",
          fontSize: 13, fontWeight: 700, fontFamily: "inherit",
          transition: "all 0.2s", opacity: saving ? 0.6 : 1,
        }}>
          <span className="material-symbols-outlined" style={{fontSize: 18}}>
            {saving ? "hourglass_top" : "save"}
          </span>
          {saving ? "Saving…" : `Save ${captures.length > 0 ? `(${captures.length})` : ""}`}
        </button>
      </div>

      {/* Gallery strip with label buttons */}
      {captures.length > 0 && (
        <div className="camera-gallery">
          {captures.map((cap, idx) => (
            <div key={cap.id} style={{position: "relative", flexShrink: 0}}>
              <img src={cap.url} alt="capture" className="camera-gallery-thumb" />
              {/* Annotation count badge */}
              {cap.annotations?.length > 0 && (
                <div style={{
                  position: "absolute", top: -2, left: -2,
                  background: "var(--clr-accent)", color: "#fff",
                  fontSize: 9, fontWeight: 800, borderRadius: 8,
                  padding: "1px 5px", lineHeight: "14px",
                }}>
                  {cap.annotations.length}
                </div>
              )}
              {/* Action buttons */}
              <div style={{
                position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)",
                display: "flex", gap: 3,
              }}>
                <button
                  onClick={() => openLabeler(idx)}
                  title="Label this image"
                  style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: "var(--clr-accent)", color: "#fff",
                    border: "2px solid rgba(0,0,0,0.5)", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    cursor: "pointer", fontSize: 12, lineHeight: 1,
                  }}
                >
                  <span className="material-symbols-outlined" style={{fontSize: 13}}>edit</span>
                </button>
                <button
                  onClick={() => removeCapture(cap.id)}
                  title="Remove"
                  style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: "var(--clr-error)", color: "#fff",
                    border: "2px solid rgba(0,0,0,0.5)", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    cursor: "pointer", fontSize: 12, lineHeight: 1,
                  }}
                >
                  <span className="material-symbols-outlined" style={{fontSize: 13}}>close</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


/**
 * InlineCaptureLabeler — Wrapper around ImageLabeler for captured blob images.
 * Doesn't persist to localStorage; passes annotations back to CameraCapture.
 */
function InlineCaptureLabeler({imageUrl, filename, existingAnnotations, onClose, onSave}) {
  // We use the ImageLabeler but intercept save to pass annotations back
  // instead of writing to localStorage
  return (
    <ImageLabeler
      imageUrl={imageUrl}
      filename={filename}
      datasetId="__camera_capture__"
      initialAnnotations={existingAnnotations}
      onClose={onClose}
      onSaved={onSave}
      returnAnnotations={true}
    />
  );
}
