"use client";

import { useState, useEffect } from "react";
import { fetchResults, getResultsExportUrl } from "@/lib/api";

function ListIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>; }
function DownloadIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>; }
function ChevronLeftIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>; }
function ChevronRightIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>; }

export default function ResultsPage() {
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [verdictFilter, setVerdictFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const loadResults = async () => {
    setLoading(true);
    try {
      const data = await fetchResults(page, limit, verdictFilter || null);
      setResults(data.items || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadResults(); }, [page, verdictFilter]);

  const verdictBadge = (v) => {
    if (v === "OK") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
    if (v === "NG") return "bg-red-500/15 text-red-400 border-red-500/20";
    return "bg-amber-500/15 text-amber-400 border-amber-500/20";
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in stagger-1">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <ListIcon className="w-5 h-5 text-cyan-500" />
            <h1 className="text-xl font-semibold text-slate-100 tracking-tight">Inspection Results</h1>
          </div>
          <p className="text-sm text-slate-500 ml-8">{total} total inspections</p>
        </div>
        <div className="flex gap-3 items-center">
          <select
            value={verdictFilter}
            onChange={(e) => { setVerdictFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 text-sm focus:outline-none focus:border-cyan-500/50"
          >
            <option value="">All Verdicts</option>
            <option value="OK">OK</option>
            <option value="NG">NG</option>
            <option value="Uncertain">Uncertain</option>
          </select>
          <a
            href={getResultsExportUrl(verdictFilter || null)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-bold transition-colors border border-cyan-500/20"
          >
            <DownloadIcon className="w-3.5 h-3.5" /> Export CSV
          </a>
        </div>
      </div>

      <div className="glass-card overflow-hidden animate-fade-in stagger-2">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-800/30 border-b border-slate-700/50">
                <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Timestamp</th>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">ID</th>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Confidence</th>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Verdict</th>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Image</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loading ? (
                <tr><td colSpan="5" className="px-5 py-12 text-center text-slate-500 text-sm animate-pulse">Loading...</td></tr>
              ) : results.length === 0 ? (
                <tr><td colSpan="5" className="px-5 py-12 text-center text-slate-500 text-sm">No inspection results found</td></tr>
              ) : results.map((r) => (
                <tr key={r.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-5 py-3 text-xs text-slate-400 font-mono whitespace-nowrap">
                    {r.created_at ? new Date(r.created_at).toLocaleString() : "-"}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-400 font-mono">{r.id.substring(0, 8)}...</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${
                          r.verdict === "OK" ? "bg-emerald-500" :
                          r.verdict === "NG" ? "bg-red-500" : "bg-amber-500"
                        }`} style={{ width: `${r.confidence * 100}%` }} />
                      </div>
                      <span className="text-xs text-slate-300 font-mono">{(r.confidence * 100).toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${verdictBadge(r.verdict)}`}>{r.verdict}</span>
                  </td>
                  <td className="px-5 py-3">
                    {r.image_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`http://localhost:8000${r.image_path}`} alt="" className="w-10 h-10 rounded object-cover border border-slate-700" />
                    ) : (
                      <span className="text-xs text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="px-5 py-3 border-t border-slate-700/30 flex items-center justify-between">
            <span className="text-xs text-slate-500">Page {page} of {pages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 transition-colors">
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(Math.min(pages, page + 1))} disabled={page >= pages} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 transition-colors">
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
