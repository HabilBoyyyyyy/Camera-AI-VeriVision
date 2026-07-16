"use client";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faCamera, faCube, faDatabase, faExclamationTriangle, faShieldAlt, faThLarge, faTrophy } from '@fortawesome/free-solid-svg-icons';



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
function GridIcon(p) { return <FontAwesomeIcon icon={faThLarge} className={p.className || ''} /> ; }
function DatabaseIcon(p) { return <FontAwesomeIcon icon={faDatabase} className={p.className || ''} /> ; }
function CubeIcon(p) { return <FontAwesomeIcon icon={faCube} className={p.className || ''} /> ; }
function CameraIcon(p) { return <FontAwesomeIcon icon={faCamera} className={p.className || ''} /> ; }
function ArrowRightIcon(p) { return <FontAwesomeIcon icon={faArrowRight} className={p.className || ''} /> ; }
function ShieldIcon(p) { return <FontAwesomeIcon icon={faShieldAlt} className={p.className || ''} /> ; }
function AlertIcon(p) { return <FontAwesomeIcon icon={faExclamationTriangle} className={p.className || ''} /> ; }
function TrophyIcon(p) { return <FontAwesomeIcon icon={faTrophy} className={p.className || ''} /> ; }

// ── Donut center label ────────────────────────────────────────────────────────
function YieldLabel({ viewBox, ok, total }) {
  if (!viewBox) return null;
  const { cx, cy } = viewBox;
  const pct = total > 0 ? Math.round((ok / total) * 100) : 0;
  return (
    <g>
      <text x={cx} y={cy - 8} textAnchor="middle" fill="#dbe0e6" fontSize={26} fontWeight="700" fontFamily="monospace">{pct}%</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="#5a6270" fontSize={11} fontWeight="600">YIELD</text>
    </g>
  );
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
function CustomBarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1e24] border border-[#333b46] rounded px-4 py-3 text-xs shadow-2xl">
      <p className="font-bold text-[#dbe0e6] mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-sm" style={{ background: p.fill }} />
          <span className="text-[#8a93a3]">{p.name}:</span>
          <span className="text-[#dbe0e6] font-mono font-bold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function CustomPieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1e24] border border-[#333b46] rounded px-3 py-2 text-xs shadow-2xl">
      <span style={{ color: payload[0].payload.fill }} className="font-bold">{payload[0].name}: </span>
      <span className="text-[#dbe0e6] font-mono">{payload[0].value}</span>
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
      iconColor: "text-[#f5a623]",
      accent: "#f5a623",
    },
    {
      label: "Trained Models",
      value: summary.trained_models,
      icon: <CubeIcon className="w-6 h-6" />,
      iconColor: "text-[#7a8ba8]",
      accent: "#7a8ba8",
    },
    {
      label: "Inspections Today",
      value: summary.inspections_today,
      icon: <CameraIcon className="w-6 h-6" />,
      iconColor: "text-[#2fb380]",
      accent: "#2fb380",
    },
    {
      label: "NG Parts Today",
      value: summary.today_yield?.NG ?? 0,
      icon: <AlertIcon className="w-6 h-6" />,
      iconColor: "text-[#e5484d]",
      accent: "#e5484d",
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
    { name: "OK",        value: summary.today_yield.OK,        fill: "#2fb380" },
    { name: "NG",        value: summary.today_yield.NG,        fill: "#e5484d" },
    { name: "Uncertain", value: summary.today_yield.Uncertain, fill: "#f5a623" },
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
          <GridIcon className="w-5 h-5 text-[#f5a623]" />
          <h1 className="text-xl font-display font-bold text-[#e4e7eb] tracking-wide uppercase">Dashboard</h1>
        </div>
        <p className="text-sm text-[#5a6270] ml-8">
          Welcome back, <span className="text-[#8a93a3] font-semibold">{user?.username}</span>
          <span className="ml-2 text-[#3a4149]">·</span>
          <span className="ml-2 text-[#3a4149]">{new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
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
            <div key={i} className="glass-card p-5 relative overflow-hidden group">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold text-[#5a6270] uppercase tracking-widest mb-2 font-mono">{card.label}</p>
                  <p className="text-4xl font-bold text-[#e4e7eb] font-mono">{card.value}</p>
                </div>
                <div className={`${card.iconColor} opacity-60 group-hover:opacity-100 transition-opacity`}>{card.icon}</div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: card.accent, opacity: 0.5 }} />
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
              <h2 className="section-label">Today's Yield</h2>
              <p className="text-[11px] text-[#5a6270] mt-0.5">{totalToday} inspections</p>
            </div>
            <ShieldIcon className="w-5 h-5 text-[#3a4149]" />
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
                  { label: "OK", color: "bg-[#2fb380]", val: summary?.today_yield?.OK ?? 0 },
                  { label: "NG", color: "bg-[#e5484d]", val: summary?.today_yield?.NG ?? 0 },
                  { label: "?", color: "bg-[#f5a623]", val: summary?.today_yield?.Uncertain ?? 0 },
                ].map(({ label, color, val }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-sm ${color}`} />
                    <span className="text-xs text-[#8a93a3]">{label}</span>
                    <span className="text-xs font-bold text-[#dbe0e6] font-mono">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full border-2 border-dashed border-[#333b46] flex items-center justify-center mx-auto mb-3">
                  <ShieldIcon className="w-8 h-8 text-[#3a4149]" />
                </div>
                <p className="text-xs text-[#5a6270]">No inspections today yet</p>
                <Link href="/live" className="text-xs text-[#f5a623] hover:text-[#ffc157] mt-1 inline-block font-semibold transition-colors">
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
              <h2 className="section-label">Weekly Inspection Volume</h2>
              <p className="text-[11px] text-[#5a6270] mt-0.5">Last 7 days</p>
            </div>
            <CameraIcon className="w-5 h-5 text-[#3a4149]" />
          </div>
          <div className="flex-1" style={{ minHeight: 200 }}>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={summary?.weekly_volume ?? []} barSize={14} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232830" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: "#5a6270", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#5a6270", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: "rgba(138,147,163,0.06)" }} />
                <Bar dataKey="OK" stackId="a" fill="#2fb380" radius={[0, 0, 0, 0]} />
                <Bar dataKey="NG" stackId="a" fill="#e5484d" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Uncertain" stackId="a" fill="#f5a623" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Bottom Row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in stagger-4">

        {/* Recent Defect Gallery */}
        <div className="lg:col-span-2 glass-card overflow-hidden">
          <div className="px-6 py-4 border-b border-[#2b313a] bg-[#181c22] flex items-center justify-between">
            <div>
              <h2 className="section-label">Recent Defects</h2>
              <p className="text-[11px] text-[#5a6270] mt-0.5">Latest NG parts detected</p>
            </div>
            <Link href="/results?verdict=NG" className="text-xs text-[#f5a623] hover:text-[#ffc157] font-semibold transition-colors">
              View All →
            </Link>
          </div>

          {summary?.recent_ng_parts?.length > 0 ? (
            <div className="p-5 grid grid-cols-4 gap-3">
              {summary.recent_ng_parts.map((part, i) => (
                <div key={part.id} className="group relative rounded overflow-hidden border border-[#e5484d]/25 bg-[#0f1216] aspect-square">
                  {part.image_path ? (
                    <img
                      src={`${BASE_URL}${part.image_path}`}
                      alt={`NG part ${part.id.substring(0, 6)}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <AlertIcon className="w-6 h-6 text-[#e5484d]/40" />
                    </div>
                  )}
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                    <span className="text-[9px] font-mono text-[#f26e72] font-bold">{(part.confidence * 100).toFixed(0)}% conf</span>
                    <span className="text-[9px] text-[#8a93a3] font-mono">{part.id.substring(0, 8)}</span>
                  </div>
                  {/* NG badge */}
                  <div className="absolute top-1.5 right-1.5 bg-[#e5484d] text-white text-[8px] font-bold px-1.5 py-0.5 rounded-sm font-mono">NG</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded bg-[#2fb380]/10 border border-[#2fb380]/25 flex items-center justify-center mx-auto mb-4">
                <ShieldIcon className="w-8 h-8 text-[#4fd39a]" />
              </div>
              <p className="text-sm font-semibold text-[#4fd39a]">No Defects Detected</p>
              <p className="text-xs text-[#5a6270] mt-1">All recent parts passed inspection</p>
            </div>
          )}
        </div>

        {/* Right Column: Top Models + Quick Actions */}
        <div className="flex flex-col gap-5">

          {/* Top Models */}
          <div className="glass-card overflow-hidden flex-1">
            <div className="px-5 py-4 border-b border-[#2b313a] bg-[#181c22] flex items-center justify-between">
              <h2 className="section-label">Top Models</h2>
              <TrophyIcon className="w-4 h-4 text-[#f5a623] opacity-70" />
            </div>
            {summary?.top_models?.length > 0 ? (
              <div className="divide-y divide-[#232830]">
                {summary.top_models.map((m, i) => (
                  <div key={m.id} className="px-5 py-3 flex items-center gap-3 hover:bg-[#1e232a] transition-colors">
                    <span className={`text-xs font-bold w-5 text-center font-mono ${
                      i === 0 ? "text-[#f5a623]" : i === 1 ? "text-[#8a93a3]" : i === 2 ? "text-[#a87c3f]" : "text-[#3a4149]"
                    }`}>#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#dbe0e6] truncate">{m.name} <span className="text-[#5a6270]">v{m.version}</span></p>
                      <p className="text-[10px] text-[#5a6270]">{m.architecture} · {m.task_type}</p>
                    </div>
                    {m.score !== null ? (
                      <div className="text-right">
                        <span className="text-xs font-bold text-[#f5a623] font-mono">{(m.score * 100).toFixed(1)}%</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-[#3a4149] font-mono">—</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <CubeIcon className="w-8 h-8 text-[#333b46] mx-auto mb-2" />
                <p className="text-xs text-[#5a6270]">No trained models yet</p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="glass-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[#2b313a] bg-[#181c22]">
              <h2 className="section-label">Quick Actions</h2>
            </div>
            <div className="divide-y divide-[#232830]">
              {quickActions.map((action, i) => (
                <Link
                  key={i}
                  href={action.href}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-[#1e232a] transition-colors group"
                >
                  <div className="w-8 h-8 rounded bg-[#f5a623]/10 border border-[#f5a623]/25 flex items-center justify-center text-[#f5a623] group-hover:bg-[#f5a623]/20 transition-colors shrink-0">
                    {action.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#dbe0e6]">{action.label}</p>
                    <p className="text-[10px] text-[#5a6270]">{action.desc}</p>
                  </div>
                  <ArrowRightIcon className="w-3.5 h-3.5 text-[#3a4149] group-hover:text-[#f5a623] group-hover:translate-x-0.5 transition-all" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}