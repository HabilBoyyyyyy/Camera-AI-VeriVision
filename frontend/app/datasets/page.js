"use client";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faChevronDown,
  faDatabase,
  faExclamationTriangle,
  faFolder,
  faTrash,
  faUpload,
} from "@fortawesome/free-solid-svg-icons";

import {useState, useEffect, useRef} from "react";
import {fetchDatasets, uploadDataset, deleteDataset} from "@/lib/api";
import DatasetExplorer from "@/components/DatasetExplorer";

function UploadIcon(p) {
  return <FontAwesomeIcon icon={faUpload} className={p.className || ""} />;
}
function DatabaseIcon(p) {
  return <FontAwesomeIcon icon={faDatabase} className={p.className || ""} />;
}
function TrashIcon(p) {
  return <FontAwesomeIcon icon={faTrash} className={p.className || ""} />;
}
function CheckIcon(p) {
  return <FontAwesomeIcon icon={faCheck} className={p.className || ""} />;
}
function AlertIcon(p) {
  return (
    <FontAwesomeIcon
      icon={faExclamationTriangle}
      className={p.className || ""}
    />
  );
}
function ChevronIcon(p) {
  return <FontAwesomeIcon icon={faChevronDown} className={p.className || ""} />;
}
function FolderIcon(p) {
  return <FontAwesomeIcon icon={faFolder} className={p.className || ""} />;
}

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

  useEffect(() => {
    loadDatasets();
  }, []);

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
          <DatabaseIcon className="w-5 h-5 text-[#f5a623]" />
          <h1 className="text-xl font-display font-bold text-[#e4e7eb] tracking-wide uppercase">
            Upload Dataset
          </h1>
        </div>
        <p className="text-sm text-[#5a6270] ml-8">
          Upload training datasets as .zip files for model training
        </p>
      </div>

      {/* Upload Section */}
      <div className="glass-card p-6 animate-fade-in stagger-2">
        <h2 className="section-label mb-4">New Dataset</h2>

        {/* Task Type Selector */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-[#5a6270] uppercase tracking-wider mb-2 font-mono">
            Task Type
          </label>
          <select
            value={taskType}
            onChange={(e) => setTaskType(e.target.value)}
            className="w-full max-w-xs px-4 py-2.5 rounded bg-[#0f1216] border border-[#2b313a] text-[#dbe0e6] text-sm focus:outline-none focus:border-[#f5a623]/60">
            <option value="classification">Classification (OK/NG)</option>
            <option value="detection">Detection (YOLO)</option>
          </select>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`relative border-2 border-dashed rounded p-10 text-center cursor-pointer transition-colors duration-200 ${
            dragOver
              ? "border-[#f5a623] bg-[#f5a623]/5"
              : file
                ? "border-[#2fb380]/60 bg-[#2fb380]/5"
                : "border-[#2b313a] hover:border-[#3a4149] bg-[#0f1216] hover:bg-[#14171c]"
          }`}>
          <input
            ref={fileRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => {
              if (e.target.files[0]) setFile(e.target.files[0]);
            }}
          />
          <UploadIcon
            className={`w-10 h-10 mx-auto mb-3 ${file ? "text-[#4fd39a]" : "text-[#5a6270]"}`}
          />
          {file ? (
            <>
              <p className="text-sm font-semibold text-[#4fd39a]">
                {file.name}
              </p>
              <p className="text-xs text-[#5a6270] mt-1">
                {(file.size / 1024 / 1024).toFixed(2)} MB — Click or drop to
                replace
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-[#8a93a3]">
                Drop your .zip dataset here
              </p>
              <p className="text-xs text-[#5a6270] mt-1">or click to browse</p>
              <p className="text-[10px] text-[#3a4149] mt-3 max-w-md mx-auto font-mono">
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
          className="mt-4 px-8 py-3 rounded bg-[#f5a623] hover:bg-[#ffb63f] text-[#14171c] font-bold text-sm shadow-lg transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider font-display">
          {uploading ? "Uploading & Validating..." : "Upload Dataset"}
        </button>

        {/* Upload Result */}
        {uploadResult && (
          <div className="mt-4 p-4 rounded bg-[#2fb380]/10 border border-[#2fb380]/30">
            <div className="flex items-center gap-2 mb-2">
              <CheckIcon className="w-4 h-4 text-[#4fd39a]" />
              <span className="text-sm font-bold text-[#4fd39a]">
                Dataset uploaded successfully!
              </span>
            </div>
            {uploadResult.summary && (
              <div className="text-xs text-[#8a93a3] space-y-1 mt-2">
                <p>
                  Total images:{" "}
                  <span className="text-[#dbe0e6] font-mono">
                    {uploadResult.summary.total_images}
                  </span>
                </p>
                {uploadResult.summary.classes && (
                  <p>
                    Classes:{" "}
                    <span className="text-[#dbe0e6] font-mono">
                      {uploadResult.summary.classes.join(", ")}
                    </span>
                  </p>
                )}
              </div>
            )}
            {uploadResult.warnings?.length > 0 && (
              <div className="mt-2 space-y-1">
                {uploadResult.warnings.map((w, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-xs text-[#f5a623]">
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
          <div className="mt-4 p-4 rounded bg-[#e5484d]/10 border border-[#e5484d]/30">
            <div className="flex items-center gap-2 mb-2">
              <AlertIcon className="w-4 h-4 text-[#f26e72]" />
              <span className="text-sm font-bold text-[#f26e72]">
                Validation Failed
              </span>
            </div>
            {uploadError.errors?.map((e, i) => (
              <p key={i} className="text-xs text-[#f26e72] mt-1">
                • {e}
              </p>
            ))}
            {uploadError.warnings?.map((w, i) => (
              <p key={i} className="text-xs text-[#f5a623] mt-1">
                ⚠ {w}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Dataset List */}
      <div className="glass-card overflow-hidden animate-fade-in stagger-3">
        <div className="px-6 py-4 border-b border-[#2b313a] bg-[#181c22] flex items-center justify-between">
          <h2 className="section-label">Available Datasets</h2>
          <span className="text-xs text-[#5a6270] font-mono">
            {datasets.length} total
          </span>
        </div>

        {datasets.length === 0 ? (
          <div className="p-12 text-center">
            <FolderIcon className="w-10 h-10 text-[#333b46] mx-auto mb-3" />
            <p className="text-sm text-[#5a6270]">No datasets uploaded yet</p>
          </div>
        ) : (
          <div className="divide-y divide-[#232830]">
            {datasets.map((ds) => (
              <div key={ds.id}>
                <div
                  className="px-6 py-4 flex items-center justify-between hover:bg-[#1e232a] transition-colors cursor-pointer"
                  onClick={() =>
                    setExpandedId(expandedId === ds.id ? null : ds.id)
                  }>
                  <div className="flex items-center gap-4 min-w-0">
                    <FolderIcon className="w-5 h-5 text-[#f5a623] shrink-0" />
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[#dbe0e6] truncate">
                        {ds.name}
                      </h3>
                      <p className="text-[11px] text-[#5a6270] mt-0.5">
                        {ds.num_images} images •{" "}
                        {new Date(ds.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider font-mono ${
                        ds.task_type === "classification"
                          ? "bg-[#7a8ba8]/15 text-[#9db3d4] border border-[#7a8ba8]/25"
                          : "bg-[#a685c2]/15 text-[#c7a6e0] border border-[#a685c2]/25"
                      }`}>
                      {ds.task_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(ds.id);
                      }}
                      className="p-2 rounded text-[#5a6270] hover:text-[#f26e72] hover:bg-[#e5484d]/10 transition-colors">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                    <ChevronIcon
                      className={`w-4 h-4 text-[#5a6270] transition-transform ${expandedId === ds.id ? "rotate-180" : ""}`}
                    />
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedId === ds.id && (
                  <div className="px-6 pb-6 bg-[#14171c]">
                    <div className="flex items-center justify-between mt-3 mb-2">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
                        {ds.classes &&
                          JSON.parse(ds.classes || "[]").map((cls, i) => (
                            <div
                              key={i}
                              className="surface-inset p-3 rounded flex items-center justify-center">
                              <div className="text-[10px] font-bold text-[#5a6270] uppercase tracking-wider font-mono">
                                {cls}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Dataset Explorer */}
                    <div className="mt-4">
                      <h4 className="text-xs font-bold text-[#5a6270] uppercase tracking-wider mb-2 font-mono">
                        Dataset Explorer
                      </h4>
                      <DatasetExplorer datasetId={ds.id} />
                    </div>

                    <p className="text-[10px] text-[#3a4149] mt-4 font-mono">
                      ID: {ds.id}
                    </p>
                  </div>
                )}

                {/* Delete Confirmation */}
                {deleteConfirm === ds.id && (
                  <div className="px-6 py-3 bg-[#e5484d]/5 border-t border-[#e5484d]/25 flex items-center justify-between">
                    <p className="text-sm text-[#f26e72]">
                      Delete this dataset permanently?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-3 py-1.5 rounded text-xs font-bold text-[#8a93a3] hover:bg-[#232830] transition-colors">
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDelete(ds.id)}
                        className="px-3 py-1.5 rounded text-xs font-bold bg-[#e5484d] hover:bg-[#f26e72] text-white transition-colors">
                        Delete
                      </button>
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
