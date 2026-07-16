"use client";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faFolder, faImage, faTrash, faUpload } from '@fortawesome/free-solid-svg-icons';



import { useState, useEffect, useRef } from "react";
import { fetchDatasetImages, deleteDatasetImage, addImagesToDataset } from "@/lib/api";

function FolderIcon(p) { return <FontAwesomeIcon icon={faFolder} className={p.className || ''} /> ; }
function ImageIcon(p) { return <FontAwesomeIcon icon={faImage} className={p.className || ''} /> ; }
function ArrowLeftIcon(p) { return <FontAwesomeIcon icon={faArrowLeft} className={p.className || ''} /> ; }
function TrashIcon(p) { return <FontAwesomeIcon icon={faTrash} className={p.className || ''} /> ; }
function UploadIcon(p) { return <FontAwesomeIcon icon={faUpload} className={p.className || ''} /> ; }

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
    return <div className="p-6 text-center text-xs text-[#5a6270] animate-pulse">Loading files...</div>;
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
    <div className="mt-4 border border-[#2b313a] rounded overflow-hidden bg-[#0f1216]">
      {/* Breadcrumb Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#181c22] border-b border-[#2b313a]">
        <div className="flex items-center">
          <button
            onClick={handleNavigateUp}
            disabled={!currentPath}
            className="p-1.5 rounded bg-[#1a1e24] hover:bg-[#232830] text-[#8a93a3] disabled:opacity-30 disabled:cursor-not-allowed transition-colors mr-3 border border-[#2b313a]"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 text-xs font-mono text-[#8a93a3] truncate">
            <span className="text-[#f5a623] font-bold">root/</span>
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
            className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-[#f5a623] hover:bg-[#ffb63f] text-[#14171c] rounded shadow-lg disabled:opacity-50 transition-colors"
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
          <div className="text-center py-8 text-xs text-[#5a6270]">Empty directory</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {folderList.map(f => (
              <div
                key={f}
                onClick={() => handleNavigateDown(f)}
                className="group flex flex-col items-center justify-center p-4 rounded border border-[#2b313a] bg-[#1a1e24] hover:bg-[#232830] hover:border-[#f5a623]/40 cursor-pointer transition-colors"
              >
                <FolderIcon className="w-10 h-10 text-[#f5a623] mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold text-[#8a93a3] text-center truncate w-full">{f}</span>
              </div>
            ))}

            {currentFiles.map((file, idx) => (
              <div key={idx} className="group flex flex-col items-center rounded overflow-hidden border border-[#2b313a] bg-[#1a1e24] relative">

                {/* Delete Button */}
                <button
                  onClick={(e) => handleDelete(file.filename, e)}
                  className="absolute top-1 right-1 z-20 p-1.5 bg-[#e5484d] hover:bg-[#f26e72] text-white rounded opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  title="Delete image"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>

                <div className="w-full aspect-square bg-[#0f1216] relative">
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
                    className="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-[#0f1216]/70"
                  >
                    <span className="px-2 py-1 rounded bg-[#f5a623] text-[#14171c] text-[10px] font-bold shadow-lg">View</span>
                  </a>
                </div>
                <div className="w-full p-2 text-center bg-[#181c22]">
                  <span className="text-[9px] font-mono text-[#5a6270] truncate block w-full">
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