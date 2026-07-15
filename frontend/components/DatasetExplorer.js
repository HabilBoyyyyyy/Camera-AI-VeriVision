"use client";

import { useState, useEffect } from "react";
import { fetchDatasetImages } from "@/lib/api";

function FolderIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>; }
function ImageIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>; }
function ArrowLeftIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>; }

export default function DatasetExplorer({ datasetId }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState("");

  useEffect(() => {
    loadImages();
  }, [datasetId]);

  const loadImages = async () => {
    try {
      const data = await fetchDatasetImages(datasetId);
      // Ensure paths use forward slash for parsing
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
        // It's in a subfolder
        folders.add(parts[0]);
      } else if (parts.length === 1 && parts[0] !== "") {
        // It's a file in this folder
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
      <div className="flex items-center px-4 py-3 bg-slate-800/80 border-b border-slate-700/50">
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
