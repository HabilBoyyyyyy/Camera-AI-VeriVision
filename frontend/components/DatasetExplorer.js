"use client";

import { useState, useEffect, useRef } from "react";
import { fetchDatasetImages, deleteDatasetImage, addImagesToDataset } from "@/lib/api";

function FolderIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>; }
function ImageIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>; }
function ArrowLeftIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>; }
function TrashIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>; }
function UploadIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>; }

export default function DatasetExplorer({ datasetId, onUpdate }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadImages();
  }, [datasetId]);

  const loadImages = async () => {
    try {
      const data = await fetchDatasetImages(datasetId);
      const normalized = data.map(d => ({
        ...d,
        filename: d.filename.replace(/\\/g, "/")
      }));
      setImages(normalized);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (filename, e) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this image?")) return;
    try {
      await deleteDatasetImage(datasetId, filename);
      await loadImages();
      if (onUpdate) onUpdate();
    } catch (error) {
      alert("Failed to delete: " + error.message);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("path", currentPath);
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }

    try {
      await addImagesToDataset(datasetId, formData);
      await loadImages();
      if (onUpdate) onUpdate();
    } catch (error) {
      alert("Failed to upload images: " + error.message);
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-xs text-slate-500 animate-pulse">Loading files...</div>;
  }

  // Parse current directory contents
  const folders = new Set();
  const currentFiles = [];

  images.forEach(img => {
    if (img.filename.startsWith(currentPath)) {
      const remainder = img.filename.slice(currentPath.length).replace(/^\//, "");
      const parts = remainder.split("/");
      if (parts.length > 1) {
        folders.add(parts[0]);
      } else if (parts.length === 1 && parts[0] !== "") {
        currentFiles.push(img);
      }
    }
  });

  const folderList = Array.from(folders).sort();

  const handleNavigateUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    setCurrentPath(parts.length > 0 ? parts.join("/") + "/" : "");
  };

  const handleNavigateDown = (folderName) => {
    setCurrentPath(prev => (prev ? prev + folderName + "/" : folderName + "/"));
  };

  return (
    <div className="mt-4 border border-slate-700/50 rounded-xl overflow-hidden bg-slate-900/50">
      {/* Breadcrumb Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/80 border-b border-slate-700/50">
        <div className="flex items-center">
          <button
            onClick={handleNavigateUp}
            disabled={!currentPath}
            className="p-1.5 rounded bg-slate-700/50 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors mr-3"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300 truncate">
            <span className="text-cyan-500 font-bold">root/</span>
            {currentPath && <span>{currentPath}</span>}
          </div>
        </div>

        {/* Upload Button */}
        <div className="flex items-center">
          <input 
            type="file" 
            multiple 
            accept="image/*,.zip" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileChange} 
          />
          <button
            onClick={handleUploadClick}
            disabled={isUploading}
            className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg shadow-lg disabled:opacity-50 transition-colors"
          >
            {isUploading ? "Uploading..." : (
              <><UploadIcon className="w-3.5 h-3.5" /> Upload Here</>
            )}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {folderList.length === 0 && currentFiles.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">Empty directory</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {folderList.map(f => (
              <div
                key={f}
                onClick={() => handleNavigateDown(f)}
                className="group flex flex-col items-center justify-center p-4 rounded-xl border border-slate-700/30 bg-slate-800/30 hover:bg-slate-700/50 hover:border-cyan-500/30 cursor-pointer transition-all"
              >
                <FolderIcon className="w-10 h-10 text-cyan-500 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold text-slate-300 text-center truncate w-full">{f}</span>
              </div>
            ))}
            
            {currentFiles.map((file, idx) => (
              <div key={idx} className="group flex flex-col items-center rounded-xl overflow-hidden border border-slate-700/30 bg-slate-800/30 relative">
                
                {/* Delete Button */}
                <button 
                  onClick={(e) => handleDelete(file.filename, e)}
                  className="absolute top-1 right-1 z-20 p-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  title="Delete image"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>

                <div className="w-full aspect-square bg-slate-900 relative">
                  <img
                    src={`http://localhost:8000${file.url}`}
                    alt={file.filename}
                    className="w-full h-full object-cover group-hover:opacity-75 transition-opacity"
                    loading="lazy"
                  />
                  <a
                    href={`http://localhost:8000${file.url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/60"
                  >
                    <span className="px-2 py-1 rounded bg-cyan-500 text-white text-[10px] font-bold shadow-lg">View</span>
                  </a>
                </div>
                <div className="w-full p-2 text-center bg-slate-800/80">
                  <span className="text-[9px] font-mono text-slate-400 truncate block w-full">
                    {file.filename.split("/").pop()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
