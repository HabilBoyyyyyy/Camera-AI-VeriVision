"use client";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faDownload, faList, faFilter, faTimes, faTrash } from '@fortawesome/free-solid-svg-icons';

import { useState, useEffect } from "react";
import { fetchResults, getResultsExportUrl, fetchModels, deleteResult } from "@/lib/api";

function ListIcon(p) { return <FontAwesomeIcon icon={faList} className={p.className || ''} /> ; }
function DownloadIcon(p) { return <FontAwesomeIcon icon={faDownload} className={p.className || ''} /> ; }
function ChevronLeftIcon(p) { return <FontAwesomeIcon icon={faChevronLeft} className={p.className || ''} /> ; }
function ChevronRightIcon(p) { return <FontAwesomeIcon icon={faChevronRight} className={p.className || ''} /> ; }
function FilterIcon(p) { return <FontAwesomeIcon icon={faFilter} className={p.className || ''} /> ; }
function TimesIcon(p) { return <FontAwesomeIcon icon={faTimes} className={p.className || ''} /> ; }
function TrashIcon(p) { return <FontAwesomeIcon icon={faTrash} className={p.className || ''} /> ; }

export default function ResultsPage() {
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  
  // Available models for dropdown
  const [modelsList, setModelsList] = useState([]);
  
  // Advanced Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    verdict: "",
    model_id: "",
    start_date: "",
    end_date: "",
    min_conf: "",
    max_conf: "",
    search_id: "",
  });
  
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    // Load models for the filter dropdown
    fetchModels().then(data => setModelsList(data || [])).catch(console.error);
  }, []);

  const loadResults = async () => {
    setLoading(true);
    try {
      const data = await fetchResults(page, limit, filters);
      setResults(data.items || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // Re-load when page changes or when filters are applied (debounced/handled by a button)
  useEffect(() => { loadResults(); }, [page]);

  const applyFilters = () => {
    setPage(1);
    loadResults();
  };

  const resetFilters = () => {
    setFilters({
      verdict: "",
      model_id: "",
      start_date: "",
      end_date: "",
      min_conf: "",
      max_conf: "",
      search_id: "",
    });
    setPage(1);
    // React state update is async, so we'll wait for the next render or load manually
    setTimeout(() => {
      loadResults();
    }, 0);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const verdictBadge = (v) => {
    if (v === "OK") return "bg-[#2fb380]/15 text-[#4fd39a] border-[#2fb380]/25";
    if (v === "NG") return "bg-[#e5484d]/15 text-[#f26e72] border-[#e5484d]/25";
    return "bg-[#f5a623]/15 text-[#f5a623] border-[#f5a623]/25";
  };

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this inspection result?")) {
      try {
        await deleteResult(id);
        loadResults(); // Reload the list after deletion
      } catch (e) {
        console.error("Failed to delete", e);
        alert("Failed to delete result.");
      }
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in stagger-1">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <ListIcon className="w-5 h-5 text-[#f5a623]" />
            <h1 className="text-xl font-display font-bold text-[#e4e7eb] tracking-wide uppercase">Inspection Results</h1>
          </div>
          <p className="text-sm text-[#5a6270] ml-8">{total} total inspections</p>
        </div>
        <div className="flex gap-3 items-center">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold transition-colors border ${showFilters ? 'bg-[#f5a623]/20 text-[#f5a623] border-[#f5a623]/40' : 'bg-[#1a1e24] text-[#8a93a3] border-[#2b313a] hover:bg-[#232830]'}`}
          >
            <FilterIcon className="w-3.5 h-3.5" /> Filters
          </button>
          <a
            href={getResultsExportUrl(filters)}
            className="flex items-center gap-2 px-4 py-2 rounded bg-[#f5a623]/10 hover:bg-[#f5a623]/20 text-[#f5a623] text-xs font-bold transition-colors border border-[#f5a623]/25"
          >
            <DownloadIcon className="w-3.5 h-3.5" /> Export CSV
          </a>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="glass-card p-5 animate-fade-in stagger-2 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* Search ID */}
            <div>
              <label className="block text-[10px] font-bold text-[#5a6270] uppercase tracking-wider font-mono mb-1.5">Search ID</label>
              <input 
                type="text" 
                placeholder="Partial or full ID..."
                value={filters.search_id}
                onChange={(e) => handleFilterChange('search_id', e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#0f1216] border border-[#2b313a] text-[#dbe0e6] text-sm focus:outline-none focus:border-[#f5a623]/60"
              />
            </div>

            {/* Verdict */}
            <div>
              <label className="block text-[10px] font-bold text-[#5a6270] uppercase tracking-wider font-mono mb-1.5">Verdict</label>
              <select
                value={filters.verdict}
                onChange={(e) => handleFilterChange('verdict', e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#0f1216] border border-[#2b313a] text-[#dbe0e6] text-sm focus:outline-none focus:border-[#f5a623]/60"
              >
                <option value="">All Verdicts</option>
                <option value="OK">OK (Pass)</option>
                <option value="NG">NG (Fail)</option>
                <option value="Uncertain">Uncertain</option>
              </select>
            </div>

            {/* Model Selection */}
            <div>
              <label className="block text-[10px] font-bold text-[#5a6270] uppercase tracking-wider font-mono mb-1.5">AI Model</label>
              <select
                value={filters.model_id}
                onChange={(e) => handleFilterChange('model_id', e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#0f1216] border border-[#2b313a] text-[#dbe0e6] text-sm focus:outline-none focus:border-[#f5a623]/60"
              >
                <option value="">All Models</option>
                {modelsList.map(m => (
                  <option key={m.id} value={m.id}>{m.name} (v{m.version})</option>
                ))}
              </select>
            </div>

            {/* Date Range Start */}
            <div>
              <label className="block text-[10px] font-bold text-[#5a6270] uppercase tracking-wider font-mono mb-1.5">Start Date</label>
              <input 
                type="datetime-local" 
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#0f1216] border border-[#2b313a] text-[#dbe0e6] text-sm focus:outline-none focus:border-[#f5a623]/60"
                style={{ colorScheme: 'dark' }}
              />
            </div>

            {/* Date Range End */}
            <div>
              <label className="block text-[10px] font-bold text-[#5a6270] uppercase tracking-wider font-mono mb-1.5">End Date</label>
              <input 
                type="datetime-local" 
                value={filters.end_date}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#0f1216] border border-[#2b313a] text-[#dbe0e6] text-sm focus:outline-none focus:border-[#f5a623]/60"
                style={{ colorScheme: 'dark' }}
              />
            </div>

            {/* Confidence Sliders */}
            <div className="flex flex-col gap-3">
              <div>
                <label className="flex justify-between text-[10px] font-bold text-[#5a6270] uppercase tracking-wider font-mono mb-1">
                  <span>Min Confidence</span>
                  <span className="text-[#f5a623]">{filters.min_conf ? (filters.min_conf * 100).toFixed(0) + '%' : '0%'}</span>
                </label>
                <input 
                  type="range" 
                  min="0" max="1" step="0.01"
                  value={filters.min_conf === "" ? 0 : filters.min_conf}
                  onChange={(e) => handleFilterChange('min_conf', parseFloat(e.target.value))}
                  className="w-full accent-[#f5a623]"
                />
              </div>
              <div>
                <label className="flex justify-between text-[10px] font-bold text-[#5a6270] uppercase tracking-wider font-mono mb-1">
                  <span>Max Confidence</span>
                  <span className="text-[#f5a623]">{filters.max_conf !== "" ? (filters.max_conf * 100).toFixed(0) + '%' : '100%'}</span>
                </label>
                <input 
                  type="range" 
                  min="0" max="1" step="0.01"
                  value={filters.max_conf === "" ? 1 : filters.max_conf}
                  onChange={(e) => handleFilterChange('max_conf', parseFloat(e.target.value))}
                  className="w-full accent-[#f5a623]"
                />
              </div>
            </div>

          </div>
          
          <div className="flex justify-end gap-3 pt-3 border-t border-[#2b313a]">
            <button 
              onClick={resetFilters}
              className="px-4 py-2 rounded text-xs font-bold bg-[#1a1e24] text-[#8a93a3] hover:bg-[#232830] transition-colors border border-[#2b313a]"
            >
              Reset
            </button>
            <button 
              onClick={applyFilters}
              className="px-4 py-2 rounded text-xs font-bold bg-[#f5a623] text-[#14171c] hover:bg-[#ffb63f] transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}

      <div className={`glass-card overflow-hidden animate-fade-in ${showFilters ? 'stagger-3' : 'stagger-2'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#181c22] border-b border-[#2b313a]">
                <th className="px-5 py-3 text-[10px] font-bold text-[#5a6270] uppercase tracking-wider font-mono">Timestamp</th>
                <th className="px-5 py-3 text-[10px] font-bold text-[#5a6270] uppercase tracking-wider font-mono">ID</th>
                <th className="px-5 py-3 text-[10px] font-bold text-[#5a6270] uppercase tracking-wider font-mono">Confidence</th>
                <th className="px-5 py-3 text-[10px] font-bold text-[#5a6270] uppercase tracking-wider font-mono">Verdict</th>
                <th className="px-5 py-3 text-[10px] font-bold text-[#5a6270] uppercase tracking-wider font-mono">Image</th>
                <th className="px-5 py-3 text-[10px] font-bold text-[#5a6270] uppercase tracking-wider font-mono text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#232830]">
              {loading ? (
                <tr><td colSpan="5" className="px-5 py-12 text-center text-[#5a6270] text-sm animate-pulse">Loading...</td></tr>
              ) : results.length === 0 ? (
                <tr><td colSpan="5" className="px-5 py-12 text-center text-[#5a6270] text-sm">No inspection results found for these filters</td></tr>
              ) : results.map((r) => (
                <tr key={r.id} className="hover:bg-[#1e232a] transition-colors">
                  <td className="px-5 py-3 text-xs text-[#8a93a3] font-mono whitespace-nowrap">
                    {r.created_at ? new Date(r.created_at).toLocaleString() : "-"}
                  </td>
                  <td className="px-5 py-3 text-xs text-[#8a93a3] font-mono">{r.id.substring(0, 8)}...</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 pass-rate-bar">
                        <div className={`pass-rate-fill ${
                          r.verdict === "OK" ? "bg-[#2fb380]" :
                          r.verdict === "NG" ? "bg-[#e5484d]" : "bg-[#f5a623]"
                        }`} style={{ width: `${r.confidence * 100}%` }} />
                      </div>
                      <span className="text-xs text-[#8a93a3] font-mono">{(r.confidence * 100).toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm border uppercase tracking-wider font-mono ${verdictBadge(r.verdict)}`}>{r.verdict}</span>
                  </td>
                  <td className="px-5 py-3">
                    {r.image_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`http://localhost:8000${r.image_path}`} alt="" className="w-10 h-10 rounded object-cover border border-[#2b313a]" />
                    ) : (
                      <span className="text-xs text-[#3a4149]">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button 
                      onClick={() => handleDelete(r.id)}
                      className="p-1.5 rounded text-[#8a93a3] hover:text-[#e5484d] hover:bg-[#e5484d]/10 transition-colors"
                      title="Delete Result"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="px-5 py-3 border-t border-[#2b313a] flex items-center justify-between">
            <span className="text-xs text-[#5a6270] font-mono">Page {page} of {pages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="p-1.5 rounded bg-[#1a1e24] hover:bg-[#232830] text-[#8a93a3] disabled:opacity-30 transition-colors border border-[#2b313a]">
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(Math.min(pages, page + 1))} disabled={page >= pages} className="p-1.5 rounded bg-[#1a1e24] hover:bg-[#232830] text-[#8a93a3] disabled:opacity-30 transition-colors border border-[#2b313a]">
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}