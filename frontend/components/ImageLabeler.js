"use client";

import {useState, useRef, useCallback, useEffect} from "react";
import {saveAnnotations, fetchAnnotations, fetchDatasetAnnotations, exportAnnotationsYOLO} from "@/lib/api";

/*
 * ─── Colour palette for annotation classes ───────────
 */
const CLASS_COLORS = [
  "#f44336", "#2196f3", "#4caf50", "#ff9800", "#9c27b0",
  "#00bcd4", "#e91e63", "#8bc34a", "#ff5722", "#607d8b",
  "#3f51b5", "#009688", "#ffc107", "#795548", "#673ab7",
];
function colorForClass(label, allLabels) {
  const idx = allLabels.indexOf(label);
  return CLASS_COLORS[idx % CLASS_COLORS.length];
}

/**
 * ImageLabeler — Full-screen annotation editor
 *
 * Props:
 *   imageUrl            – full URL of the image to annotate
 *   filename            – filename key for storage
 *   datasetId           – dataset ID for storage key
 *   onClose             – callback to close the labeler
 *   onSaved             – callback when annotations are saved (receives annotations[] if returnAnnotations=true)
 *   initialAnnotations  – optional pre-loaded annotations (used by CameraCapture)
 *   returnAnnotations   – if true, onSaved receives the annotations array instead of persisting to localStorage
 */
