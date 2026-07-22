"use client";

import {useState, useEffect} from "react";
import {fetchResults, getResultsExportUrl, fetchModels, deleteResult, submitReview, undoReview, fetchFeedbackStats} from "@/lib/api";
import Link from "next/link";

const BASE_URL = "http://localhost:8000";

function VerdictBadge({verdict}) {
  if (verdict === "OK")  return <span className="badge badge-pass">✓ PASS</span>;
  if (verdict === "NG")  return <span className="badge badge-fail">✗ FAIL</span>;
  return <span className="badge badge-review">~ REVIEW</span>;
}

function ReviewBadge({reviewVerdict}) {
  if (!reviewVerdict) return null;
  if (reviewVerdict === "OK") return <span className="badge badge-pass" style={{fontSize:9, padding:"1px 6px"}}>✓ Validated OK</span>;
  return <span className="badge badge-fail" style={{fontSize:9, padding:"1px 6px"}}>✗ Validated NG</span>;
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
  const [selectedResultId, setSelectedResultId] = useState(null);
  const [filters,    setFilters]    = useState({
    verdict:"", model_id:"", start_date:"", end_date:"", search_id:"", review_status:""
  });
  const limit = 20;

  // Review state
  const [reviewNotes, setReviewNotes] = useState({});  // {resultId: "notes"}
  const [reviewing, setReviewing] = useState(null);    // resultId being submitted
  const [feedbackStats, setFeedbackStats] = useState([]);

  useEffect(() => {
    fetchModels().then(d => setModelsList(d || [])).catch(() => {});
    fetchFeedbackStats().then(d => setFeedbackStats(d || [])).catch(() => {});
  }, []);

  const load = async (pg = page, f = filters) => {
    setLoading(true);
    try {
      const data = await fetchResults(pg, limit, f);
      const newResults = data.items || [];
      setResults(newResults);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
      
      // Auto-select the first result if nothing is selected or if selected is not in the new page
      if (newResults.length > 0) {
        if (!selectedResultId || !newResults.find(r => r.id === selectedResultId)) {
          setSelectedResultId(newResults[0].id);
        }
      } else {
        setSelectedResultId(null);
      }
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page]);

  const applyFilters = () => { setPage(1); load(1, filters); };
  const resetFilters = () => {
    const blank = {verdict:"", model_id:"", start_date:"", end_date:"", search_id:"", review_status:""};
    setFilters(blank); setPage(1); load(1, blank);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this inspection result?")) return;
    try { 
      await deleteResult(id); 
      if (selectedResultId === id) setSelectedResultId(null);
      load(); 
    }
    catch(e) { alert("Failed to delete: " + e.message); }
  };

  const handleReview = async (resultId, verdict) => {
    setReviewing(resultId);
    try {
      const notes = reviewNotes[resultId] || "";
      await submitReview(resultId, verdict, notes);
      // Refresh data
      await load();
      // Refresh feedback stats
      const stats = await fetchFeedbackStats();
      setFeedbackStats(stats || []);
    } catch (e) {
      alert("Review failed: " + e.message);
    } finally {
      setReviewing(null);
    }
  };

  const handleUndoReview = async (resultId) => {
    if (!confirm("Are you sure you want to undo this review? The exported image will be removed from the dataset.")) return;
    setReviewing(resultId);
    try {
      await undoReview(resultId);
      await load();
      const stats = await fetchFeedbackStats();
      setFeedbackStats(stats || []);
    } catch (e) {
      alert("Undo failed: " + e.message);
    } finally {
      setReviewing(null);
    }
  };

  const pageNums = [...Array(Math.min(5, pages))].map((_, i) => i + 1);

  // Feedback stats banner data
  const totalNewValidated = feedbackStats.reduce((sum, s) => sum + s.new_validated_images, 0);
  const totalPending = feedbackStats.reduce((sum, s) => sum + s.pending_review, 0);
  
  const selectedResult = results.find(r => r.id === selectedResultId);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-4 animate-fade-in h-screen flex flex-col pt-6 px-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
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

      {/* Feedback Loop Banner */}
      {(totalNewValidated > 0 || totalPending > 0) && (
        <div className="vv-card p-4 shrink-0" style={{border:"1px solid var(--clr-accent)", background:"rgba(0,102,204,0.04)"}}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[24px] mt-0.5" style={{color:"var(--clr-accent)"}}>model_training</span>
              <div>
                <p className="text-sm font-semibold" style={{color:"var(--clr-text)"}}>
                  Feedback Loop — Model Improvement
                </p>
                <p className="text-xs mt-0.5" style={{color:"var(--clr-text-sub)"}}>
                  {totalNewValidated > 0 && (
                    <span>
                      <strong style={{color:"var(--clr-success)"}}>{totalNewValidated}</strong> validated image{totalNewValidated !== 1 ? "s" : ""} exported to training dataset{feedbackStats.length === 1 ? ` "${feedbackStats[0].dataset_name}"` : ""}.
                    </span>
                  )}
                  {totalNewValidated > 0 && totalPending > 0 && " "}
                  {totalPending > 0 && (
                    <span>
                      <strong style={{color:"var(--clr-warn)"}}>{totalPending}</strong> result{totalPending !== 1 ? "s" : ""} pending manual review.
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {totalPending > 0 && (
                <button
                  onClick={() => { setFilters(f => ({...f, review_status: "pending"})); setPage(1); load(1, {...filters, review_status: "pending"}); }}
                  className="btn-outline text-xs py-1.5 px-3"
                >
                  <span className="material-symbols-outlined text-[16px]">rate_review</span>
                  Review Pending
                </button>
              )}
              {totalNewValidated > 0 && (
                <Link href="/ai-studio?tab=training" className="btn-primary text-xs py-1.5 px-3">
                  <span className="material-symbols-outlined text-[16px]">model_training</span>
                  Retrain Model
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="vv-card p-4 shrink-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Date Range */}
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

          {/* Review Status */}
          <div>
            <FilterLabel>Review Status</FilterLabel>
            <select value={filters.review_status} onChange={e => setFilters(p => ({...p, review_status:e.target.value}))}>
              <option value="">All</option>
              <option value="pending">⏳ Pending Review</option>
              <option value="reviewed">✓ Reviewed</option>
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
        <div className="mt-3 flex items-center justify-between">
          <div className="relative flex items-center w-full max-w-md">
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
          <div className="flex items-center gap-2 flex-wrap ml-4">
            <span className="text-sm font-semibold" style={{color:"var(--clr-text)"}}>
              {total.toLocaleString()} records
            </span>
            {filters.verdict && <span className="badge badge-archived">Verdict: {filters.verdict}</span>}
            {filters.model_id && <span className="badge badge-archived">Model filter</span>}
            {filters.review_status && <span className="badge badge-archived">Review: {filters.review_status}</span>}
          </div>
        </div>
      </div>

      {/* Main Content Area: Master-Detail Split */}
      <div className="flex-1 flex overflow-hidden min-h-[400px] mb-6 gap-6">
        
        {/* Left Panel: Results List (40%) */}
        <div className="w-[40%] flex flex-col vv-card overflow-hidden">
          <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{background:"var(--clr-surface-low)", borderBottom:"1px solid var(--clr-border)", color:"var(--clr-text-muted)"}}>
            Results List
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{borderColor:"var(--clr-border)", borderTopColor:"var(--clr-accent)"}} />
              </div>
            ) : results.length === 0 ? (
              <div className="p-8 text-center" style={{color:"var(--clr-text-muted)"}}>
                <span className="material-symbols-outlined text-[48px] block mb-3 opacity-40">search_off</span>
                No inspection results found.
              </div>
            ) : (
              <div className="flex flex-col">
                {results.map((r) => {
                  const isSelected = selectedResultId === r.id;
                  const needsReview = r.verdict === "Uncertain" && !r.review_verdict;
                  
                  return (
                    <div 
                      key={r.id}
                      onClick={() => setSelectedResultId(r.id)}
                      className="p-3 flex gap-3 cursor-pointer transition-colors"
                      style={{
                        borderBottom: "1px solid var(--clr-border)",
                        background: isSelected 
                          ? "var(--clr-surface-mid)" 
                          : needsReview ? "rgba(230,81,0,0.03)" : "transparent",
                        borderLeft: isSelected ? "3px solid var(--clr-accent)" : "3px solid transparent",
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background="var(--clr-surface-low)"; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = needsReview ? "rgba(230,81,0,0.03)" : "transparent"; }}
                    >
                      {/* Thumbnail */}
                      <div className="w-10 h-10 shrink-0 rounded overflow-hidden" style={{background: "var(--clr-surface-low)"}}>
                        {r.image_path ? (
                          <img src={`${BASE_URL}${r.image_path}`} alt="thumbnail" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="material-symbols-outlined text-[20px]" style={{color:"var(--clr-text-muted)"}}>image</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-mono text-xs font-semibold truncate" style={{color:"var(--clr-text)"}}>
                            #{r.id?.substring(0,8)}
                          </span>
                          <span className="text-[10px]" style={{color:"var(--clr-text-sub)"}}>
                            {r.created_at ? new Date(r.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ""}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <VerdictBadge verdict={r.verdict} />
                          <div className="flex items-center gap-2">
                            {r.review_verdict ? (
                                <ReviewBadge reviewVerdict={r.review_verdict} />
                              ) : needsReview ? (
                                <span className="text-[9px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded"
                                  style={{background:"rgba(230,81,0,0.1)", color:"#e65100", border:"1px solid rgba(230,81,0,0.2)"}}>
                                  Review
                                </span>
                              ) : null}
                            <span className="text-[10px] font-semibold" style={{color:"var(--clr-text-muted)"}}>
                              {r.confidence ? (r.confidence * 100).toFixed(0) + "%" : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Pagination */}
          <div className="p-3 flex items-center justify-between text-xs shrink-0"
            style={{borderTop:"1px solid var(--clr-border)", background:"var(--clr-surface-low)"}}>
            <span style={{color:"var(--clr-text-muted)"}}>
              {total === 0 ? 0 : ((page-1)*limit)+1}–{Math.min(page*limit, total)} of {total.toLocaleString()}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(Math.max(1, page-1))}
                disabled={page <= 1}
                className="px-1 py-0.5 rounded border disabled:opacity-30"
                style={{borderColor:"var(--clr-border)", color:"var(--clr-text-sub)"}}
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
              {pageNums.map(pg => (
                <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  className="w-6 h-6 rounded border text-[10px] font-semibold transition-colors"
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
                className="px-1 py-0.5 rounded border disabled:opacity-30"
                style={{borderColor:"var(--clr-border)", color:"var(--clr-text-sub)"}}
              >
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel: Selected Result Detail (60%) */}
        <div className="w-[60%] flex flex-col vv-card overflow-hidden">
          <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider flex justify-between items-center" style={{background:"var(--clr-surface-low)", borderBottom:"1px solid var(--clr-border)", color:"var(--clr-text-muted)"}}>
            <span>Result Details</span>
            {selectedResult && (
              <button
                onClick={() => handleDelete(selectedResult.id)}
                title="Delete result"
                className="text-xs flex items-center gap-1 transition-colors hover:text-red-500"
                style={{color:"var(--clr-text-muted)"}}
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                Delete
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {!selectedResult ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                 <span className="material-symbols-outlined text-[64px] mb-4 opacity-20" style={{color:"var(--clr-text)"}}>touch_app</span>
                 <p className="text-lg font-medium" style={{color:"var(--clr-text)"}}>No Result Selected</p>
                 <p className="text-sm mt-2" style={{color:"var(--clr-text-muted)"}}>Select an inspection result from the list to view its details.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* ID and time */}
                <div className="flex justify-between items-end border-b pb-4" style={{borderColor:"var(--clr-border)"}}>
                  <div>
                    <h3 className="text-xl font-mono" style={{color:"var(--clr-text)"}}>
                      #{selectedResult.id}
                    </h3>
                    <p className="text-sm mt-1" style={{color:"var(--clr-text-sub)"}}>
                      {selectedResult.created_at ? new Date(selectedResult.created_at).toLocaleString() : "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase font-semibold tracking-wider mb-1" style={{color:"var(--clr-text-muted)"}}>Part Number</p>
                    <p className="text-sm font-semibold" style={{color:"var(--clr-text)"}}>PN-{selectedResult.id?.substring(0,6).toUpperCase()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {/* Image */}
                  <div className="vv-card overflow-hidden h-fit">
                    <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider flex justify-between"
                      style={{background:"var(--clr-surface-mid)", color:"var(--clr-text-muted)", borderBottom:"1px solid var(--clr-border)"}}>
                      <span>Defect Map (AI)</span>
                      <span className="material-symbols-outlined text-[16px]">fullscreen</span>
                    </div>
                    {selectedResult.image_path ? (
                      <div className="relative bg-black w-full" style={{minHeight:"200px"}}>
                        <img src={`${BASE_URL}${selectedResult.image_path}`} alt="Inspection" className="w-full object-contain max-h-[400px]" />
                        {(selectedResult.verdict === "NG" || selectedResult.review_verdict === "NG") && (
                          <div className="absolute top-3 left-3 border-2 border-red-500 bg-red-500/20 px-2 py-0.5">
                            <span className="text-xs text-red-400 font-bold">DEFECT {(selectedResult.confidence*100).toFixed(0)}%</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-48 flex items-center justify-center" style={{background:"var(--clr-surface-mid)"}}>
                        <span className="material-symbols-outlined text-[40px]" style={{color:"var(--clr-border)"}}>image</span>
                      </div>
                    )}
                  </div>

                  {/* Right column within details */}
                  <div className="space-y-4">
                    {/* Verdict Card */}
                    <div className="vv-card p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{color:"var(--clr-text-muted)"}}>AI Verdict</p>
                      <div className="flex items-center justify-between mb-4">
                        <VerdictBadge verdict={selectedResult.verdict} />
                        <div className="text-right">
                          <p className="text-2xl font-bold" style={{color: selectedResult.verdict==="NG" ? "var(--clr-error)" : "var(--clr-success)"}}>
                            {selectedResult.confidence?.toFixed(2)} <span className="text-sm font-normal" style={{color:"var(--clr-text-muted)"}}>/1.0</span>
                          </p>
                        </div>
                      </div>
                      
                      {/* Confidence bar */}
                      <div className="w-full h-2 rounded-full overflow-hidden" style={{background:"var(--clr-surface-mid)"}}>
                        <div className="h-full" style={{
                          width: `${(selectedResult.confidence || 0) * 100}%`,
                          background: selectedResult.verdict === "NG" ? "var(--clr-error)" : "var(--clr-success)"
                        }}></div>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px]" style={{color:"var(--clr-text-muted)"}}>0.0</span>
                        <span className="text-[10px]" style={{color:"var(--clr-text-muted)"}}>1.0</span>
                      </div>
                    </div>

                    {/* Review Panel */}
                    <div className="vv-card p-4 border" style={{borderColor: selectedResult.review_verdict ? (selectedResult.review_verdict === "OK" ? "rgba(22,163,74,0.3)" : "rgba(186,26,26,0.3)") : "var(--clr-border)"}}>
                      {selectedResult.review_verdict ? (
                        /* Already reviewed */
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{color:"var(--clr-text-muted)"}}>
                            Human Review Complete
                          </p>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-[20px]" style={{color:"var(--clr-success)"}}>verified</span>
                            <span className="text-sm font-semibold" style={{color:"var(--clr-text)"}}>
                              Validated as {selectedResult.review_verdict === "OK" ? "OK (Pass)" : "NG (Defect)"}
                            </span>
                          </div>
                          {selectedResult.review_notes && (
                            <div className="p-3 rounded text-xs mb-3" style={{background:"var(--clr-surface-mid)", color:"var(--clr-text-sub)"}}>
                              <p className="text-[10px] font-semibold uppercase mb-1" style={{color:"var(--clr-text-muted)"}}>Notes</p>
                              {selectedResult.review_notes}
                            </div>
                          )}
                          
                          {selectedResult.exported_to_dataset && (
                            <div className="mb-3 px-3 py-2 rounded text-xs flex items-center gap-2" style={{background:"rgba(22,163,74,0.1)", color:"var(--clr-success)"}}>
                              <span className="material-symbols-outlined text-[16px]">check_circle</span>
                              Exported to training dataset for model improvement
                            </div>
                          )}

                          <div className="flex justify-between items-end mt-4 pt-3 border-t" style={{borderColor:"var(--clr-border)"}}>
                            <p className="text-[10px]" style={{color:"var(--clr-text-muted)"}}>
                              Reviewed by <strong>{selectedResult.reviewed_by}</strong>
                              <br />{selectedResult.reviewed_at ? new Date(selectedResult.reviewed_at).toLocaleString() : ""}
                            </p>
                            <button
                              onClick={() => handleUndoReview(selectedResult.id)}
                              disabled={reviewing === selectedResult.id}
                              className="btn-outline text-xs py-1 px-3 flex items-center gap-1"
                              style={{borderColor:"rgba(186, 26, 26, 0.4)", color:"var(--clr-error)"}}
                            >
                              {reviewing === selectedResult.id ? (
                                <span className="material-symbols-outlined text-[14px] animate-spin">hourglass_top</span>
                              ) : (
                                <span className="material-symbols-outlined text-[14px]">undo</span>
                              )}
                              Undo Review
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Not yet reviewed */
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1" style={{color:"var(--clr-text-muted)"}}>
                            <span className="material-symbols-outlined text-[14px]">rate_review</span>
                            Manual Review
                          </p>
                          <textarea
                            className="w-full h-20 text-sm resize-none mb-3 p-2 rounded"
                            style={{background:"var(--clr-surface)", border:"1px solid var(--clr-border)", color:"var(--clr-text)"}}
                            placeholder="Enter manual review observations..."
                            value={reviewNotes[selectedResult.id] || ""}
                            onChange={e => setReviewNotes(prev => ({...prev, [selectedResult.id]: e.target.value}))}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleReview(selectedResult.id, "OK")}
                              disabled={reviewing === selectedResult.id}
                              className="btn-outline flex-1 justify-center text-xs py-2"
                              style={{
                                borderColor: "rgba(22,163,74,0.4)",
                                color: "var(--clr-success)",
                              }}
                            >
                              {reviewing === selectedResult.id ? (
                                <span className="material-symbols-outlined text-[16px] animate-spin">hourglass_top</span>
                              ) : (
                                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                              )}
                              {selectedResult.verdict === "OK" ? "Confirm Pass" : "Mark as Pass"}
                            </button>
                            <button
                              onClick={() => handleReview(selectedResult.id, "NG")}
                              disabled={reviewing === selectedResult.id}
                              className="btn-primary flex-1 justify-center text-xs py-2"
                              style={{background:"var(--clr-error)", textTransform:"none", letterSpacing:"normal"}}
                            >
                              {reviewing === selectedResult.id ? (
                                <span className="material-symbols-outlined text-[16px] animate-spin">hourglass_top</span>
                              ) : (
                                <span className="material-symbols-outlined text-[16px]">report</span>
                              )}
                              {selectedResult.verdict === "NG" ? "Confirm Fail" : "Mark as Fail"}
                            </button>
                          </div>
                          <p className="text-[10px] mt-3" style={{color:"var(--clr-text-muted)"}}>
                            <span className="material-symbols-outlined text-[12px]" style={{verticalAlign:"middle"}}>info</span>
                            {" "}Validated images will be auto-exported to the training dataset.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
