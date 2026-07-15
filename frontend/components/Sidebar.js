"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

function ShieldEyeIcon(p) {
  return (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
      <path d="M6 12s2.5-3 6-3 6 3 6 3"/>
    </svg>
  );
}
function GridIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>; }
function DatabaseIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>; }
function CpuIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"/></svg>; }
function CubeIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.27 6.96 8.73 5.05 8.73-5.05M12 22.08V12"/></svg>; }
function CameraIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3"/></svg>; }
function ListIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>; }
function XIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>; }
function LogOutIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>; }

const adminNavItems = [
  { href: "/", label: "Dashboard", icon: (cls) => <GridIcon className={cls} /> },
  { href: "/datasets", label: "Datasets", icon: (cls) => <DatabaseIcon className={cls} /> },
  { href: "/training", label: "Training", icon: (cls) => <CpuIcon className={cls} /> },
  { href: "/models", label: "Models", icon: (cls) => <CubeIcon className={cls} /> },
  { href: "/live", label: "Live Inspection", icon: (cls) => <CameraIcon className={cls} /> },
  { href: "/results", label: "Results", icon: (cls) => <ListIcon className={cls} /> },
];

const inspectorNavItems = [
  { href: "/live", label: "Live Inspection", icon: (cls) => <CameraIcon className={cls} /> },
  { href: "/results", label: "Results", icon: (cls) => <ListIcon className={cls} /> },
];

export default function Sidebar({ isOpen, onClose }) {
  const pathname = usePathname();
  const { user, logout, isAdmin } = useAuth();

  const navItems = isAdmin ? adminNavItems : inspectorNavItems;

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#060d1b]/98 backdrop-blur-2xl border-r border-slate-800/80 flex flex-col transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-cyan-500 to-blue-600 opacity-50" />

        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-slate-800/80">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded flex items-center justify-center">
              <img src="/logo.png" alt="Logo" className="w-7 h-7 object-contain" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-200 tracking-wide leading-none">VeriVision</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] text-slate-500 font-medium tracking-widest uppercase">Platform</span>
                <span className="text-[8px] bg-slate-800 text-slate-400 px-1 rounded font-mono">v2.0</span>
              </div>
            </div>
          </Link>
          <button onClick={onClose} className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 overflow-y-auto">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-3">Navigation</div>
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`relative flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 group ${
                    isActive ? "text-slate-100 bg-slate-800/40" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/20"
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] bg-cyan-500 rounded-r-full shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                  )}
                  {item.icon(`w-[18px] h-[18px] transition-colors ${isActive ? "text-cyan-400" : "text-slate-500 group-hover:text-slate-400"}`)}
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User */}
        <div className="border-t border-slate-800/80 p-4">
          {user && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center text-xs font-bold text-slate-200 border border-slate-600">
                  {user.username.substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-200 truncate">{user.username}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest">{user.role}</p>
                </div>
              </div>
              <button onClick={handleLogout} className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Logout">
                <LogOutIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
