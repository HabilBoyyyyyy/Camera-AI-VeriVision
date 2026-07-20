"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useAuth} from "@/lib/AuthContext";

const adminNav = [
  {href: "/",         label: "Dashboard",       icon: "dashboard"},
  {href: "/datasets", label: "Datasets",        icon: "database"},
  {href: "/training", label: "Training",        icon: "model_training"},
  {href: "/models",   label: "Models",          icon: "deployed_code"},
  {href: "/live",     label: "Live Inspection", icon: "precision_manufacturing"},
  {href: "/results",  label: "Results",         icon: "analytics"},
  {href: "/alerts",   label: "Alerts",          icon: "notifications"},
  {href: "/users",    label: "Users",           icon: "group"},
];
const inspectorNav = [
  {href: "/",         label: "Dashboard",       icon: "dashboard"},
  {href: "/live",     label: "Live Inspection", icon: "precision_manufacturing"},
  {href: "/results",  label: "Results",         icon: "analytics"},
  {href: "/alerts",   label: "Alerts",          icon: "notifications"},
];

export default function Sidebar({isOpen, onClose}) {
  const pathname = usePathname();
  const {user, logout, isAdmin} = useAuth();
  const nav = isAdmin ? adminNav : inspectorNav;

  const handleLogout = async () => { await logout(); window.location.href = "/login"; };

  return (
    <aside
      className={`sidebar-fixed flex flex-col ${isOpen ? "open" : ""}`}
      style={{background:"var(--clr-bg)", borderRight:"1px solid var(--clr-border)"}}
    >
      {/* Logo ─────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b" style={{borderColor:"var(--clr-border)"}}>
        <img src="/logo.png" alt="VeriVision" className="w-8 h-8 object-contain rounded" />
        <div className="min-w-0">
          <h1 className="text-[15px] font-black tracking-widest leading-none truncate" style={{color:"var(--clr-text)"}}>
            VERIVISION
          </h1>
          <p className="text-[10px] mt-0.5 truncate" style={{color:"var(--clr-text-muted)"}}>Industrial AI Platform</p>
        </div>
        {/* Close button — mobile only */}
        <button onClick={onClose} className="ml-auto lg:hidden p-1 rounded" style={{color:"var(--clr-text-muted)"}}>
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      {/* Nav ─────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-2">
        {nav.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`nav-item ${active ? "active" : ""}`}
            >
              <span
                className="material-symbols-outlined text-[21px]"
                style={active ? {fontVariationSettings:"'FILL' 1"} : {}}
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User / Logout ──────────────────────────── */}
      {user && (
        <div className="border-t p-3" style={{borderColor:"var(--clr-border)"}}>
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
              style={{background:"var(--clr-surface-mid)", color:"var(--clr-text)"}}
            >
              {user.username?.substring(0,2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold truncate" style={{color:"var(--clr-text)"}}>{user.username}</p>
              <p className="text-[10px] uppercase tracking-widest" style={{color:"var(--clr-text-muted)"}}>{user.role}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="p-1.5 rounded transition-colors hover:bg-red-50"
              style={{color:"var(--clr-text-muted)"}}
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
