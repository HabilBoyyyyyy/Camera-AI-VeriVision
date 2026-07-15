"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { fetchDashboardSummary, getTrainingHistory } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import TrainingMonitor from "@/components/TrainingMonitor";

const BASE_URL = "http://localhost:8000";

// ── Icons ─────────────────────────────────────────────────────────────────────
function GridIcon(p)     { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>; }
function DatabaseIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>; }
function CubeIcon(p)     { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.27 6.96 8.73 5.05 8.73-5.05M12 22.08V12"/></svg>; }
function CameraIcon(p)   { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3"/></svg>; }
function ArrowRightIcon(p){ return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>; }
function ShieldIcon(p)   { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>; }
function AlertIcon(p)    { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>; }
function TrophyIcon(p)   { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>; }

// ── Donut center label ────────────────────────────────────────────────────────
function YieldLabel({ viewBox, ok, total }) {
  if (!viewBox) return null;
  const { cx, cy } = viewBox;
  const pct = total > 0 ? Math.round((ok / total) * 100) : 0;
  return (
    <g>
      <text x={cx} y={cy - 8} textAnchor="middle" fill="#e2e8f0" fontSize={26} fontWeight="700" fontFamily="monospace">{pct}%</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="#64748b" fontSize={11} fontWeight="600">YIELD</text>
    </g>
  );
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
function CustomBarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900/95 border border-slate-700 rounded-xl px-4 py-3 text-xs shadow-2xl backdrop-blur-md">
      <p className="font-bold text-slate-200 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="text-slate-200 font-mono font-bold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function CustomPieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900/95 border border-slate-700 rounded-xl px-3 py-2 text-xs shadow-2xl backdrop-blur-md">
      <span style={{ color: payload[0].payload.fill }} className="font-bold">{payload[0].name}: </span>
      <span className="text-slate-200 font-mono">{payload[0].value}</span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeJobId, setActiveJobId] = useState(null);
  const { user, isAdmin } = useAuth();

  const loadDashboard = async () => {
    try {
      const [data, history] = await Promise.all([
        fetchDashboardSummary(),
        getTrainingHistory().catch(() => []),
      ]);
      setSummary(data);
      const active = (history || []).find(j => j.status === "training" || j.status === "queued");
      setActiveJobId(active?.job_id || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboard(); }, []);

  // ── Stat cards ──────────────────────────────────────────────────────────────
  const statCards = summary ? [
    {
      label: "Datasets",
      value: summary.total_datasets,
      icon: <DatabaseIcon className="w-6 h-6" />,
      color: "from-cyan-500/20 to-cyan-600/5",
      iconColor: "text-cyan-400",
      borderColor: "border-cyan-500/20",
      glow: "shadow-cyan-500/10",
    },
    {
      label: "Trained Models",
      value: summary.trained_models,
      icon: <CubeIcon className="w-6 h-6" />,
      color: "from-blue-500/20 to-blue-600/5",
      iconColor: "text-blue-400",
      borderColor: "border-blue-500/20",
      glow: "shadow-blue-500/10",
    },
    {
      label: "Inspections Today",
      value: summary.inspections_today,
      icon: <CameraIcon className="w-6 h-6" />,
      color: "from-emerald-500/20 to-emerald-600/5",
      iconColor: "text-emerald-400",
      borderColor: "border-emerald-500/20",
      glow: "shadow-emerald-500/10",
    },
    {
      label: "NG Parts Today",
      value: summary.today_yield?.NG ?? 0,
      icon: <AlertIcon className="w-6 h-6" />,
      color: "from-red-500/20 to-red-600/5",
      iconColor: "text-red-400",
      borderColor: "border-red-500/20",
      glow: "shadow-red-500/10",
    },
  ] : [];

  const quickActions = isAdmin ? [
    { href: "/datasets", label: "Upload Dataset", icon: <DatabaseIcon className="w-5 h-5" />, desc: "Upload new training data" },
    { href: "/training", label: "Train Model", icon: <CubeIcon className="w-5 h-5" />, desc: "Configure and start training" },
    { href: "/live", label: "Live Inspection", icon: <CameraIcon className="w-5 h-5" />, desc: "Inspect parts in real-time" },
  ] : [
    { href: "/live", label: "Live Inspection", icon: <CameraIcon className="w-5 h-5" />, desc: "Inspect parts in real-time" },
    { href: "/results", label: "View Results", icon: <ShieldIcon className="w-5 h-5" />, desc: "Browse inspection history" },
  ];

  // Donut data
  const yieldData = summary?.today_yield ? [
    { name: "OK",        value: summary.today_yield.OK,        fill: "#10b981" },
    { name: "NG",        value: summary.today_yield.NG,        fill: "#ef4444" },
    { name: "Uncertain", value: summary.today_yield.Uncertain, fill: "#f59e0b" },
  ].filter(d => d.value > 0) : [];

  const totalToday = summary?.today_yield
    ? (summary.today_yield.OK + summary.today_yield.NG + summary.today_yield.Uncertain)
    : 0;

  const hasAnyInspections = totalToday > 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="animate-fade-in stagger-1">
        <div className="flex items-center gap-3 mb-1">
          <GridIcon className="w-5 h-5 text-cyan-500" />
          <h1 className="text-xl font-semibold text-slate-100 tracking-tight">Dashboard</h1>
        </div>
        <p className="text-sm text-slate-500 ml-8">
          Welcome back, <span className="text-slate-300 font-semibold">{user?.username}</span>
          <span className="ml-2 text-slate-600">·</span>
          <span className="ml-2 text-slate-600">{new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
        </p>
      </div>

      {/* ── Active Training Banner ─────────────────────────────────────────── */}
      {activeJobId && (
        <div className="animate-fade-in stagger-2">
          <TrainingMonitor
            initialJobId={activeJobId}
            onComplete={loadDashboard}
            onDismiss={() => setActiveJobId(null)}
          />
        </div>
      )}

      {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
          {[1, 2, 3, 4].map(i => <div key={i} className="glass-card p-6 h-28 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in stagger-2">
          {statCards.map((card, i) => (
            <div key={i} className={`glass-card p-5 bg-gradient-to-br ${card.color} ${card.borderColor} shadow-lg ${card.glow} relative overflow-hidden group`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{card.label}</p>
                  <p className="text-4xl font-bold text-slate-100 font-mono">{card.value}</p>
                </div>
                <div className={`${card.iconColor} opacity-50 group-hover:opacity-80 transition-opacity`}>{card.icon}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Analytics Row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 animate-fade-in stagger-3">

        {/* Donut: Today's Yield */}
        <div className="lg:col-span-2 glass-card p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Today's Yield</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">{totalToday} inspections</p>
            </div>
            <ShieldIcon className="w-5 h-5 text-slate-600" />
          </div>
          {hasAnyInspections ? (
            <div className="flex-1 flex flex-col items-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={yieldData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {yieldData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} stroke="transparent" />
                    ))}
                    <YieldLabel ok={summary?.today_yield?.OK ?? 0} total={totalToday} />
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-5 mt-2">
                {[
                  { label: "OK", color: "bg-emerald-500", val: summary?.today_yield?.OK ?? 0 },
                  { label: "NG", color: "bg-red-500",     val: summary?.today_yield?.NG ?? 0 },
                  { label: "?", color: "bg-amber-500",    val: summary?.today_yield?.Uncertain ?? 0 },
                ].map(({ label, color, val }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${color}`} />
                    <span className="text-xs text-slate-400">{label}</span>
                    <span className="text-xs font-bold text-slate-200 font-mono">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full border-4 border-dashed border-slate-700 flex items-center justify-center mx-auto mb-3">
                  <ShieldIcon className="w-8 h-8 text-slate-600" />
                </div>
                <p className="text-xs text-slate-500">No inspections today yet</p>
                <Link href="/live" className="text-xs text-cyan-400 hover:text-cyan-300 mt-1 inline-block font-semibold transition-colors">
                  Start Inspection →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Bar: 7-day Volume */}
        <div className="lg:col-span-3 glass-card p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Weekly Inspection Volume</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Last 7 days</p>
            </div>
            <CameraIcon className="w-5 h-5 text-slate-600" />
          </div>
          <div className="flex-1" style={{ minHeight: 200 }}>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={summary?.weekly_volume ?? []} barSize={14} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: "rgba(100,116,139,0.08)" }} />
                <Bar dataKey="OK" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="NG" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Uncertain" stackId="a" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Bottom Row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in stagger-4">

        {/* Recent Defect Gallery */}
        <div className="lg:col-span-2 glass-card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700/30 bg-slate-800/30 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Recent Defects</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Latest NG parts detected</p>
            </div>
            <Link href="/results?verdict=NG" className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold transition-colors">
              View All →
            </Link>
          </div>

          {summary?.recent_ng_parts?.length > 0 ? (
            <div className="p-5 grid grid-cols-4 gap-3">
              {summary.recent_ng_parts.map((part, i) => (
                <div key={part.id} className="group relative rounded-xl overflow-hidden border border-red-500/20 bg-slate-900/50 aspect-square">
                  {part.image_path ? (
                    <img
                      src={`${BASE_URL}${part.image_path}`}
                      alt={`NG part ${part.id.substring(0, 6)}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <AlertIcon className="w-6 h-6 text-red-400/40" />
                    </div>
                  )}
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                    <span className="text-[9px] font-mono text-red-300 font-bold">{(part.confidence * 100).toFixed(0)}% conf</span>
                    <span className="text-[9px] text-slate-400 font-mono">{part.id.substring(0, 8)}</span>
                  </div>
                  {/* NG badge */}
                  <div className="absolute top-1.5 right-1.5 bg-red-500/90 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">NG</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <ShieldIcon className="w-8 h-8 text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-emerald-400">No Defects Detected</p>
              <p className="text-xs text-slate-500 mt-1">All recent parts passed inspection</p>
            </div>
          )}
        </div>

        {/* Right Column: Top Models + Quick Actions */}
        <div className="flex flex-col gap-5">

          {/* Top Models */}
          <div className="glass-card overflow-hidden flex-1">
            <div className="px-5 py-4 border-b border-slate-700/30 bg-slate-800/30 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Top Models</h2>
              <TrophyIcon className="w-4 h-4 text-amber-400 opacity-60" />
            </div>
            {summary?.top_models?.length > 0 ? (
              <div className="divide-y divide-slate-800/50">
                {summary.top_models.map((m, i) => (
                  <div key={m.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-800/20 transition-colors">
                    <span className={`text-xs font-bold w-5 text-center font-mono ${
                      i === 0 ? "text-amber-400" : i === 1 ? "text-slate-300" : i === 2 ? "text-amber-700" : "text-slate-600"
                    }`}>#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-200 truncate">{m.name} <span className="text-slate-600">v{m.version}</span></p>
                      <p className="text-[10px] text-slate-500">{m.architecture} · {m.task_type}</p>
                    </div>
                    {m.score !== null ? (
                      <div className="text-right">
                        <span className="text-xs font-bold text-cyan-400 font-mono">{(m.score * 100).toFixed(1)}%</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-600 font-mono">—</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <CubeIcon className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-slate-500">No trained models yet</p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="glass-card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700/30 bg-slate-800/30">
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Quick Actions</h2>
            </div>
            <div className="divide-y divide-slate-800/50">
              {quickActions.map((action, i) => (
                <Link
                  key={i}
                  href={action.href}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-slate-800/20 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:bg-cyan-500/20 transition-colors shrink-0">
                    {action.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-200">{action.label}</p>
                    <p className="text-[10px] text-slate-500">{action.desc}</p>
                  </div>
                  <ArrowRightIcon className="w-3.5 h-3.5 text-slate-600 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
