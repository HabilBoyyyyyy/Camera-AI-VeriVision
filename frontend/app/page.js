"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { fetchDashboardSummary } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

function GridIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>; }
function DatabaseIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>; }
function CubeIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.27 6.96 8.73 5.05 8.73-5.05M12 22.08V12"/></svg>; }
function CameraIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3"/></svg>; }
function ArrowRightIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>; }

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user, isAdmin } = useAuth();

  useEffect(() => {
    fetchDashboardSummary()
      .then(setSummary)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const statCards = summary ? [
    {
      label: "Datasets",
      value: summary.total_datasets,
      icon: <DatabaseIcon className="w-6 h-6" />,
      color: "from-cyan-500/20 to-cyan-600/10",
      iconColor: "text-cyan-400",
      borderColor: "border-cyan-500/20",
    },
    {
      label: "Trained Models",
      value: summary.trained_models,
      icon: <CubeIcon className="w-6 h-6" />,
      color: "from-blue-500/20 to-blue-600/10",
      iconColor: "text-blue-400",
      borderColor: "border-blue-500/20",
    },
    {
      label: "Inspections Today",
      value: summary.inspections_today,
      icon: <CameraIcon className="w-6 h-6" />,
      color: "from-emerald-500/20 to-emerald-600/10",
      iconColor: "text-emerald-400",
      borderColor: "border-emerald-500/20",
    },
  ] : [];

  const quickActions = isAdmin ? [
    { href: "/datasets", label: "Upload Dataset", icon: <DatabaseIcon className="w-5 h-5" />, desc: "Upload new training data" },
    { href: "/training", label: "Train Model", icon: <CubeIcon className="w-5 h-5" />, desc: "Configure and start training" },
    { href: "/live", label: "Live Inspection", icon: <CameraIcon className="w-5 h-5" />, desc: "Inspect parts in real-time" },
  ] : [
    { href: "/live", label: "Live Inspection", icon: <CameraIcon className="w-5 h-5" />, desc: "Inspect parts in real-time" },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-10">
      {/* Header */}
      <div className="animate-fade-in stagger-1">
        <div className="flex items-center gap-3 mb-1">
          <GridIcon className="w-5 h-5 text-cyan-500" />
          <h1 className="text-xl font-semibold text-slate-100 tracking-tight">Dashboard</h1>
        </div>
        <p className="text-sm text-slate-500 ml-8">
          Welcome back, <span className="text-slate-300 font-semibold">{user?.username}</span>
        </p>
      </div>

      {/* Stat Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in stagger-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card p-6 h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in stagger-2">
          {statCards.map((card, i) => (
            <div key={i} className={`glass-card p-6 bg-gradient-to-br ${card.color} ${card.borderColor} relative overflow-hidden`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{card.label}</p>
                  <p className="text-3xl font-bold text-slate-100 data-mono">{card.value}</p>
                </div>
                <div className={`${card.iconColor} opacity-60`}>{card.icon}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="animate-fade-in stagger-3">
        <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {quickActions.map((action, i) => (
            <Link
              key={i}
              href={action.href}
              className="glass-card p-5 group hover:bg-slate-800/30 transition-all duration-300 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:bg-cyan-500/20 transition-colors">
                  {action.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-200">{action.label}</p>
                  <p className="text-[11px] text-slate-500">{action.desc}</p>
                </div>
              </div>
              <ArrowRightIcon className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Inspections */}
      {summary?.recent_inspections?.length > 0 && (
        <div className="glass-card overflow-hidden animate-fade-in stagger-4">
          <div className="px-6 py-4 border-b border-slate-700/30 bg-slate-800/30 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Recent Inspections</h2>
            <Link href="/results" className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold transition-colors">
              View All →
            </Link>
          </div>
          <div className="divide-y divide-slate-800/50">
            {summary.recent_inspections.map((r, i) => (
              <div key={i} className="px-6 py-3 flex items-center justify-between hover:bg-slate-800/20 transition-colors">
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                    r.verdict === "OK" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" :
                    r.verdict === "NG" ? "bg-red-500/15 text-red-400 border-red-500/20" :
                    "bg-amber-500/15 text-amber-400 border-amber-500/20"
                  }`}>{r.verdict}</span>
                  <span className="text-xs text-slate-400 font-mono">{r.id?.substring(0, 8)}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-300 font-mono">{(r.confidence * 100).toFixed(1)}%</span>
                  <span className="text-[10px] text-slate-500">
                    {r.created_at ? new Date(r.created_at).toLocaleString() : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
