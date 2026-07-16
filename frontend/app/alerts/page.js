"use client";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faBell, faChartLine, faCheckCircle, faExclamationTriangle, faFire, faQuestionCircle, faSync, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';



import {useState, useEffect} from "react";
import Link from "next/link";
import {fetchAlerts} from "@/lib/api";

// ── Icons ─────────────────────────────────────────────────────────────────────
function BellIcon(p) { return <FontAwesomeIcon icon={faBell} className={p.className || ''} /> ; }
function FlameIcon(p) { return <FontAwesomeIcon icon={faFire} className={p.className || ''} /> ; }
function AlertTriangleIcon(p) { return <FontAwesomeIcon icon={faExclamationTriangle} className={p.className || ''} /> ; }
function HelpCircleIcon(p) { return <FontAwesomeIcon icon={faQuestionCircle} className={p.className || ''} /> ; }
function CheckCircleIcon(p) { return <FontAwesomeIcon icon={faCheckCircle} className={p.className || ''} /> ; }
function TrendingDownIcon(p) { return <FontAwesomeIcon icon={faChartLine} className={p.className || ''} /> ; }
function ArrowRightIcon(p) { return <FontAwesomeIcon icon={faArrowRight} className={p.className || ''} /> ; }
function SparkleIcon(p) { return <FontAwesomeIcon icon={faWandMagicSparkles} className={p.className || ''} /> ; }
function RefreshIcon(p) { return <FontAwesomeIcon icon={faSync} className={p.className || ''} /> ; }

// ── Severity config ───────────────────────────────────────────────────────────
const SEVERITY = {
  critical: {
    label: "Critical",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    badge: "bg-red-500/20 text-red-400 border-red-500/30",
    icon: FlameIcon,
    iconColor: "text-red-400",
    glow: "shadow-red-500/10",
    dot: "bg-red-500",
    pulse: true,
  },
  warning: {
    label: "Warning",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    badge: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    icon: AlertTriangleIcon,
    iconColor: "text-amber-400",
    glow: "shadow-amber-500/10",
    dot: "bg-amber-500",
    pulse: false,
  },
  info: {
    label: "Info",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    badge: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    icon: HelpCircleIcon,
    iconColor: "text-blue-400",
    glow: "shadow-blue-500/10",
    dot: "bg-blue-400",
    pulse: false,
  },
};

const ICON_MAP = {
  flame: FlameIcon,
  "alert-triangle": AlertTriangleIcon,
  "help-circle": HelpCircleIcon,
  "check-circle": CheckCircleIcon,
  "trending-down": TrendingDownIcon,
};

