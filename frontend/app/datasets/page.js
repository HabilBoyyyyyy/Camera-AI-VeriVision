"use client";

import { useState, useEffect, useRef } from "react";
import { fetchDatasets, uploadDataset, deleteDataset } from "@/lib/api";
import DatasetExplorer from "@/components/DatasetExplorer";

function UploadIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>; }
function DatabaseIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>; }
function TrashIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>; }
function CheckIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>; }
function AlertIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>; }
function ChevronIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>; }
function FolderIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>; }

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
    } catch (e) {
      console.error(e);
    }
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
        setUploadError({ errors: [err.message] });
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDataset(id);
      setDeleteConfirm(null);
      loadDatasets();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith(".zip")) setFile(f);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-10">
      {/* Header */}
      <div className="animate-fade-in stagger-1">
        <div className="flex items-center gap-3 mb-1">
          <DatabaseIcon className="w-5 h-5 text-cyan-500" />
          <h1 className="text-xl font-semibold text-slate-100 tracking-tight">Upload Dataset</h1>
        </div>
        <p className="text-sm text-slate-500 ml-8">Upload training datasets as .zip files for model training</p>
      </div>

      {/* Upload Section */}
      <div className="glass-card p-6 animate-fade-in stagger-2">
        <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-4">New Dataset</h2>
        
        {/* Task Type Selector */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Task Type</label>
          <select
            value={taskType}
            onChange={(e) => setTaskType(e.target.value)}
            className="w-full max-w-xs px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 text-sm focus:outline-none focus:border-cyan-500/50"
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
          className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 ${
            dragOver
              ? "border-cyan-500 bg-cyan-500/5"
              : file
                ? "border-emerald-500/50 bg-emerald-500/5"
                : "border-slate-700 hover:border-slate-600 bg-slate-800/30 hover:bg-slate-800/50"
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => { if (e.target.files[0]) setFile(e.target.files[0]); }}
          />
          <UploadIcon className={`w-10 h-10 mx-auto mb-3 ${file ? "text-emerald-400" : "text-slate-500"}`} />
          {file ? (
            <>
              <p className="text-sm font-semibold text-emerald-400">{file.name}</p>
              <p className="text-xs text-slate-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB — Click or drop to replace</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-300">Drop your .zip dataset here</p>
              <p className="text-xs text-slate-500 mt-1">or click to browse</p>
              <p className="text-[10px] text-slate-600 mt-3 max-w-md mx-auto">
                {taskType === "classification"
                  ? "Expected: train/(OK,NG)/*.jpg + valid/(OK,NG)/*.jpg — or just OK/ + NG/ folders (auto-split)"
                  : "Expected: images/train/*.jpg + images/valid/*.jpg + labels/train/*.txt + labels/valid/*.txt + data.yaml"}
              </p>
            </>
          )}
        </div>

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="mt-4 px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/20 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider"
        >
          {uploading ? "Uploading & Validating..." : "Upload Dataset"}
        </button>

        {/* Upload Result */}
        {uploadResult && (
          <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <div className="flex items-center gap-2 mb-2">
              <CheckIcon className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-bold text-emerald-400">Dataset uploaded successfully!</span>
            </div>
            {uploadResult.summary && (
              <div className="text-xs text-slate-400 space-y-1 mt-2">
                <p>Total images: <span className="text-slate-200 font-mono">{uploadResult.summary.total_images}</span></p>
                {uploadResult.summary.classes && (
                  <p>Classes: <span className="text-slate-200 font-mono">{uploadResult.summary.classes.join(", ")}</span></p>
                )}
              </div>
            )}
            {uploadResult.warnings?.length > 0 && (
              <div className="mt-2 space-y-1">
                {uploadResult.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-amber-400">
                    <AlertIcon className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Upload Error */}
        {uploadError && (
          <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
            <div className="flex items-center gap-2 mb-2">
              <AlertIcon className="w-4 h-4 text-red-400" />
              <span className="text-sm font-bold text-red-400">Validation Failed</span>
            </div>
            {uploadError.errors?.map((e, i) => (
              <p key={i} className="text-xs text-red-300 mt-1">• {e}</p>
            ))}
            {uploadError.warnings?.map((w, i) => (
              <p key={i} className="text-xs text-amber-400 mt-1">⚠ {w}</p>
            ))}
          </div>
        )}
      </div>

      {/* Dataset List */}
      <div className="glass-card overflow-hidden animate-fade-in stagger-3">
        <div className="px-6 py-4 border-b border-slate-700/30 bg-slate-800/30 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Available Datasets</h2>
          <span className="text-xs text-slate-500 font-mono">{datasets.length} total</span>
        </div>

        {datasets.length === 0 ? (
          <div className="p-12 text-center">
            <FolderIcon className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No datasets uploaded yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {datasets.map((ds) => (
              <div key={ds.id}>
                <div
                  className="px-6 py-4 flex items-center justify-between hover:bg-slate-800/20 transition-colors cursor-pointer"
                  onClick={() => setExpandedId(expandedId === ds.id ? null : ds.id)}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <FolderIcon className="w-5 h-5 text-cyan-400 shrink-0" />
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-200 truncate">{ds.name}</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {ds.num_images} images • {new Date(ds.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                      ds.task_type === "classification"
                        ? "bg-blue-500/15 text-blue-400 border border-blue-500/20"
                        : "bg-purple-500/15 text-purple-400 border border-purple-500/20"
                    }`}>
                      {ds.task_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(ds.id); }}
                      className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                    <ChevronIcon className={`w-4 h-4 text-slate-500 transition-transform ${expandedId === ds.id ? "rotate-180" : ""}`} />
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedId === ds.id && (
                  <div className="px-6 pb-6 bg-slate-800/10">
                    <div className="flex items-center justify-between mt-3 mb-2">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
                        {ds.classes && JSON.parse(ds.classes || "[]").map((cls, i) => (
                          <div key={i} className="surface-inset p-3 rounded-lg flex items-center justify-center">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{cls}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Dataset Explorer */}
                    <div className="mt-4">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Dataset Explorer</h4>
                      <DatasetExplorer datasetId={ds.id} />
                    </div>
                    
                    <p className="text-[10px] text-slate-600 mt-4 font-mono">ID: {ds.id}</p>
                  </div>
                )}

                {/* Delete Confirmation */}
                {deleteConfirm === ds.id && (
                  <div className="px-6 py-3 bg-red-500/5 border-t border-red-500/20 flex items-center justify-between">
                    <p className="text-sm text-red-300">Delete this dataset permanently?</p>
                    <div className="flex gap-2">
                      <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:bg-slate-800 transition-colors">Cancel</button>
                      <button onClick={() => handleDelete(ds.id)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition-colors">Delete</button>
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
