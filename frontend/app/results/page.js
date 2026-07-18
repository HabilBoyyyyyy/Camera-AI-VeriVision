"use client";

import {useState, useEffect} from "react";
import {fetchResults, getResultsExportUrl, fetchModels, deleteResult} from "@/lib/api";

const BASE_URL = "http://localhost:8000";

function VerdictBadge({verdict}) {
  if (verdict === "OK")  return <span className="badge badge-pass">✓ PASS</span>;
  if (verdict === "NG")  return <span className="badge badge-fail">✗ FAIL</span>;
  return <span className="badge badge-review">~ REVIEW</span>;
}

function FilterLabel({children}) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{color:"var(--clr-text-muted)"}}>
      {children}
    </p>
  );
}

export default function ResultsPage() {
  const [results,    setResults]    = useState([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [pages,      setPages]      = useState(1);
  const [modelsList, setModelsList] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [expanded,   setExpanded]   = useState(null);
  const [filters,    setFilters]    = useState({
    verdict:"", model_id:"", start_date:"", end_date:"", search_id:""
  });
  const limit = 20;

  useEffect(() => {
    fetchModels().then(d => setModelsList(d || [])).catch(() => {});
  }, []);

  const load = async (pg = page, f = filters) => {
    setLoading(true);
    try {
      const data = await fetchResults(pg, limit, f);
      setResults(data.items || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page]);

  const applyFilters = () => { setPage(1); load(1, filters); };
  const resetFilters = () => {
    const blank = {verdict:"", model_id:"", start_date:"", end_date:"", search_id:""};
    setFilters(blank); setPage(1); load(1, blank);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this inspection result?")) return;
    try { await deleteResult(id); load(); }
    catch(e) { alert("Failed to delete: " + e.message); }
  };

  const pageNums = [...Array(Math.min(5, pages))].map((_, i) => i + 1);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="material-symbols-outlined text-[22px]" style={{color:"var(--clr-accent)"}}>analytics</span>
            <h2 className="text-2xl font-semibold" style={{color:"var(--clr-text)"}}>Final Inspection Results</h2>
          </div>
          <p className="text-sm" style={{color:"var(--clr-text-sub)"}}>
            Historical records of automated visual inspections across all production lines.
          </p>
        </div>
        <a href={getResultsExportUrl(filters)} className="btn-primary shrink-0">
          <span className="material-symbols-outlined text-[18px]">download</span>
          Export CSV
        </a>
      </div>

      {/* Filter Bar */}
      <div className="vv-card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date Range — fixed padding so icon doesn't overlap */}
          <div>
            <FilterLabel>Date Range</FilterLabel>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-[16px] pointer-events-none z-10"
                style={{color:"var(--clr-text-muted)"}}>calendar_today</span>
              <select
                value={filters.start_date}
                onChange={e => setFilters(p => ({...p, start_date:e.target.value}))}
                style={{paddingLeft:"2.25rem"}}
              >
                <option value="">Last 7 Days</option>
                <option value="">Last 30 Days</option>
                <option value="">Custom</option>
              </select>
            </div>
          </div>

          {/* Model */}
          <div>
            <FilterLabel>Model</FilterLabel>
            <select value={filters.model_id} onChange={e => setFilters(p => ({...p, model_id:e.target.value}))}>
              <option value="">All Models</option>
              {modelsList.map(m => (
                <option key={m.id} value={m.id}>{m.name} v{m.version}</option>
              ))}
            </select>
          </div>

          {/* Verdict */}
          <div>
            <FilterLabel>Verdict</FilterLabel>
            <select value={filters.verdict} onChange={e => setFilters(p => ({...p, verdict:e.target.value}))}>
              <option value="">All Verdicts</option>
              <option value="OK">Pass Only</option>
              <option value="NG">Fail Only</option>
              <option value="Uncertain">Review Only</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-end gap-2">
            <button onClick={applyFilters} className="btn-primary flex-1 justify-center py-2">Apply</button>
            <button onClick={resetFilters} className="btn-outline py-2 px-3" title="Clear filters">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* Search by ID */}
        <div className="mt-3">
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-3 text-[16px] pointer-events-none" style={{color:"var(--clr-text-muted)"}}>search</span>
            <input
              type="text"
              value={filters.search_id}
              onChange={e => setFilters(p => ({...p, search_id:e.target.value}))}
              onKeyDown={e => e.key === "Enter" && applyFilters()}
              placeholder="Search by inspection ID..."
              style={{paddingLeft:"2.25rem"}}
            />
          </div>
        </div>
      </div>

      {/* Summary row */}
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-sm font-semibold" style={{color:"var(--clr-text)"}}>
          {total.toLocaleString()} records
        </span>
        {filters.verdict && <span className="badge badge-archived">Filter: {filters.verdict}</span>}
        {filters.model_id && <span className="badge badge-archived">Model filter active</span>}
      </div>

      {/* Table */}
      <div className="vv-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead style={{background:"var(--clr-surface-low)"}}>
              <tr style={{borderBottom:"1px solid var(--clr-border)"}}>
                {["Inspection ID","Timestamp","Part Number","Line","Verdict","Actions"].map(h => (
                  <th key={h} className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
                    style={{color:"var(--clr-text-muted)"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1,2,4].map(i => (
                  <tr key={i} style={{borderBottom:"1px solid var(--clr-border)"}}>
                    <td colSpan={6} className="px-5 py-10 text-center">
                      <div className="w-5 h-5 border-2 rounded-full animate-spin mx-auto"
                        style={{borderColor:"var(--clr-border)", borderTopColor:"var(--clr-accent)"}} />
                    </td>
                  </tr>
                ))
              ) : results.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center" style={{color:"var(--clr-text-muted)"}}>
                    <span className="material-symbols-outlined text-[48px] block mb-3 opacity-40">search_off</span>
                    No inspection results found for these filters.
                  </td>
                </tr>
              ) : (
                results.flatMap((r) => {
                  const rows = [];

                  rows.push(
                    <tr
                      key={r.id}
                      style={{
                        borderBottom:"1px solid var(--clr-border)",
                        background: expanded === r.id ? "var(--clr-surface-low)" : undefined,
                        cursor:"pointer",
                      }}
                      onMouseEnter={e => { if (expanded !== r.id) e.currentTarget.style.background="var(--clr-surface-low)"; }}
                      onMouseLeave={e => { if (expanded !== r.id) e.currentTarget.style.background=""; }}
                    >
                      <td className="px-5 py-3 font-mono text-[12px]" style={{color:"var(--clr-text)"}}>
                        #{r.id?.substring?.(0,12) ?? r.id}
                      </td>
                      <td className="px-5 py-3 text-[12px] whitespace-nowrap" style={{color:"var(--clr-text-sub)"}}>
                        {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                      </td>
                      <td className="px-5 py-3 font-semibold" style={{color:"var(--clr-text)"}}>
                        PN-{r.id?.substring?.(0,6).toUpperCase() ?? ""}
                      </td>
                      <td className="px-5 py-3" style={{color:"var(--clr-text-sub)"}}>Line A</td>
                      <td className="px-5 py-3"><VerdictBadge verdict={r.verdict} /></td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                            title="View details"
                            className="p-1.5 rounded transition-colors"
                            style={{color:"var(--clr-text-muted)"}}
                            onMouseEnter={e => { e.currentTarget.style.color="var(--clr-accent)"; e.currentTarget.style.background="var(--clr-surface-mid)"; }}
                            onMouseLeave={e => { e.currentTarget.style.color="var(--clr-text-muted)"; e.currentTarget.style.background=""; }}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {expanded === r.id ? "expand_less" : "visibility"}
                            </span>
                          </button>
                          <button
                            onClick={() => handleDelete(r.id)}
                            title="Delete result"
                            className="p-1.5 rounded transition-colors"
                            style={{color:"var(--clr-text-muted)"}}
                            onMouseEnter={e => { e.currentTarget.style.color="var(--clr-error)"; e.currentTarget.style.background="rgba(186,26,26,.08)"; }}
                            onMouseLeave={e => { e.currentTarget.style.color="var(--clr-text-muted)"; e.currentTarget.style.background=""; }}
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );

                  if (expanded === r.id) {
                    rows.push(
                      <tr key={r.id + "-exp"} style={{borderBottom:"1px solid var(--clr-border)", background:"var(--clr-surface-low)"}}>
                        <td colSpan={6} className="px-5 py-5">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Image */}
                            <div className="vv-card overflow-hidden">
                              <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider flex justify-between"
                                style={{background:"var(--clr-surface-mid)", color:"var(--clr-text-muted)", borderBottom:"1px solid var(--clr-border)"}}>
                                <span>Defect Map (AI)</span>
                                <span className="material-symbols-outlined text-[16px]">fullscreen</span>
                              </div>
                              {r.image_path ? (
                                <div className="relative" style={{background:"#000"}}>
                                  <img src={`${BASE_URL}${r.image_path}`} alt="Inspection" className="w-full object-cover" />
                                  {r.verdict === "NG" && (
                                    <div className="absolute top-3 left-3 border-2 border-red-500 bg-red-500/20 px-2 py-0.5">
                                      <span className="text-[10px] text-red-400 font-bold">DEFECT {(r.confidence*100).toFixed(0)}%</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="h-32 flex items-center justify-center" style={{background:"var(--clr-surface-mid)"}}>
                                  <span className="material-symbols-outlined text-[40px]" style={{color:"var(--clr-border)"}}>image</span>
                                </div>
                              )}
                            </div>

                            {/* Scores */}
                            <div className="space-y-3">
                              <div className="vv-card p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{color:"var(--clr-text-muted)"}}>Anomaly Score</p>
                                <p className="text-2xl font-bold" style={{color: r.verdict==="NG" ? "var(--clr-error)" : "var(--clr-success)"}}>
                                  {r.confidence?.toFixed(2)} <span className="text-sm font-normal" style={{color:"var(--clr-text-muted)"}}>/1.0</span>
                                </p>
                              </div>
                              <div className="vv-card p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{color:"var(--clr-text-muted)"}}>Verdict</p>
                                <VerdictBadge verdict={r.verdict} />
                              </div>
                              <div className="vv-card p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{color:"var(--clr-text-muted)"}}>Model</p>
                                <p className="text-sm font-mono font-semibold" style={{color:"var(--clr-text)"}}>v{r.model_version || "4.2.1"}</p>
                              </div>
                            </div>

                            {/* Review */}
                            <div className="vv-card p-4">
                              <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{color:"var(--clr-text-muted)"}}>Review Notes</p>
                              <textarea
                                className="w-full h-24 text-sm resize-none"
                                placeholder="Enter manual review observations..."
                              />
                              <div className="flex gap-2 mt-3">
                                <button className="btn-outline flex-1 justify-center text-xs py-2">False Positive</button>
                                <button className="btn-primary flex-1 justify-center text-xs py-2">Confirm Defect</button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return rows;
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-5 py-3 flex items-center justify-between text-sm flex-wrap gap-3"
          style={{borderTop:"1px solid var(--clr-border)"}}>
          <span style={{color:"var(--clr-text-muted)"}}>
            Showing {total === 0 ? 0 : ((page-1)*limit)+1}–{Math.min(page*limit, total)} of {total.toLocaleString()} records
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(1, page-1))}
              disabled={page <= 1}
              className="px-2 py-1 rounded border text-sm disabled:opacity-30"
              style={{borderColor:"var(--clr-border)", color:"var(--clr-text-sub)"}}
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>
            {pageNums.map(pg => (
              <button
                key={pg}
                onClick={() => setPage(pg)}
                className="w-8 h-8 rounded border text-xs font-semibold transition-colors"
                style={{
                  borderColor: page===pg ? "var(--clr-text)" : "var(--clr-border)",
                  background:  page===pg ? "var(--clr-text)" : "transparent",
                  color:       page===pg ? "var(--clr-bg)"  : "var(--clr-text-muted)",
                }}
              >{pg}</button>
            ))}
            {pages > 5 && <span style={{color:"var(--clr-text-muted)"}}>…</span>}
            <button
              onClick={() => setPage(Math.min(pages, page+1))}
              disabled={page >= pages}
              className="px-2 py-1 rounded border text-sm disabled:opacity-30"
              style={{borderColor:"var(--clr-border)", color:"var(--clr-text-sub)"}}
            >
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
