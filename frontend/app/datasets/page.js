"use client";

import {useState, useEffect, useRef} from "react";
import {fetchDatasets, uploadDataset, deleteDataset, createDataset} from "@/lib/api";
import DatasetExplorer from "@/components/DatasetExplorer";
import CameraCapture from "@/components/CameraCapture";

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState([]);
  const [file, setFile] = useState(null);
  const [taskType, setTaskType] = useState("classification");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  // ── New state for source tabs and camera ──
  const [sourceTab, setSourceTab] = useState("upload"); // "upload" | "camera"
  const [cameraTarget, setCameraTarget] = useState(null); // dataset to capture into
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [newDsName, setNewDsName] = useState("");
  const [newDsTaskType, setNewDsTaskType] = useState("classification");
  const [creatingDs, setCreatingDs] = useState(false);

  const loadDatasets = async () => {
    try {
      const data = await fetchDatasets();
      setDatasets(data || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadDatasets(); }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("task_type", taskType);
      const result = await uploadDataset(formData);
      setUploadResult(result);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      loadDatasets();
    } catch (err) {
      try {
        const parsed = JSON.parse(err.message);
        setUploadError(parsed);
      } catch {
        setUploadError({errors: [err.message]});
      }
    } finally { setUploading(false); }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDataset(id);
      setDeleteConfirm(null);
      loadDatasets();
    } catch (e) { console.error(e); }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith(".zip")) setFile(f);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-10 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <span className="material-symbols-outlined text-[22px]" style={{color:"var(--clr-accent)"}}>database</span>
          <h2 className="text-2xl font-semibold" style={{color:"var(--clr-text)"}}>Datasets</h2>
        </div>
        <p className="text-sm" style={{color:"var(--clr-text-sub)"}}>
          Upload and manage training datasets for AI model development.
        </p>
      </div>

      {/* ══════════════════════════════════════════════════
         Upload / Camera Source Section
         ══════════════════════════════════════════════════ */}
      <div className="vv-card p-6 animate-fade-in stagger-2">
        <h3 className="text-sm font-semibold mb-5 uppercase tracking-wider" style={{color:"var(--clr-text-sub)"}}>
          Add Data
        </h3>

        {/* Source Tabs */}
        <div className="source-tabs mb-5">
          <button
            className={`source-tab ${sourceTab === "upload" ? "active" : ""}`}
            onClick={() => setSourceTab("upload")}
          >
            <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
            Upload File
          </button>
          <button
            className={`source-tab ${sourceTab === "camera" ? "active" : ""}`}
            onClick={() => setSourceTab("camera")}
          >
            <span className="material-symbols-outlined text-[18px]">photo_camera</span>
            Camera Capture
          </button>
        </div>

        {/* ── Upload Tab ── */}
        {sourceTab === "upload" && (
          <>
            {/* Task Type */}
            <div className="mb-4">
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{color:"var(--clr-text-muted)"}}>
                Task Type
              </label>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                className="w-full max-w-xs"
              >
                <option value="classification">Classification (OK/NG)</option>
                <option value="detection">Detection (YOLO)</option>
              </select>
            </div>

            {/* Drop Zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className="relative border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-all duration-200"
              style={{
                borderColor: dragOver ? "var(--clr-accent)" : file ? "var(--clr-success)" : "var(--clr-border)",
                background: dragOver ? "rgba(0,140,199,0.05)" : file ? "rgba(22,163,74,0.04)" : "var(--clr-surface-low)",
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => { if (e.target.files[0]) setFile(e.target.files[0]); }}
              />
              <span
                className="material-symbols-outlined block mb-3 text-[48px]"
                style={{color: file ? "var(--clr-success)" : "var(--clr-text-muted)"}}
              >
                {file ? "check_circle" : "cloud_upload"}
              </span>
              {file ? (
                <>
                  <p className="text-sm font-semibold" style={{color:"var(--clr-success)"}}>{file.name}</p>
                  <p className="text-xs mt-1" style={{color:"var(--clr-text-muted)"}}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB — click or drop to replace
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold" style={{color:"var(--clr-text-sub)"}}>Drop your .zip dataset here</p>
                  <p className="text-xs mt-1" style={{color:"var(--clr-text-muted)"}}>or click to browse</p>
                  <p className="text-[10px] mt-3 max-w-sm mx-auto font-mono" style={{color:"var(--clr-text-muted)"}}>
                    {taskType === "classification"
                      ? "Expected: train/(OK,NG)/*.jpg + valid/(OK,NG)/*.jpg"
                      : "Expected: images/ + labels/ + data.yaml"}
                  </p>
                </>
              )}
            </div>

            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="btn-primary mt-4"
            >
              <span className="material-symbols-outlined text-[18px]">
                {uploading ? "hourglass_top" : "upload"}
              </span>
              {uploading ? "Uploading & Validating..." : "Upload Dataset"}
            </button>

            {/* Upload Result */}
            {uploadResult && (
              <div className="mt-4 p-4 rounded" style={{background:"rgba(22,163,74,0.07)", border:"1px solid rgba(22,163,74,0.2)"}}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-[18px]" style={{color:"var(--clr-success)"}}>check_circle</span>
                  <span className="text-sm font-bold" style={{color:"var(--clr-success)"}}>Dataset uploaded successfully!</span>
                </div>
                {uploadResult.summary && (
                  <div className="text-xs space-y-1 mt-2" style={{color:"var(--clr-text-sub)"}}>
                    <p>Total images: <span className="font-mono font-bold">{uploadResult.summary.total_images}</span></p>
                    {uploadResult.summary.classes && (
                      <p>Classes: <span className="font-mono font-bold">{uploadResult.summary.classes.join(", ")}</span></p>
                    )}
                  </div>
                )}
                {uploadResult.warnings?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {uploadResult.warnings.map((w, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs" style={{color:"var(--clr-warn)"}}>
                        <span className="material-symbols-outlined text-[14px] mt-0.5">warning</span>
                        {w}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Upload Error */}
            {uploadError && (
              <div className="mt-4 p-4 rounded" style={{background:"rgba(186,26,26,0.07)", border:"1px solid rgba(186,26,26,0.2)"}}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-[18px]" style={{color:"var(--clr-error)"}}>error</span>
                  <span className="text-sm font-bold" style={{color:"var(--clr-error)"}}>Validation Failed</span>
                </div>
                {uploadError.errors?.map((e, i) => (
                  <p key={i} className="text-xs mt-1" style={{color:"var(--clr-error)"}}>• {e}</p>
                ))}
                {uploadError.warnings?.map((w, i) => (
                  <p key={i} className="text-xs mt-1" style={{color:"var(--clr-warn)"}}>⚠ {w}</p>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Camera Capture Tab ── */}
        {sourceTab === "camera" && (
          <div>
            {/* Create New Dataset */}
            <div className="vv-surface-low p-5 mb-4" style={{borderRadius: 8}}>
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-[18px]" style={{color:"var(--clr-accent)"}}>add_circle</span>
                <span className="text-sm font-semibold" style={{color:"var(--clr-text)"}}>Create New Dataset from Camera</span>
              </div>
              <p className="text-xs mb-4" style={{color:"var(--clr-text-muted)"}}>
                Capture images from your webcam, label them, and save as a new dataset.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1" style={{color:"var(--clr-text-muted)"}}>
                    Dataset Name
                  </label>
                  <input
                    type="text"
                    value={newDsName}
                    onChange={(e) => setNewDsName(e.target.value)}
                    placeholder="e.g. Defect-Samples-July"
                    style={{maxWidth: 320}}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1" style={{color:"var(--clr-text-muted)"}}>
                    Task Type
                  </label>
                  <select value={newDsTaskType} onChange={(e) => setNewDsTaskType(e.target.value)} style={{minWidth: 180}}>
                    <option value="classification">Classification (OK/NG)</option>
                    <option value="detection">Detection (YOLO)</option>
                  </select>
                </div>
              </div>
              <button
                className="btn-primary"
                disabled={!newDsName.trim() || creatingDs}
                onClick={async () => {
                  setCreatingDs(true);
                  try {
                    const result = await createDataset(newDsName.trim(), newDsTaskType);
                    setCameraTarget({id: result.dataset_id, name: result.name, task_type: result.task_type});
                    setShowCameraModal(true);
                    setNewDsName("");
                    loadDatasets();
                  } catch (err) {
                    alert("Failed to create dataset: " + err.message);
                  } finally {
                    setCreatingDs(false);
                  }
                }}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {creatingDs ? "hourglass_top" : "photo_camera"}
                </span>
                {creatingDs ? "Creating…" : "Create & Open Camera"}
              </button>
            </div>

            {/* Add to Existing Dataset */}
            {datasets.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[18px]" style={{color:"var(--clr-text-muted)"}}>folder_open</span>
                  <span className="text-sm font-semibold" style={{color:"var(--clr-text-sub)"}}>Or add to existing dataset</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {datasets.map(ds => (
                    <button
                      key={ds.id}
                      onClick={() => {
                        setCameraTarget(ds);
                        setShowCameraModal(true);
                      }}
                      className="flex items-center gap-3 p-4 rounded-lg border text-left transition-all"
                      style={{
                        background: "var(--clr-surface-low)",
                        borderColor: "var(--clr-border)",
                        cursor: "pointer",
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = "var(--clr-accent)";
                        e.currentTarget.style.background = "var(--clr-surface)";
                        e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,140,199,0.1)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = "var(--clr-border)";
                        e.currentTarget.style.background = "var(--clr-surface-low)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <span className="material-symbols-outlined text-[28px]" style={{color:"var(--clr-accent)"}}>photo_camera</span>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold truncate" style={{color:"var(--clr-text)"}}>{ds.name}</h4>
                        <p className="text-[11px]" style={{color:"var(--clr-text-muted)"}}>
                          {ds.num_images} images · {ds.task_type}
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-[20px]" style={{color:"var(--clr-text-muted)"}}>chevron_right</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════
         Dataset List
         ══════════════════════════════════════════════════ */}
      <div className="vv-card overflow-hidden animate-fade-in stagger-3">
        <div className="px-5 py-3 flex items-center justify-between" style={{borderBottom:"1px solid var(--clr-border)", background:"var(--clr-surface-low)"}}>
          <h3 className="text-sm font-semibold" style={{color:"var(--clr-text)"}}>Available Datasets</h3>
          <span className="text-xs font-mono" style={{color:"var(--clr-text-muted)"}}>{datasets.length} total</span>
        </div>

        {datasets.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-[48px] block mb-3" style={{color:"var(--clr-border)"}}>folder_open</span>
            <p className="text-sm" style={{color:"var(--clr-text-muted)"}}>No datasets uploaded yet</p>
          </div>
        ) : (
          <div>
            {datasets.map((ds) => (
              <div key={ds.id}>
                {/* Row */}
                <div
                  className="px-5 py-4 flex items-center justify-between hover:bg-[var(--clr-surface-low)] transition-colors cursor-pointer"
                  style={{borderBottom:"1px solid var(--clr-border)"}}
                  onClick={() => setExpandedId(expandedId === ds.id ? null : ds.id)}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="material-symbols-outlined text-[22px] shrink-0" style={{color:"var(--clr-accent)"}}>folder</span>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold truncate" style={{color:"var(--clr-text)"}}>{ds.name}</h4>
                      <p className="text-[11px] mt-0.5" style={{color:"var(--clr-text-muted)"}}>
                        {ds.num_images} images · {new Date(ds.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`badge ${ds.task_type === "classification" ? "badge-ready" : "badge-syncing"} shrink-0`}>
                      {ds.task_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Camera capture shortcut */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCameraTarget(ds);
                        setShowCameraModal(true);
                      }}
                      className="p-1.5 rounded transition-colors hover:text-[var(--clr-accent)]"
                      style={{color:"var(--clr-text-muted)"}}
                      title="Camera Capture"
                    >
                      <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(ds.id); }}
                      className="p-1.5 rounded transition-colors hover:text-[var(--clr-error)]"
                      style={{color:"var(--clr-text-muted)"}}
                      title="Delete"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                    <span
                      className={`material-symbols-outlined text-[20px] transition-transform ${expandedId === ds.id ? "rotate-180" : ""}`}
                      style={{color:"var(--clr-text-muted)"}}
                    >
                      expand_more
                    </span>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedId === ds.id && (
                  <div className="px-5 pb-5" style={{background:"var(--clr-surface-low)", borderBottom:"1px solid var(--clr-border)"}}>
                    {/* Classes */}
                    {ds.classes && (
                      <div className="flex gap-2 mt-3 flex-wrap">
                        {JSON.parse(ds.classes || "[]").map((cls, i) => (
                          <span key={i} className="badge badge-archived">{cls}</span>
                        ))}
                      </div>
                    )}
                    {/* Dataset Explorer */}
                    <div className="mt-4">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{color:"var(--clr-text-muted)"}}>Dataset Explorer</h4>
                      <DatasetExplorer datasetId={ds.id} />
                    </div>
                    <p className="text-[10px] mt-4 font-mono" style={{color:"var(--clr-text-muted)"}}>ID: {ds.id}</p>
                  </div>
                )}

                {/* Delete Confirmation */}
                {deleteConfirm === ds.id && (
                  <div className="px-5 py-3 flex items-center justify-between" style={{background:"rgba(186,26,26,0.05)", borderTop:"1px solid rgba(186,26,26,0.15)", borderBottom:"1px solid var(--clr-border)"}}>
                    <p className="text-sm" style={{color:"var(--clr-error)"}}>Delete this dataset permanently?</p>
                    <div className="flex gap-2">
                      <button onClick={() => setDeleteConfirm(null)} className="btn-outline px-3 py-1.5 text-xs">Cancel</button>
                      <button onClick={() => handleDelete(ds.id)} className="btn-primary px-3 py-1.5 text-xs" style={{background:"var(--clr-error)"}}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Camera Capture Modal */}
      {showCameraModal && cameraTarget && (
        <CameraCapture
          datasetId={cameraTarget.id}
          currentPath=""
          onClose={() => {
            setShowCameraModal(false);
            setCameraTarget(null);
          }}
          onSaved={() => {
            loadDatasets();
            setShowCameraModal(false);
            setCameraTarget(null);
          }}
        />
      )}
    </div>
  );
}
