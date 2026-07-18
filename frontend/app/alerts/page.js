"use client";

import {useState, useEffect} from "react";
import Link from "next/link";
import {fetchAlerts} from "@/lib/api";

const SEVERITY_CFG = {
  critical: {
    label: "Critical",
    badgeCls: "badge-fail",
    iconColor: "#ba1a1a",
    icon: "local_fire_department",
    dotColor: "#ba1a1a",
    borderColor: "rgba(186,26,26,0.25)",
    bgColor: "rgba(186,26,26,0.04)",
    pulse: true,
  },
  warning: {
    label: "Warning",
    badgeCls: "badge-review",
    iconColor: "#e65100",
    icon: "warning",
    dotColor: "#e65100",
    borderColor: "rgba(230,81,0,0.25)",
    bgColor: "rgba(230,81,0,0.04)",
    pulse: false,
  },
  info: {
    label: "Info",
    badgeCls: "badge-ready",
    iconColor: "#008cc7",
    icon: "info",
    dotColor: "#008cc7",
    borderColor: "rgba(0,140,199,0.2)",
    bgColor: "rgba(0,140,199,0.04)",
    pulse: false,
  },
};

function AlertCard({alert}) {
  const cfg = SEVERITY_CFG[alert.severity] || SEVERITY_CFG.info;
  const timeStr = alert.created_at
    ? new Date(alert.created_at + "Z").toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})
    : "";

  return (
    <div
      className="vv-card p-5 flex items-start gap-4 transition-shadow hover:shadow-sm relative overflow-hidden"
      style={{borderColor: cfg.borderColor, background: cfg.bgColor}}
    >
      {/* Left severity bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l" style={{background: cfg.dotColor}} />

      {/* Icon */}
      <div
        className="w-8 h-8 rounded flex items-center justify-center shrink-0 ml-2"
        style={{background: cfg.bgColor, border:`1px solid ${cfg.borderColor}`}}
      >
        <span className="material-symbols-outlined text-[18px]" style={{color: cfg.iconColor, fontVariationSettings:"'FILL' 1"}}>{cfg.icon}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={`badge ${cfg.badgeCls}`}>
            {cfg.label}
            {cfg.pulse && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />}
          </span>
          {timeStr && <span className="text-[10px] font-mono" style={{color:"var(--clr-text-muted)"}}>{timeStr}</span>}
          {alert.id && <span className="text-[10px] font-mono font-bold" style={{color:"var(--clr-text-muted)"}}>{alert.id}</span>}
        </div>
        <h3 className="text-sm font-bold mb-1" style={{color:"var(--clr-text)"}}>{alert.title}</h3>
        <p className="text-xs leading-relaxed" style={{color:"var(--clr-text-sub)"}}>{alert.message}</p>
        {alert.action_label && alert.action_url && (
          <Link href={alert.action_url} className="inline-flex items-center gap-1 mt-2 text-xs font-bold hover:underline" style={{color: cfg.iconColor}}>
            {alert.action_label}
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </Link>
        )}
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await fetchAlerts();
      setData(result);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const alerts = data?.alerts ?? [];
  const filteredAlerts = filter === "all" ? alerts : alerts.filter((a) => a.severity === filter);
  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount  = alerts.filter((a) => a.severity === "warning").length;
  const infoCount     = alerts.filter((a) => a.severity === "info").length;

  const filterBtns = [
    {key:"all",      label:`All (${alerts.length})`},
    {key:"critical", label:`Critical (${criticalCount})`},
    {key:"warning",  label:`Warning (${warningCount})`},
    {key:"info",     label:`Info (${infoCount})`},
  ];

  const generatedStr = data?.generated_at
    ? new Date(data.generated_at + "Z").toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})
    : "";

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="material-symbols-outlined text-[22px]" style={{color:"var(--clr-warn)", fontVariationSettings:"'FILL' 1"}}>notifications_active</span>
            <h2 className="text-2xl font-semibold" style={{color:"var(--clr-text)"}}>Alerts</h2>
            {criticalCount > 0 && (
              <span className="badge badge-fail animate-pulse">{criticalCount} CRITICAL</span>
            )}
          </div>
          <p className="text-sm" style={{color:"var(--clr-text-sub)"}}>
            AI-powered quality monitoring · {generatedStr ? `Updated at ${generatedStr}` : "Loading..."}
          </p>
        </div>
        <button
          id="btn-refresh-alerts"
          onClick={() => load(true)}
          disabled={refreshing}
          className="btn-outline shrink-0"
        >
          <span className={`material-symbols-outlined text-[18px] ${refreshing ? "animate-spin" : ""}`}>refresh</span>
          Refresh
        </button>
      </div>

      {/* AI Shift Summary */}
      {!loading && data && (
        <div
          className="vv-card p-5 relative overflow-hidden animate-fade-in stagger-1"
          style={{borderColor:"rgba(0,140,199,0.2)", background:"rgba(0,140,199,0.03)"}}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-[18px]" style={{color:"var(--clr-accent)"}}>auto_awesome</span>
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{color:"var(--clr-accent)"}}>AI Shift Summary</span>
          </div>
          <p className="text-sm leading-relaxed font-medium" style={{color:"var(--clr-text-sub)"}}>{data.summary}</p>

          {data.total_today > 0 && (
            <div className="flex items-center gap-5 mt-4 pt-4" style={{borderTop:"1px solid var(--clr-border)"}}>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{color:"var(--clr-text-muted)"}}>Today:</span>
              {[
                {label:"OK",  val: data.today_yield?.OK ?? 0,        color:"#16a34a"},
                {label:"NG",  val: data.today_yield?.NG ?? 0,        color:"#ba1a1a"},
                {label:"?",   val: data.today_yield?.Uncertain ?? 0, color:"#e65100"},
              ].map(({label, val, color}) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm" style={{background:color}} />
                  <span className="text-xs" style={{color:"var(--clr-text-muted)"}}>{label}</span>
                  <span className="text-sm font-bold font-mono" style={{color}}>{val}</span>
                </div>
              ))}
              <span className="ml-auto text-[10px] font-mono" style={{color:"var(--clr-text-muted)"}}>{data.total_today} total</span>
            </div>
          )}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {filterBtns.map((btn) => (
          <button
            key={btn.key}
            id={`filter-${btn.key}`}
            onClick={() => setFilter(btn.key)}
            className="px-4 py-1.5 text-xs font-semibold rounded border transition-all"
            style={{
              background: filter === btn.key ? "var(--clr-text)" : "transparent",
              color: filter === btn.key ? "var(--clr-bg)" : "var(--clr-text-sub)",
              borderColor: filter === btn.key ? "var(--clr-text)" : "var(--clr-border)",
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Alert Cards */}
      <div className="space-y-3">
        {loading ? (
          [1,2,3].map((i) => (
            <div key={i} className="vv-card p-5 h-28 animate-pulse" style={{background:"var(--clr-surface-low)"}} />
          ))
        ) : filteredAlerts.length > 0 ? (
          filteredAlerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))
        ) : (
          <div className="vv-card p-16 text-center">
            <span className="material-symbols-outlined text-[48px] block mb-3" style={{color:"var(--clr-success)"}}>check_circle</span>
            <p className="text-sm font-bold" style={{color:"var(--clr-success)"}}>All Clear!</p>
            <p className="text-xs mt-1" style={{color:"var(--clr-text-muted)"}}>
              {filter === "all"
                ? "No active alerts. Production is running smoothly."
                : `No ${filter} alerts at this time.`}
            </p>
          </div>
        )}
      </div>

      {!loading && alerts.length > 0 && (
        <p className="text-center text-[11px]" style={{color:"var(--clr-text-muted)"}}>
          Alerts are generated in real-time by AI heuristic analysis of your inspection data.
        </p>
      )}
    </div>
  );
}
