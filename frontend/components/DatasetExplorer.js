"use client";

import {useState, useEffect, useRef} from "react";
import {fetchDatasetImages, deleteDatasetImage, addImagesToDataset} from "@/lib/api";

export default function DatasetExplorer({datasetId, onUpdate}) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => { loadImages(); }, [datasetId]);

  const loadImages = async () => {
    try {
      const data = await fetchDatasetImages(datasetId);
      setImages((data || []).map(d => ({...d, filename: d.filename.replace(/\\/g, "/")})));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleDelete = async (filename, e) => {
    e.stopPropagation();
    if (!confirm("Delete this image?")) return;
    try {
      await deleteDatasetImage(datasetId, filename);
      await loadImages();
      if (onUpdate) onUpdate();
    } catch (err) { alert("Failed to delete: " + err.message); }
  };

  const handleFileChange = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("path", currentPath);
    for (let i = 0; i < files.length; i++) formData.append("files", files[i]);
    try {
      await addImagesToDataset(datasetId, formData);
      await loadImages();
      if (onUpdate) onUpdate();
    } catch (err) { alert("Failed to upload: " + err.message); }
    finally { setIsUploading(false); e.target.value = ""; }
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-xs animate-pulse" style={{color:"var(--clr-text-muted)"}}>
        <div className="w-5 h-5 border-2 rounded-full animate-spin mx-auto mb-2" style={{borderColor:"var(--clr-border)", borderTopColor:"var(--clr-accent)"}} />
        Loading files…
      </div>
    );
  }

  // Build folder tree from flat list
  const folders = new Set();
  const currentFiles = [];
  images.forEach(img => {
    if (img.filename.startsWith(currentPath)) {
      const remainder = img.filename.slice(currentPath.length).replace(/^\//, "");
      const parts = remainder.split("/");
      if (parts.length > 1) folders.add(parts[0]);
      else if (parts.length === 1 && parts[0] !== "") currentFiles.push(img);
    }
  });
  const folderList = Array.from(folders).sort();

  const navigateUp = () => {
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    setCurrentPath(parts.length > 0 ? parts.join("/") + "/" : "");
  };

  const navigateDown = (name) => setCurrentPath(p => p ? p + name + "/" : name + "/");

  return (
    <div className="mt-3 vv-card overflow-hidden">
      {/* Breadcrumb / Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{borderBottom:"1px solid var(--clr-border)", background:"var(--clr-surface-low)"}}>
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={navigateUp}
            disabled={!currentPath}
            title="Go up"
            className="p-1.5 rounded border disabled:opacity-30 transition-colors"
            style={{color:"var(--clr-text-sub)", borderColor:"var(--clr-border)"}}
            onMouseEnter={e => { if (currentPath) { e.currentTarget.style.background="var(--clr-surface-mid)"; e.currentTarget.style.color="var(--clr-text)"; }}}
            onMouseLeave={e => { e.currentTarget.style.background=""; e.currentTarget.style.color="var(--clr-text-sub)"; }}
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          </button>
          <div className="flex items-center gap-1 text-xs font-mono min-w-0 overflow-hidden">
            <span className="font-bold shrink-0" style={{color:"var(--clr-accent)"}}>root/</span>
            {currentPath && <span className="truncate" style={{color:"var(--clr-text-sub)"}}>{currentPath}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <input
            type="file" multiple accept="image/*,.zip"
            ref={fileInputRef} className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="btn-outline text-xs py-1.5 px-3 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[15px]">{isUploading ? "hourglass_top" : "upload"}</span>
            {isUploading ? "Uploading…" : "Upload Here"}
          </button>
        </div>
      </div>

      {/* File Grid */}
      <div className="p-4 max-h-96 overflow-y-auto" style={{background:"var(--clr-surface)"}}>
        {folderList.length === 0 && currentFiles.length === 0 ? (
          <div className="text-center py-8 text-xs" style={{color:"var(--clr-text-muted)"}}>
            <span className="material-symbols-outlined text-[32px] block mb-2" style={{opacity:0.4}}>folder_open</span>
            Empty directory
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {/* Folders */}
            {folderList.map(f => (
              <div
                key={f}
                onClick={() => navigateDown(f)}
                className="flex flex-col items-center justify-center p-3 rounded border cursor-pointer transition-all group"
                style={{background:"var(--clr-surface-low)", borderColor:"var(--clr-border)"}}
                onMouseEnter={e => { e.currentTarget.style.borderColor="var(--clr-accent)"; e.currentTarget.style.background="var(--clr-surface-mid)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor="var(--clr-border)"; e.currentTarget.style.background="var(--clr-surface-low)"; }}
              >
                <span className="material-symbols-outlined text-[36px] mb-1.5 transition-transform group-hover:scale-110"
                  style={{color:"var(--clr-warn)", fontVariationSettings:"'FILL' 1"}}>folder</span>
                <span className="text-[10px] font-semibold text-center truncate w-full" style={{color:"var(--clr-text-sub)"}}>{f}</span>
              </div>
            ))}

            {/* Image Files */}
            {currentFiles.map((file, idx) => (
              <div key={idx} className="group flex flex-col rounded overflow-hidden border relative"
                style={{borderColor:"var(--clr-border)", background:"var(--clr-surface-low)"}}>
                {/* Delete */}
                <button
                  onClick={(e) => handleDelete(file.filename, e)}
                  title="Delete image"
                  className="absolute top-1 right-1 z-20 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{background:"var(--clr-error)", color:"#fff"}}
                >
                  <span className="material-symbols-outlined text-[14px]">delete</span>
                </button>

                {/* Image */}
                <div className="w-full aspect-square relative overflow-hidden" style={{background:"var(--clr-surface-mid)"}}>
                  <img
                    src={`http://localhost:8000${file.url}`}
                    alt={file.filename}
                    className="w-full h-full object-cover group-hover:opacity-75 transition-opacity"
                    loading="lazy"
                  />
                  <a
                    href={`http://localhost:8000${file.url}`}
                    target="_blank" rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{background:"rgba(0,0,0,.5)"}}
                  >
                    <span className="btn-primary text-[10px] px-2 py-1">View</span>
                  </a>
                </div>

                {/* Name */}
                <div className="px-2 py-1.5" style={{background:"var(--clr-surface-low)"}}>
                  <span className="text-[9px] font-mono truncate block w-full" style={{color:"var(--clr-text-muted)"}}>
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