export default function ImageLabeler({imageUrl, filename, datasetId, onClose, onSaved, initialAnnotations, returnAnnotations, datasetClasses}) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const imgRef = useRef(null);

  // ── State ─────────────────────────────────────────
  const [annotations, setAnnotations] = useState([]);
  const [history, setHistory] = useState([]);         // undo stack
  const [tool, setTool] = useState("box");            // "box" | "polygon" | "select"
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [classNames, setClassNames] = useState(datasetClasses?.length > 0 ? datasetClasses : ["OK", "NG"]);
  const [activeClass, setActiveClass] = useState(datasetClasses?.length > 0 ? datasetClasses[0] : "OK");
  const [newClassName, setNewClassName] = useState("");
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [saving, setSaving] = useState(false);

  // Drawing state
  const [drawing, setDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);   // {x, y}
  const [polyPoints, setPolyPoints] = useState([]);   // [{x, y}, ...]
  const [tempEnd, setTempEnd] = useState(null);        // mouse pos during draw

  // Zoom / pan
  const [view, setView] = useState({zoom: 1, pan: {x: 0, y: 0}});
  const zoom = view.zoom;
  const pan = view.pan;
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState(null);

  // Image natural size
  const [imgSize, setImgSize] = useState({w: 0, h: 0});

  // ── Load image ────────────────────────────────────
  useEffect(() => {
    setImgLoaded(false);
    setImgError(false);
    const img = new Image();
    // We don't need crossOrigin="anonymous" because we only draw to canvas, 
    // we don't extract pixel data (no toDataURL/getImageData).
    img.onload = () => {
      imgRef.current = img;
      setImgSize({w: img.naturalWidth, h: img.naturalHeight});
      setImgLoaded(true);
    };
    img.onerror = () => {
      console.error("Failed to load image:", imageUrl);
      setImgError(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // ── Load existing annotations ────────────────────
  useEffect(() => {
    if (initialAnnotations && initialAnnotations.length > 0) {
      setAnnotations(initialAnnotations);
      const names = new Set(datasetClasses?.length > 0 ? datasetClasses : ["OK", "NG"]);
      initialAnnotations.forEach(a => names.add(a.label));
      setClassNames(Array.from(names));
    } else if (!returnAnnotations) {
      // First try localStorage annotations
      fetchAnnotations(datasetId, filename).then(data => {
        if (data?.length > 0) {
          setAnnotations(data);
          const names = new Set(datasetClasses?.length > 0 ? datasetClasses : ["OK", "NG"]);
          data.forEach(a => names.add(a.label));
          setClassNames(Array.from(names));
        } else {
          // Fallback: try fetching YOLO annotations from backend
          fetchDatasetAnnotations(datasetId, filename).then(result => {
            if (result?.classes?.length > 0) {
              const names = new Set(result.classes);
              setClassNames(Array.from(names));
              setActiveClass(result.classes[0]);
            }
            if (result?.annotations?.length > 0 && imgRef.current) {
              // Convert normalized YOLO coords to pixel coords
              const iw = imgRef.current.naturalWidth;
              const ih = imgRef.current.naturalHeight;
              const pixelAnns = result.annotations.map(a => ({
                type: "box",
                x: Math.round((a.cx - a.w / 2) * iw),
                y: Math.round((a.cy - a.h / 2) * ih),
                w: Math.round(a.w * iw),
                h: Math.round(a.h * ih),
                label: a.label,
              }));
              setAnnotations(pixelAnns);
            } else if (result?.annotations?.length > 0) {
              // Image not loaded yet — wait for it and then convert
              const waitForImg = setInterval(() => {
                if (imgRef.current?.naturalWidth) {
                  clearInterval(waitForImg);
                  const iw = imgRef.current.naturalWidth;
                  const ih = imgRef.current.naturalHeight;
                  const pixelAnns = result.annotations.map(a => ({
                    type: "box",
                    x: Math.round((a.cx - a.w / 2) * iw),
                    y: Math.round((a.cy - a.h / 2) * ih),
                    w: Math.round(a.w * iw),
                    h: Math.round(a.h * ih),
                    label: a.label,
                  }));
                  setAnnotations(pixelAnns);
                }
              }, 100);
              // Cleanup after 5 seconds max
              setTimeout(() => clearInterval(waitForImg), 5000);
            }
          }).catch(() => {});
        }
      });
    }
  }, [datasetId, filename]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Canvas dimensions ─────────────────────────────
  const getCanvasSize = useCallback(() => {
    if (!wrapRef.current || !imgRef.current) return {cw: 0, ch: 0, scale: 1};
    const wrap = wrapRef.current.getBoundingClientRect();
    const ar = imgRef.current.naturalWidth / imgRef.current.naturalHeight;
    let cw, ch;
    if (wrap.width / wrap.height > ar) {
      ch = wrap.height * 0.95;
      cw = ch * ar;
    } else {
      cw = wrap.width * 0.95;
      ch = cw / ar;
    }
    const scale = cw / imgRef.current.naturalWidth;
    return {cw, ch, scale};
  }, []);

  // ── Canvas → image coords ────────────────────────
  const canvasToImg = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return {x: 0, y: 0};
    const rect = canvas.getBoundingClientRect();
    const {scale} = getCanvasSize();
    const x = (clientX - rect.left) / (scale * zoom) - pan.x / (scale * zoom);
    const y = (clientY - rect.top) / (scale * zoom) - pan.y / (scale * zoom);
    return {x: Math.round(x), y: Math.round(y)};
  }, [getCanvasSize, zoom, pan]);

  // ── Render canvas ─────────────────────────────────
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgLoaded) return;

    const {cw, ch, scale} = getCanvasSize();
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(scale * zoom, scale * zoom);

    // Draw image
    ctx.drawImage(img, 0, 0);

    // Draw annotations
    annotations.forEach((ann, idx) => {
      const color = colorForClass(ann.label, classNames);
      const isSelected = idx === selectedIdx;
      ctx.strokeStyle = color;
      ctx.lineWidth = (isSelected ? 3 : 2) / (scale * zoom);
      ctx.fillStyle = color + "30";

      if (ann.type === "box") {
        ctx.fillRect(ann.x, ann.y, ann.w, ann.h);
        ctx.strokeRect(ann.x, ann.y, ann.w, ann.h);
        // Label
        const labelText = ann.label;
        const fs = Math.max(12, 14 / (scale * zoom));
        ctx.font = `bold ${fs}px Geist, sans-serif`;
        const tw = ctx.measureText(labelText).width;
        ctx.fillStyle = color;
        ctx.fillRect(ann.x, ann.y - fs - 4, tw + 8, fs + 4);
        ctx.fillStyle = "#fff";
        ctx.fillText(labelText, ann.x + 4, ann.y - 4);
      } else if (ann.type === "polygon" && ann.points?.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(ann.points[0].x, ann.points[0].y);
        ann.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
        if (ann.closed) ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Label at centroid
        if (ann.closed && ann.points.length >= 3) {
          const cx = ann.points.reduce((s, p) => s + p.x, 0) / ann.points.length;
          const cy = ann.points.reduce((s, p) => s + p.y, 0) / ann.points.length;
          const fs = Math.max(12, 14 / (scale * zoom));
          ctx.font = `bold ${fs}px Geist, sans-serif`;
          const tw = ctx.measureText(ann.label).width;
          ctx.fillStyle = color;
          ctx.fillRect(cx - tw / 2 - 4, cy - fs / 2 - 2, tw + 8, fs + 4);
          ctx.fillStyle = "#fff";
          ctx.fillText(ann.label, cx - tw / 2, cy + fs / 2 - 2);
        }
      }

      // Selection handles for boxes
      if (isSelected && ann.type === "box") {
        const hs = Math.max(4, 5 / (scale * zoom));
        ctx.fillStyle = color;
        [[ann.x, ann.y], [ann.x + ann.w, ann.y], [ann.x, ann.y + ann.h], [ann.x + ann.w, ann.y + ann.h]].forEach(([hx, hy]) => {
          ctx.fillRect(hx - hs, hy - hs, hs * 2, hs * 2);
        });
      }
    });

    // Drawing preview (box)
    if (tool === "box" && drawing && drawStart && tempEnd) {
      const color = colorForClass(activeClass, classNames);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 / (scale * zoom);
      ctx.setLineDash([6 / (scale * zoom), 4 / (scale * zoom)]);
      const w = tempEnd.x - drawStart.x;
      const h = tempEnd.y - drawStart.y;
      ctx.strokeRect(drawStart.x, drawStart.y, w, h);
      ctx.setLineDash([]);
    }

    // Drawing preview (polygon)
    if (tool === "polygon" && polyPoints.length > 0) {
      const color = colorForClass(activeClass, classNames);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 / (scale * zoom);
      ctx.setLineDash([6 / (scale * zoom), 4 / (scale * zoom)]);
      ctx.beginPath();
      ctx.moveTo(polyPoints[0].x, polyPoints[0].y);
      polyPoints.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
      if (tempEnd) ctx.lineTo(tempEnd.x, tempEnd.y);
      ctx.stroke();
      ctx.setLineDash([]);
      // Vertices
      const vs = Math.max(3, 4 / (scale * zoom));
      ctx.fillStyle = color;
      polyPoints.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, vs, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    ctx.restore();
  }, [annotations, classNames, selectedIdx, imgLoaded, zoom, pan, getCanvasSize, tool, drawing, drawStart, tempEnd, polyPoints, activeClass]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  // Re-render on resize
  useEffect(() => {
    const h = () => renderCanvas();
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, [renderCanvas]);

  // ── Push undo history ─────────────────────────────
  const pushHistory = (anns) => {
    setHistory(prev => [...prev.slice(-30), anns]);
  };

  // ── Mouse handlers ────────────────────────────────
  const handleMouseDown = (e) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey) || tool === "hand") {
      // Middle-click or shift+click or Hand tool → pan
      setPanning(true);
      setPanStart({x: e.clientX - pan.x, y: e.clientY - pan.y});
      return;
    }
    if (e.button !== 0) return;

    const pos = canvasToImg(e.clientX, e.clientY);

    if (tool === "select") {
      // Hit test — find annotation under cursor
      const hit = [...annotations].reverse().findIndex(ann => {
        if (ann.type === "box") {
          return pos.x >= ann.x && pos.x <= ann.x + ann.w && pos.y >= ann.y && pos.y <= ann.y + ann.h;
        }
        if (ann.type === "polygon" && ann.points?.length >= 3) {
          return isPointInPolygon(pos, ann.points);
        }
        return false;
      });
      setSelectedIdx(hit >= 0 ? annotations.length - 1 - hit : -1);
      return;
    }

    if (tool === "box") {
      setDrawing(true);
      setDrawStart(pos);
      setTempEnd(pos);
      setSelectedIdx(-1);
    }
    // polygon click handled separately
  };

  const handleMouseMove = (e) => {
    if (panning && panStart) {
      setView(prev => ({...prev, pan: {x: e.clientX - panStart.x, y: e.clientY - panStart.y}}));
      return;
    }
    const pos = canvasToImg(e.clientX, e.clientY);
    if (tool === "box" && drawing) {
      setTempEnd(pos);
    }
    if (tool === "polygon" && polyPoints.length > 0) {
      setTempEnd(pos);
    }
  };

  const handleMouseUp = (e) => {
    if (panning) {
      setPanning(false);
      setPanStart(null);
      return;
    }
    if (tool === "box" && drawing && drawStart && tempEnd) {
      const x = Math.min(drawStart.x, tempEnd.x);
      const y = Math.min(drawStart.y, tempEnd.y);
      const w = Math.abs(tempEnd.x - drawStart.x);
      const h = Math.abs(tempEnd.y - drawStart.y);
      if (w > 5 && h > 5) {
        pushHistory([...annotations]);
        setAnnotations(prev => [...prev, {type: "box", x, y, w, h, label: activeClass}]);
        setSelectedIdx(annotations.length);
      }
      setDrawing(false);
      setDrawStart(null);
      setTempEnd(null);
    }
  };

  const handleCanvasClick = (e) => {
    if (tool !== "polygon") return;
    const pos = canvasToImg(e.clientX, e.clientY);
    
    if (polyPoints.length >= 3) {
      const first = polyPoints[0];
      const distImg = Math.hypot(first.x - pos.x, first.y - pos.y);
      const {scale} = getCanvasSize();
      const distScreen = distImg * scale * zoom;
      
      if (distScreen < 15) {
        pushHistory([...annotations]);
        setAnnotations(prev => [...prev, {type: "polygon", points: [...polyPoints], closed: true, label: activeClass}]);
        setSelectedIdx(annotations.length);
        setPolyPoints([]);
        setTempEnd(null);
        return;
      }
    }
    setPolyPoints(prev => [...prev, pos]);
  };

  const handleCanvasDblClick = (e) => {
    if (tool !== "polygon" || polyPoints.length < 3) return;
    // Since double click triggers 2 clicks, the last 2 points are duplicates
    // or near duplicates of the current position. We should trim them.
    const validPoints = polyPoints.slice(0, -1);
    if (validPoints.length >= 3) {
      pushHistory([...annotations]);
      setAnnotations(prev => [...prev, {type: "polygon", points: [...validPoints], closed: true, label: activeClass}]);
      setSelectedIdx(annotations.length);
    }
    setPolyPoints([]);
    setTempEnd(null);
  };

  // ── Scroll to zoom ────────────────────────────────
  // ── Zoom logic ────────────────────────────────────
  const handleZoomChange = useCallback((delta, mouseX, mouseY) => {
    setView(prev => {
      const newZoom = Math.max(0.2, Math.min(5, prev.zoom + delta));
      if (newZoom === prev.zoom) return prev;

      let cx = mouseX, cy = mouseY;
      if (cx === undefined) {
        if (canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect();
          cx = rect.width / 2;
          cy = rect.height / 2;
        } else {
          cx = 0; cy = 0;
        }
      }

      const {scale} = getCanvasSize();
      const S = scale * prev.zoom;
      const S_new = scale * newZoom;
      return {
        zoom: newZoom,
        pan: {
          x: cx - (cx - prev.pan.x) * (S_new / S),
          y: cy - (cy - prev.pan.y) * (S_new / S)
        }
      };
    });
  }, [getCanvasSize]);

  // ── Scroll to zoom ────────────────────────────────
  const handleWheel = (e) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const rect = canvasRef.current.getBoundingClientRect();
    handleZoomChange(delta, e.clientX - rect.left, e.clientY - rect.top);
  };

  // ── Keyboard shortcuts ────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT") return;
      if (e.key === "Escape") { 
        if (tool === "polygon" && polyPoints.length > 0) {
          setPolyPoints([]);
          setTempEnd(null);
        } else {
          onClose(); 
        }
        return; 
      }
      if (e.key === "Enter" && tool === "polygon" && polyPoints.length >= 3) {
        pushHistory([...annotations]);
        setAnnotations(prev => [...prev, {type: "polygon", points: [...polyPoints], closed: true, label: activeClass}]);
        setSelectedIdx(annotations.length);
        setPolyPoints([]);
        setTempEnd(null);
        return;
      }
      if (e.key === "b" || e.key === "B") { setTool("box"); setPolyPoints([]); }
      if (e.key === "p" || e.key === "P") { setTool("polygon"); setDrawing(false); }
      if (e.key === "v" || e.key === "V") { setTool("select"); setDrawing(false); setPolyPoints([]); }
      if (e.key === "h" || e.key === "H") { setTool("hand"); setDrawing(false); setPolyPoints([]); }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIdx >= 0 && selectedIdx < annotations.length) {
          pushHistory([...annotations]);
          setAnnotations(prev => prev.filter((_, i) => i !== selectedIdx));
          setSelectedIdx(-1);
        }
      }
      if (e.ctrlKey && e.key === "z") {
        // Undo
        if (history.length > 0) {
          const prev = history[history.length - 1];
          setHistory(h => h.slice(0, -1));
          setAnnotations(prev);
          setSelectedIdx(-1);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [annotations, selectedIdx, history, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save ──────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      if (returnAnnotations) {
        // Pass annotations back to parent (CameraCapture flow)
        if (onSaved) onSaved(annotations);
      } else {
        await saveAnnotations(datasetId, filename, annotations);
        if (onSaved) onSaved();
      }
    } catch (err) {
      alert("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Export YOLO ───────────────────────────────────
  const handleExport = () => {
    const txt = exportAnnotationsYOLO(annotations, imgSize.w, imgSize.h, classNames);
    const blob = new Blob([txt], {type: "text/plain"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.replace(/\.[^.]+$/, ".txt");
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Add class ─────────────────────────────────────
  const addClass = () => {
    const name = newClassName.trim();
    if (name && !classNames.includes(name)) {
      setClassNames(prev => [...prev, name]);
      setActiveClass(name);
    }
    setNewClassName("");
  };

  return (
    <div className="labeler-overlay">
      {/* ── Toolbar ── */}
      <div className="labeler-toolbar">
        <button onClick={onClose} className="labeler-tool-btn" title="Close (Esc)">
          <span className="material-symbols-outlined" style={{fontSize: 16}}>close</span>
        </button>

        <div style={{width: 1, height: 24, background: "var(--clr-border)", margin: "0 4px"}} />

        <button
          className={`labeler-tool-btn ${tool === "select" ? "active" : ""}`}
          onClick={() => { setTool("select"); setDrawing(false); setPolyPoints([]); }}
          title="Select (V)"
        >
          <span className="material-symbols-outlined" style={{fontSize: 16}}>near_me</span>
          Select
        </button>
        <button
          className={`labeler-tool-btn ${tool === "hand" ? "active" : ""}`}
          onClick={() => { setTool("hand"); setDrawing(false); setPolyPoints([]); }}
          title="Pan (H)"
        >
          <span className="material-symbols-outlined" style={{fontSize: 16}}>pan_tool</span>
          Pan
        </button>
        <button
          className={`labeler-tool-btn ${tool === "box" ? "active" : ""}`}
          onClick={() => { setTool("box"); setPolyPoints([]); }}
          title="Bounding Box (B)"
        >
          <span className="material-symbols-outlined" style={{fontSize: 16}}>crop_free</span>
          Box
        </button>
        <button
          className={`labeler-tool-btn ${tool === "polygon" ? "active" : ""}`}
          onClick={() => { setTool("polygon"); setDrawing(false); }}
          title="Polygon (P)"
        >
          <span className="material-symbols-outlined" style={{fontSize: 16}}>polyline</span>
          Polygon
        </button>

        <div style={{width: 1, height: 24, background: "var(--clr-border)", margin: "0 4px"}} />

        {/* Zoom controls */}
        <button className="labeler-tool-btn" onClick={() => handleZoomChange(0.25)} title="Zoom in">
          <span className="material-symbols-outlined" style={{fontSize: 16}}>zoom_in</span>
        </button>
        <span style={{fontSize: 11, fontWeight: 700, color: "var(--clr-text-sub)", minWidth: 40, textAlign: "center"}}>
          {Math.round(zoom * 100)}%
        </span>
        <button className="labeler-tool-btn" onClick={() => handleZoomChange(-0.25)} title="Zoom out">
          <span className="material-symbols-outlined" style={{fontSize: 16}}>zoom_out</span>
        </button>
        <button className="labeler-tool-btn" onClick={() => setView({zoom: 1, pan: {x: 0, y: 0}})} title="Reset view">
          <span className="material-symbols-outlined" style={{fontSize: 16}}>fit_screen</span>
        </button>

        <div style={{flex: 1}} />

        {/* Save & Export */}
        <button className="labeler-tool-btn" onClick={handleExport} disabled={annotations.length === 0} title="Export YOLO .txt">
          <span className="material-symbols-outlined" style={{fontSize: 16}}>download</span>
          YOLO
        </button>
        <button className="btn-primary" onClick={handleSave} disabled={saving} style={{padding: "6px 16px", fontSize: 12}}>
          <span className="material-symbols-outlined" style={{fontSize: 16}}>{saving ? "hourglass_top" : "save"}</span>
          {saving ? "Saving…" : `Save (${annotations.length})`}
        </button>
      </div>

      {/* ── Main area ── */}
      <div style={{flex: 1, display: "flex", overflow: "hidden"}}>
        {/* Canvas */}
        <div ref={wrapRef} className="labeler-canvas-wrap" onWheel={handleWheel}>
          {imgError ? (
            <div style={{textAlign: "center", color: "var(--clr-error)", padding: 20}}>
              <span className="material-symbols-outlined" style={{fontSize: 32, marginBottom: 8}}>broken_image</span>
              <p style={{fontSize: 14, fontWeight: 500}}>Failed to load image.</p>
              <p style={{fontSize: 12, opacity: 0.7, marginTop: 4, wordBreak: "break-all"}}>{imageUrl}</p>
            </div>
          ) : imgLoaded ? (
            <canvas
              ref={canvasRef}
              style={{cursor: tool === "select" ? "default" : tool === "hand" || panning ? "grab" : "crosshair"}}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onClick={handleCanvasClick}
              onDoubleClick={handleCanvasDblClick}
              onContextMenu={e => e.preventDefault()}
            />
          ) : (
            <div style={{textAlign: "center", color: "var(--clr-text-muted)"}}>
              <div className="w-6 h-6 border-2 rounded-full animate-spin mx-auto mb-2" style={{borderColor: "var(--clr-border)", borderTopColor: "var(--clr-accent)"}} />
              <p style={{fontSize: 12}}>Loading image…</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="labeler-sidebar">
          {/* Classes */}
          <div style={{padding: 12, borderBottom: "1px solid var(--clr-border)"}}>
            <div className="section-label" style={{marginBottom: 8}}>Classes</div>
            <div style={{display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8}}>
              {classNames.map(cls => (
                <button
                  key={cls}
                  onClick={() => setActiveClass(cls)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "4px 10px", borderRadius: 4,
                    fontSize: 11, fontWeight: 600, fontFamily: "inherit",
                    border: activeClass === cls ? "2px solid " + colorForClass(cls, classNames) : "1px solid var(--clr-border)",
                    background: activeClass === cls ? colorForClass(cls, classNames) + "20" : "var(--clr-surface-low)",
                    color: activeClass === cls ? colorForClass(cls, classNames) : "var(--clr-text-sub)",
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  <span className="labeler-color-dot" style={{background: colorForClass(cls, classNames), width: 8, height: 8}} />
                  {cls}
                </button>
              ))}
            </div>
            <div style={{display: "flex", gap: 4}}>
              <input
                type="text"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addClass(); }}
                placeholder="Add class…"
                style={{flex: 1, padding: "4px 8px", fontSize: 11}}
              />
              <button className="btn-outline" style={{padding: "4px 8px", fontSize: 11}} onClick={addClass}>+</button>
            </div>
          </div>

          {/* Annotations list */}
          <div style={{padding: "8px 0", flex: 1, overflowY: "auto"}}>
            <div className="section-label" style={{padding: "0 12px", marginBottom: 6}}>
              Annotations ({annotations.length})
            </div>
            {annotations.length === 0 ? (
              <div style={{padding: "20px 12px", textAlign: "center", color: "var(--clr-text-muted)", fontSize: 11}}>
                <span className="material-symbols-outlined" style={{fontSize: 28, display: "block", marginBottom: 4, opacity: 0.4}}>draw</span>
                Draw on the image to annotate
              </div>
            ) : (
              annotations.map((ann, idx) => (
                <div
                  key={idx}
                  className={`labeler-annot-item ${idx === selectedIdx ? "selected" : ""}`}
                  onClick={() => setSelectedIdx(idx)}
                >
                  <span className="labeler-color-dot" style={{background: colorForClass(ann.label, classNames)}} />
                  <div style={{flex: 1, minWidth: 0}}>
                    <div style={{fontWeight: 600, fontSize: 12, color: "var(--clr-text)"}}>{ann.label}</div>
                    <div style={{fontSize: 10, color: "var(--clr-text-muted)"}}>
                      {ann.type === "box" ? `Box ${ann.w}×${ann.h}` : `Polygon ${ann.points?.length} pts`}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      pushHistory([...annotations]);
                      setAnnotations(prev => prev.filter((_, i) => i !== idx));
                      if (selectedIdx === idx) setSelectedIdx(-1);
                    }}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--clr-text-muted)", padding: 2, borderRadius: 4,
                      transition: "color 0.15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = "var(--clr-error)"}
                    onMouseLeave={e => e.currentTarget.style.color = "var(--clr-text-muted)"}
                  >
                    <span className="material-symbols-outlined" style={{fontSize: 16}}>delete</span>
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Keyboard shortcuts help */}
          <div style={{padding: "10px 12px", borderTop: "1px solid var(--clr-border)", background: "var(--clr-surface-low)"}}>
            <div className="section-label" style={{marginBottom: 6}}>Shortcuts</div>
            {[
              ["B", "Bounding Box"],
              ["P", "Polygon"],
              ["V", "Select"],
              ["H", "Pan (Hand)"],
              ["Del", "Delete selected"],
              ["Ctrl+Z", "Undo"],
              ["Scroll", "Zoom"],
              ["Shift+Drag", "Pan"],
            ].map(([key, desc]) => (
              <div key={key} style={{display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--clr-text-muted)", marginBottom: 2}}>
                <span style={{fontWeight: 700, fontFamily: "monospace", color: "var(--clr-text-sub)"}}>{key}</span>
                <span>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Point-in-polygon helper ── */
function isPointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
