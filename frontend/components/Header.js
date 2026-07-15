"use client";

import { useAuth } from "@/lib/AuthContext";

function MenuIcon(p) { return <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>; }

export default function Header({ onMenuToggle }) {
  const { user } = useAuth();
  
  return (
    <header className="h-14 border-b border-slate-800/80 bg-[#060d1b]/80 backdrop-blur-xl flex items-center justify-between px-5 shrink-0">
      <div className="flex items-center gap-4">
        <button onClick={onMenuToggle} className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">
          <MenuIcon className="w-5 h-5" />
        </button>
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">VeriVision</span>
          <span className="text-[10px] text-slate-700">/</span>
          <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest">Inspection Platform</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{user.role}</span>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        )}
      </div>
    </header>
  );
}
