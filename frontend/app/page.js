"use client";

import {useState, useEffect} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {fetchDashboardSummary, getTrainingHistory, fetchAlerts} from "@/lib/api";
import {useAuth} from "@/lib/AuthContext";
import TrainingMonitor from "@/components/TrainingMonitor";

const BASE_URL = "http://localhost:8000";

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

function YieldLabel({viewBox, ok, total}) {
  if (!viewBox) return null;
  const {cx, cy} = viewBox;
  const pct = total > 0 ? Math.round((ok / total) * 100) : 0;
  return (
    <g>
      <text x={cx} y={cy - 8} textAnchor="middle" fill="currentColor" fontSize={26} fontWeight="700" fontFamily="Geist, sans-serif">
        {pct}%
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="currentColor" fontSize={11} fontWeight="600" opacity="0.5">
        YIELD
      </text>
    </g>
  );
}

function CustomBarTooltip({active, payload, label}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{background:"var(--clr-surface)", border:"1px solid var(--clr-border)", borderRadius:6, padding:"10px 14px", fontSize:12, boxShadow:"0 4px 12px rgba(0,0,0,.15)"}}>
      <p style={{fontWeight:700, color:"var(--clr-text)", marginBottom:6}}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} style={{display:"flex", alignItems:"center", gap:6, marginBottom:3}}>
          <span style={{width:8, height:8, borderRadius:2, background:p.fill, display:"inline-block"}} />
          <span style={{color:"var(--clr-text-sub)"}}>{p.name}:</span>
          <span style={{color:"var(--clr-text)", fontWeight:700}}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function CustomPieTooltip({active, payload}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{background:"var(--clr-surface)", border:"1px solid var(--clr-border)", borderRadius:6, padding:"8px 12px", fontSize:12, boxShadow:"0 4px 12px rgba(0,0,0,.15)"}}>
      <span style={{color:payload[0].payload.fill, fontWeight:700}}>{payload[0].name}: </span>
      <span style={{color:"var(--clr-text)"}}>{payload[0].value}</span>
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [alertsData, setAlertsData] = useState(null);
  const [alertsList, setAlertsList] = useState([]);
  const [alertsExpanded, setAlertsExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeJobId, setActiveJobId] = useState(null);
  const {user} = useAuth();
  const router = useRouter();

  const loadDashboard = async () => {
    try {
      const [data, history, fetchedAlerts] = await Promise.all([
        fetchDashboardSummary(),
        getTrainingHistory().catch(() => []),
        fetchAlerts().catch(() => ({ alerts: [] })),
      ]);
      setSummary(data);
      if (fetchedAlerts) {
        setAlertsData(fetchedAlerts);
        setAlertsList(fetchedAlerts.alerts || []);
      }
      const active = (history || []).find(j => j.status === "training" || j.status === "queued");
      setActiveJobId(active?.job_id || null);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadDashboard(); }, []);

  const handleDismissAlert = (id) => {
    setAlertsList(prev => prev.filter(a => a.id !== id));
  };

  const statCards = summary ? [
    {label:"Total Scans (24h)", value: summary.inspections_today?.toLocaleString() ?? "0", icon:"qr_code_scanner", sub: summary.scans_change_pct || "+0.0% vs prev", subIcon:"trending_up", subOk:true, link:"/results"},
    {label:"Defect Rate",       value: `${summary.total_datasets ?? 0}`,                   icon:"troubleshoot",  sub:"Active datasets", subIcon:"database", subOk:false, link:"/results?verdict=NG"},
    {label:"Active Models",     value: summary.trained_models ?? 0,                         icon:"memory",        sub:"All nominal", subIcon:"check_circle", subOk:false, link:"/ai-studio?tab=models"},
    {label:"System Uptime",     value: summary.uptime_str || "Up 0m",                        icon:"dns",           sub:"Running smoothly", subIcon:"schedule", subOk:false},
  ] : [];

  const YIELD_COLORS = {OK:"#2e7d32", NG:"#ba1a1a", Uncertain:"#e65100"};
  const yieldData = summary?.today_yield
    ? Object.entries(summary.today_yield)
        .map(([name, value]) => ({name, value, fill: YIELD_COLORS[name] ?? "#888"}))
        .filter(d => d.value > 0)
    : [];
  const totalToday = yieldData.reduce((s, d) => s + d.value, 0);

  const displayedAlerts = alertsExpanded ? alertsList : alertsList.slice(0, 5);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-[28px] font-semibold leading-tight tracking-tight" style={{color:"var(--clr-text)"}}>
          Overview
        </h2>
        <p className="text-sm mt-1" style={{color:"var(--clr-text-sub)"}}>
          Real-time production metrics · Welcome back,{" "}
          <span className="font-semibold" style={{color:"var(--clr-text)"}}>{user?.username}</span>
        </p>
      </div>

      {/* Training Banner */}
      {activeJobId && (
        <div className="animate-fade-in stagger-1">
          <TrainingMonitor initialJobId={activeJobId} onComplete={loadDashboard} onDismiss={() => setActiveJobId(null)} />
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-2">
        {loading ? (
          [1,2,3,4].map(i => (
            <div key={i} className="vv-card p-5 h-24 animate-pulse" style={{background:"var(--clr-surface-low)"}} />
          ))
        ) : statCards.map((card, i) => (
          <div 
            key={i} 
            className={`vv-card p-5 flex flex-col gap-2 ${card.link ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200' : ''}`}
            onClick={() => card.link && router.push(card.link)}
          >
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{color:"var(--clr-text-muted)"}}>{card.label}</span>
              <span className="material-symbols-outlined text-[22px]" style={{color:"var(--clr-text-muted)"}}>{card.icon}</span>
            </div>
            <div className="text-[28px] font-bold leading-none" style={{color:"var(--clr-text)"}}>{card.value}</div>
            <div className="text-[12px] flex items-center gap-1" style={{color: card.subOk ? "var(--clr-accent)" : "var(--clr-text-sub)"}}>
              <span className="material-symbols-outlined text-[14px]">{card.subIcon}</span>
              {card.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Full Alerts Section */}
      <div className="stagger-3 space-y-4">
        {/* AI Shift Summary */}
        {!loading && alertsData?.summary && (
          <div
            className="vv-card p-5 relative overflow-hidden animate-fade-in"
            style={{borderColor:"rgba(0,140,199,0.2)", background:"rgba(0,140,199,0.03)"}}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-[18px]" style={{color:"var(--clr-accent)"}}>auto_awesome</span>
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{color:"var(--clr-accent)"}}>AI Shift Summary</span>
            </div>
            <p className="text-sm leading-relaxed font-medium" style={{color:"var(--clr-text-sub)"}}>{alertsData.summary}</p>
          </div>
        )}

        {/* Alerts List */}
        {!loading && (
          <div className="vv-card flex flex-col overflow-hidden">
            <div className="p-4 shrink-0 flex justify-between items-center" style={{borderBottom:"1px solid var(--clr-border)", background:"var(--clr-surface-low)"}}>
              <h3 className="text-base font-semibold flex items-center gap-2" style={{color:"var(--clr-text)"}}>
                <span className="material-symbols-outlined text-[20px]" style={{color:"var(--clr-warn)", fontVariationSettings:"'FILL' 1"}}>notifications_active</span>
                System Alerts
              </h3>
            </div>
            
            <div className="flex-1 divide-y" style={{divideColor:"var(--clr-border)"}}>
              {displayedAlerts.length > 0 ? displayedAlerts.map((alert, i) => {
                const cfg = SEVERITY_CFG[alert.severity] || SEVERITY_CFG.info;
                const timeStr = alert.created_at
                  ? new Date(alert.created_at + "Z").toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})
                  : "";
                return (
                  <div key={alert.id || i} className="p-4 flex items-start gap-4 transition-colors relative hover:bg-[var(--clr-surface-low)]" style={{borderLeft: `4px solid ${cfg.dotColor}`}}>
                    <div
                      className="w-8 h-8 rounded flex items-center justify-center shrink-0"
                      style={{background: cfg.bgColor, border:`1px solid ${cfg.borderColor}`}}
                    >
                      <span className="material-symbols-outlined text-[18px]" style={{color: cfg.iconColor, fontVariationSettings:"'FILL' 1"}}>{cfg.icon}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`badge ${cfg.badgeCls}`}>
                          {cfg.label}
                          {cfg.pulse && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />}
                        </span>
                        {timeStr && <span className="text-[10px] font-mono" style={{color:"var(--clr-text-muted)"}}>{timeStr}</span>}
                      </div>
                      <h3 className="text-sm font-bold mb-1" style={{color:"var(--clr-text)"}}>{alert.title}</h3>
                      <p className="text-xs leading-relaxed" style={{color:"var(--clr-text-sub)"}}>{alert.message}</p>
                    </div>

                    <button onClick={() => handleDismissAlert(alert.id)} className="text-xs btn-outline px-2 py-1 flex items-center gap-1 opacity-60 hover:opacity-100">
                      <span className="material-symbols-outlined text-[14px]">check</span>
                      Acknowledge
                    </button>
                  </div>
                );
              }) : (
                <div className="p-8 text-center text-xs" style={{color:"var(--clr-text-muted)"}}>
                  <span className="material-symbols-outlined text-[48px] block mb-3 opacity-30">check_circle</span>
                  No active alerts. Production is running smoothly.
                </div>
              )}
            </div>
            
            {alertsList.length > 5 && (
              <div className="p-3 shrink-0" style={{borderTop:"1px solid var(--clr-border)"}}>
                <button 
                  onClick={() => setAlertsExpanded(!alertsExpanded)}
                  className="btn-outline w-full justify-center text-xs py-2"
                >
                  {alertsExpanded ? "Show Less" : `View All Alerts (${alertsList.length})`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live Feed */}
      <div className="vv-card overflow-hidden flex flex-col stagger-4">
        <div className="p-4 flex justify-between items-center shrink-0" style={{borderBottom:"1px solid var(--clr-border)", background:"var(--clr-surface-low)"}}>
          <h3 className="text-base font-semibold" style={{color:"var(--clr-text)"}}>Live Inspection Feed: Line Alpha</h3>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{color:"var(--clr-text-sub)"}}>Live</span>
          </div>
        </div>
        <div className="relative min-h-[300px] flex-1 flex items-center justify-center" style={{background:"var(--clr-surface-mid)"}}>
          <div className="text-center" style={{color:"var(--clr-text-muted)"}}>
            <span className="material-symbols-outlined text-[56px] block mb-3 opacity-30">videocam_off</span>
            <p className="text-sm font-medium">Camera stream not connected</p>
            <Link href="/live" className="text-sm font-semibold hover:underline mt-2 inline-block" style={{color:"var(--clr-accent)"}}>
              Go to Live Inspection →
            </Link>
          </div>
        </div>
      </div>

      {/* Yield Donut + Weekly Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 stagger-5">
        {/* Donut */}
        <div className="lg:col-span-2 vv-card p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider" style={{color:"var(--clr-text-sub)"}}>Today's Yield</h3>
              <p className="text-xs mt-0.5" style={{color:"var(--clr-text-muted)"}}>{totalToday} inspections</p>
            </div>
            <span className="material-symbols-outlined text-[22px]" style={{color:"var(--clr-border)"}}>shield</span>
          </div>
          {totalToday > 0 ? (
            <div className="flex-1 flex flex-col items-center">
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie data={yieldData} cx="50%" cy="50%" innerRadius={58} outerRadius={82} paddingAngle={3} dataKey="value">
                    {yieldData.map((entry, idx) => <Cell key={idx} fill={entry.fill} stroke="transparent" />)}
                    <YieldLabel ok={summary?.today_yield?.OK ?? 0} total={totalToday} />
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-1 flex-wrap justify-center">
                {yieldData.map(({name, value, fill}) => (
                  <div key={name} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm" style={{background:fill}} />
                    <span className="text-xs" style={{color:"var(--clr-text-muted)"}}>{name}</span>
                    <span className="text-xs font-bold" style={{color:"var(--clr-text)"}}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <span className="material-symbols-outlined text-[48px] block mb-3" style={{color:"var(--clr-border)"}}>shield</span>
                <p className="text-xs" style={{color:"var(--clr-text-muted)"}}>No inspections today yet</p>
                <Link href="/live" className="text-xs font-semibold hover:underline mt-1 inline-block" style={{color:"var(--clr-accent)"}}>Start Inspection →</Link>
              </div>
            </div>
          )}
        </div>

        {/* Bar Chart */}
        <div className="lg:col-span-3 vv-card p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider" style={{color:"var(--clr-text-sub)"}}>Weekly Inspection Volume</h3>
              <p className="text-xs mt-0.5" style={{color:"var(--clr-text-muted)"}}>Last 7 days</p>
            </div>
            <span className="material-symbols-outlined text-[22px]" style={{color:"var(--clr-border)"}}>bar_chart</span>
          </div>
          <div className="flex-1" style={{minHeight:190}}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={summary?.weekly_volume ?? []} barSize={14} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--clr-border)" vertical={false} />
                <XAxis dataKey="day" tick={{fill:"var(--clr-text-muted)", fontSize:11}} axisLine={false} tickLine={false} />
                <YAxis tick={{fill:"var(--clr-text-muted)", fontSize:11}} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                <Tooltip content={<CustomBarTooltip />} cursor={{fill:"rgba(0,0,0,0.04)"}} />
                <Bar dataKey="OK"        stackId="a" fill="#2e7d32" radius={[0,0,0,0]} />
                <Bar dataKey="NG"        stackId="a" fill="#ba1a1a" radius={[0,0,0,0]} />
                <Bar dataKey="Uncertain" stackId="a" fill="#e65100" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Fails & Model Performance Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 stagger-6">
        {/* Recent Fails (NG) Gallery */}
        {summary?.recent_ng_parts?.length > 0 ? (
          <div className="vv-card overflow-hidden">
            <div className="p-4 flex justify-between items-center" style={{borderBottom:"1px solid var(--clr-border)", background:"var(--clr-surface-low)"}}>
              <div>
                <h3 className="text-base font-semibold uppercase tracking-wider" style={{color:"var(--clr-text)"}}>Recent Fails</h3>
                <p className="text-xs mt-0.5" style={{color:"var(--clr-text-sub)"}}>Latest NG parts detected</p>
              </div>
            <Link href="/results?verdict=NG" className="text-xs font-bold hover:underline" style={{color:"var(--clr-accent)"}}>
              View All →
            </Link>
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-3">
            {summary.recent_ng_parts.slice(0, 8).map((ng, i) => (
              <Link key={i} href={`/results?search_id=${ng.id}`}>
                <div className="relative aspect-square rounded-lg overflow-hidden border border-[#2b313a] group cursor-pointer bg-[#14171c]">
                  {ng.image_path ? (
                    <img src={`${BASE_URL}${ng.image_path}`} alt="NG Part" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <span className="material-symbols-outlined text-[28px] text-[#3a4149]">image_not_supported</span>
                    </div>
                  )}
                  <div className="absolute top-1.5 right-1.5 bg-[#ba1a1a] text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                    NG
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
        ) : (
          <div className="vv-card overflow-hidden flex flex-col items-center justify-center p-6 text-center text-xs" style={{color:"var(--clr-text-muted)"}}>
            <span className="material-symbols-outlined text-[48px] block mb-3 opacity-30">verified</span>
            No recent fails detected.
          </div>
        )}

        {/* Model Performance Table */}
        <div className="vv-card overflow-hidden">
          <div className="p-4 flex justify-between items-center" style={{borderBottom:"1px solid var(--clr-border)", background:"var(--clr-surface-low)"}}>
          <h3 className="text-base font-semibold" style={{color:"var(--clr-text)"}}>Model Performance (Active)</h3>
          <Link href="/ai-studio?tab=models">
            <button className="btn-outline text-xs py-1.5 px-3">View All Models</button>
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead style={{background:"var(--clr-surface-low)"}}>
              <tr style={{borderBottom:"1px solid var(--clr-border)"}}>
                {["Model ID","Target","Version","Precision","Recall","Status"].map(h => (
                  <th key={h} className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{color:"var(--clr-text-muted)"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody style={{color:"var(--clr-text)"}}>
              {(summary?.top_models?.length > 0
                ? summary.top_models.slice(0,3).map((m,i) => ({
                    id: m.name || `MDL-${i}`,
                    target: m.task_type || "—",
                    version: `v${m.version || "1.0"}`,
                    precision: m.score ? `${(m.score*100).toFixed(1)}%` : "—",
                    recall: "—",
                    status: "Deployed",
                  }))
                : [
                    {id:"MDL-SURFACE-01",  target:"Scratch/Dent",  version:"v2.4.1",    precision:"98.2%", recall:"96.5%", status:"Deployed"},
                    {id:"MDL-STRUCT-03",   target:"Fracture",      version:"v1.1.0",    precision:"99.1%", recall:"98.9%", status:"Deployed"},
                    {id:"MDL-ASSEMBLY-02", target:"Missing Part",  version:"v3.0.0-rc", precision:"94.5%", recall:"92.0%", status:"Shadow"},
                  ]
              ).map((row, i) => (
                <tr key={i} style={{borderBottom:"1px solid var(--clr-border)"}}
                  className="transition-colors"
                  onMouseEnter={e => e.currentTarget.style.background="var(--clr-surface-low)"}
                  onMouseLeave={e => e.currentTarget.style.background=""}
                >
                  <td className="px-5 py-3 font-mono text-[12px]" style={{color:"var(--clr-text)"}}>{row.id}</td>
                  <td className="px-5 py-3" style={{color:"var(--clr-text)"}}>{row.target}</td>
                  <td className="px-5 py-3" style={{color:"var(--clr-text-muted)"}}>{row.version}</td>
                  <td className="px-5 py-3 font-semibold" style={{color:"var(--clr-text)"}}>{row.precision}</td>
                  <td className="px-5 py-3" style={{color:"var(--clr-text)"}}>{row.recall}</td>
                  <td className="px-5 py-3">
                    <span className={`badge ${row.status === "Deployed" ? "badge-deployed" : "badge-archived"}`}>{row.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      </div>
    </div>
  );
}