function AlertCard({alert}) {
  const cfg = SEVERITY[alert.severity] || SEVERITY.info;
  const IconComp = ICON_MAP[alert.icon] || BellIcon;
  const timeStr = alert.created_at
    ? new Date(alert.created_at + "Z").toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div
      className={`relative rounded-2xl border ${cfg.bg} ${cfg.border} p-5 shadow-lg ${cfg.glow} group hover:scale-[1.01] transition-transform duration-200`}>
      {/* Severity indicator bar */}
      <div
        className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-full ${cfg.dot}`}
      />

      <div className="flex items-start gap-4 pl-3">
        {/* Icon */}
        <div
          className={`mt-0.5 p-2.5 rounded-xl border ${cfg.border} ${cfg.bg} shrink-0`}>
          <IconComp className={`w-5 h-5 ${cfg.iconColor}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${cfg.badge}`}>
              {cfg.label}
              {cfg.pulse && (
                <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
              )}
            </span>
            {timeStr && (
              <span className="text-[10px] text-slate-600 font-mono">
                {timeStr}
              </span>
            )}
          </div>
          <h3 className="text-sm font-bold text-slate-100 mb-1">
            {alert.title}
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            {alert.message}
          </p>

          {alert.action_label && alert.action_url && (
            <Link
              href={alert.action_url}
              className={`inline-flex items-center gap-1.5 mt-3 text-xs font-bold ${cfg.iconColor} hover:underline group/btn`}>
              {alert.action_label}
              <ArrowRightIcon className="w-3 h-3 group-hover/btn:translate-x-0.5 transition-transform" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function SeverityCount({label, count, color, dot}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-sm font-bold font-mono ${color}`}>{count}</span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AlertsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all"); // all | critical | warning | info

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await fetchAlerts();
      setData(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const alerts = data?.alerts ?? [];
  const filteredAlerts =
    filter === "all" ? alerts : alerts.filter((a) => a.severity === filter);

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;
  const infoCount = alerts.filter((a) => a.severity === "info").length;

  const filterBtns = [
    {key: "all", label: `All (${alerts.length})`},
    {key: "critical", label: `Critical (${criticalCount})`},
    {key: "warning", label: `Warning (${warningCount})`},
    {key: "info", label: `Info (${infoCount})`},
  ];

  const generatedStr = data?.generated_at
    ? new Date(data.generated_at + "Z").toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="animate-fade-in stagger-1 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <BellIcon className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-semibold text-slate-100 tracking-tight">
              AI Alerts
            </h1>
            {criticalCount > 0 && (
              <span className="text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full animate-pulse">
                {criticalCount} CRITICAL
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 ml-8">
            AI-powered quality monitoring · Updated at {generatedStr || "—"}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-400 hover:text-slate-200 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:bg-slate-800 transition-all">
          <RefreshIcon
            className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {/* ── AI Shift Summary ───────────────────────────────────────────────── */}
      {!loading && data && (
        <div className="animate-fade-in stagger-2 relative rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-blue-600/5 p-6 shadow-lg overflow-hidden">
          {/* Decorative glow */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <SparkleIcon className="w-4 h-4 text-cyan-400" />
              <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-widest">
                AI Shift Summary
              </span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed font-medium">
              {data.summary}
            </p>

            {/* Yield mini-stats */}
            {data.total_today > 0 && (
              <div className="flex items-center gap-5 mt-4 pt-4 border-t border-slate-700/30">
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mr-1">
                  Today:
                </div>
                <SeverityCount
                  label="OK"
                  count={data.today_yield?.OK ?? 0}
                  color="text-emerald-400"
                  dot="bg-emerald-500"
                />
                <SeverityCount
                  label="NG"
                  count={data.today_yield?.NG ?? 0}
                  color="text-red-400"
                  dot="bg-red-500"
                />
                <SeverityCount
                  label="Uncertain"
                  count={data.today_yield?.Uncertain ?? 0}
                  color="text-amber-400"
                  dot="bg-amber-500"
                />
                <div className="ml-auto text-[10px] font-mono text-slate-500">
                  {data.total_today} total
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Filter Tabs ────────────────────────────────────────────────────── */}
      <div className="animate-fade-in stagger-3 flex items-center gap-2 flex-wrap">
        {filterBtns.map((btn) => (
          <button
            key={btn.key}
            onClick={() => setFilter(btn.key)}
            className={`px-4 py-1.5 text-xs font-bold rounded-xl border transition-all ${
              filter === btn.key
                ? "bg-slate-700 text-slate-100 border-slate-600"
                : "bg-transparent text-slate-500 border-slate-700/50 hover:border-slate-600 hover:text-slate-300"
            }`}>
            {btn.label}
          </button>
        ))}
      </div>

      {/* ── Alert Cards ────────────────────────────────────────────────────── */}
      <div className="animate-fade-in stagger-4 space-y-4">
        {loading ? (
          [1, 2, 3].map((i) => (
            <div
              key={i}
              className="glass-card p-5 h-28 animate-pulse rounded-2xl"
            />
          ))
        ) : filteredAlerts.length > 0 ? (
          filteredAlerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))
        ) : (
          <div className="glass-card rounded-2xl p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircleIcon className="w-8 h-8 text-emerald-400" />
            </div>
            <p className="text-sm font-bold text-emerald-400">All Clear!</p>
            <p className="text-xs text-slate-500 mt-1">
              {filter === "all"
                ? "No active alerts detected. Production is running smoothly."
                : `No ${filter} alerts at this time.`}
            </p>
          </div>
        )}
      </div>

      {/* ── Footer note ────────────────────────────────────────────────────── */}
      {!loading && alerts.length > 0 && (
        <p className="text-center text-[10px] text-slate-600 animate-fade-in">
          Alerts are generated in real-time by AI heuristic analysis of your
          inspection data. No external model required.
        </p>
      )}
    </div>
  );
}
