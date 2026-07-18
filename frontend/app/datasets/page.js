"use client";

import {useState, useEffect, useRef} from "react";
import {fetchDatasets, uploadDataset, deleteDataset} from "@/lib/api";
import DatasetExplorer from "@/components/DatasetExplorer";

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

      {/* Upload Section */}
      <div className="vv-card p-6 animate-fade-in stagger-2">
        <h3 className="text-sm font-semibold mb-5 uppercase tracking-wider" style={{color:"var(--clr-text-sub)"}}>
          Upload New Dataset
        </h3>

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
      </div>

      {/* Dataset List */}
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
    </div>
  );
}
