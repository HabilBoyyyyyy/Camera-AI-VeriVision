"use client";

import {useAuth} from "@/lib/AuthContext";
import {useState, useRef, useEffect} from "react";
import {useRouter} from "next/navigation";

// ── Simple Modal wrapper ─────────────────────────────────────────────────────
function Modal({title, icon, onClose, children}) {
  useEffect(() => {
    const esc = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{background:"rgba(0,0,0,0.5)", backdropFilter:"blur(4px)"}}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl overflow-hidden animate-fade-in"
        style={{
          background:"var(--clr-surface)",
          border:"1px solid var(--clr-border)",
          boxShadow:"0 24px 64px rgba(0,0,0,.3)",
          maxHeight:"80vh",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{borderBottom:"1px solid var(--clr-border)", background:"var(--clr-surface-low)"}}>
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[20px]" style={{color:"var(--clr-accent)"}}>{icon}</span>
            <h2 className="text-base font-semibold" style={{color:"var(--clr-text)"}}>{title}</h2>
          </div>
          <button className="p-1.5 rounded-lg transition-colors" style={{color:"var(--clr-text-muted)"}}
            onMouseEnter={e => e.currentTarget.style.background="var(--clr-surface-mid)"}
            onMouseLeave={e => e.currentTarget.style.background=""}
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        {/* Body */}
        <div className="p-5 overflow-y-auto" style={{maxHeight:"60vh"}}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Settings Panel Content ───────────────────────────────────────────────────
function SettingsContent({dark, toggleDark}) {
  const sections = [
    {
      label: "Appearance",
      icon: "palette",
      items: [
        {
          label: "Dark Mode",
          description: "Toggle between light and dark interface theme",
          control: (
            <div className="w-48 aspect-video rounded-xl has-[:checked]:bg-[#3a3347] bg-[#ebe6ef] border-4 border-[#121331] scale-[0.3] origin-right -my-8">
              <div className="flex h-full w-full px-2 items-center gap-x-2">
                <div className="w-6 h-6 flex-shrink-0 rounded-full border-4 border-[#121331]"></div>
                <label
                  htmlFor="switch"
                  className="has-[:checked]:scale-x-[-1] w-full h-10 border-4 border-[#121331] rounded cursor-pointer"
                >
                  <input type="checkbox" id="switch" className="hidden" checked={dark} onChange={toggleDark} />
                  <div className="w-full h-full bg-[#3b82f6] relative">
                    <div className="w-0 h-0 z-20 border-l-[24px] border-l-transparent border-r-[24px] border-r-transparent border-t-[20px] border-t-[#121331] relative">
                      <div className="w-0 h-0 absolute border-l-[18px] border-l-transparent border-r-[18px] border-r-transparent border-t-[15px] border-t-[#2563eb] -top-5 -left-[18px]"></div>
                    </div>
                    <div className="w-[24px] h-9 z-10 absolute top-[9px] left-0 bg-[#3b82f6] border-r-2 border-b-4 border-[#121331] transform skew-y-[39deg]"></div>
                    <div className="w-[25px] h-9 z-10 absolute top-[9px] left-[24px] bg-[#1d4ed8] border-r-4 border-l-2 border-b-4 border-[#121331] transform skew-y-[-39deg]"></div>
                  </div>
                </label>
                <div className="w-6 h-1 flex-shrink-0 bg-[#121331] rounded-full"></div>
              </div>
            </div>
          ),
        },
      ],
    },
    {
      label: "System",
      icon: "settings",
      items: [
        {label:"Backend URL",  description:"API server address",      value:"http://localhost:8000"},
        {label:"API Version",   description:"Backend API version",     value:"v1.0"},
        {label:"App Version",   description:"VeriVision version",      value:"4.2.1"},
      ],
    },
    {
      label: "Inspection",
      icon: "biotech",
      items: [
        {label:"Default Threshold",    description:"Confidence threshold for verdicts", value:"70%"},
        {label:"Frame Rate Target",    description:"Target FPS for live inspection",    value:"30 FPS"},
        {label:"Max Concurrent Runs",  description:"Parallel inspections allowed",      value:"3"},
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {sections.map(section => (
        <div key={section.label}>
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-[16px]" style={{color:"var(--clr-text-muted)"}}>{section.icon}</span>
            <h3 className="text-[11px] font-bold uppercase tracking-wider" style={{color:"var(--clr-text-muted)"}}>{section.label}</h3>
          </div>
          <div className="vv-card divide-y" style={{divideColor:"var(--clr-border)"}}>
            {section.items.map(item => (
              <div key={item.label} className="flex items-center justify-between px-4 py-3" style={{borderBottom:"1px solid var(--clr-border)"}}>
                <div>
                  <p className="text-sm font-medium" style={{color:"var(--clr-text)"}}>{item.label}</p>
                  <p className="text-xs mt-0.5" style={{color:"var(--clr-text-muted)"}}>{item.description}</p>
                </div>
                <div>
                  {item.control || (
                    <span className="text-xs font-mono px-2 py-1 rounded" style={{background:"var(--clr-surface-mid)", color:"var(--clr-text-sub)"}}>{item.value}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Help Panel Content ───────────────────────────────────────────────────────
function HelpContent() {
  const faqs = [
    {q:"How do I run a live inspection?", a:"Navigate to Live Inspection, select a trained model, start your camera or upload an image, then click 'Capture & Inspect'."},
    {q:"How do I train a new model?", a:"Go to Datasets to upload your labeled dataset (.zip), then go to Training, configure the hyperparameters, and click 'Initialize Training'."},
    {q:"What image formats are supported?", a:"JPEG, PNG, BMP, and TIFF are supported for inspection. Datasets should be uploaded as .zip files."},
    {q:"How do I interpret confidence scores?", a:"A score near 1.0 means the AI is highly confident. Scores above your threshold are marked PASS (OK), below are FAIL (NG)."},
    {q:"Why is my camera not starting?", a:"Ensure you've granted camera permissions in your browser. Try using Chrome or Edge for best compatibility."},
    {q:"How do I export inspection results?", a:"Go to Results page and click 'Export CSV' to download all filtered results as a CSV file."},
  ];

  return (
    <div className="space-y-4">
      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          {icon:"school",         label:"Documentation",  href:"#"},
          {icon:"bug_report",     label:"Report Issue",   href:"#"},
          {icon:"chat",           label:"Support Chat",   href:"#"},
          {icon:"code",           label:"API Reference",  href:"#"},
        ].map(link => (
          <a key={link.label} href={link.href}
            className="flex items-center gap-2 p-3 rounded-lg transition-colors vv-surface-low"
            style={{textDecoration:"none"}}
            onMouseEnter={e => e.currentTarget.style.background="var(--clr-surface-mid)"}
            onMouseLeave={e => e.currentTarget.style.background=""}
          >
            <span className="material-symbols-outlined text-[18px]" style={{color:"var(--clr-accent)"}}>{link.icon}</span>
            <span className="text-sm font-medium" style={{color:"var(--clr-text)"}}>{link.label}</span>
          </a>
        ))}
      </div>

      {/* FAQs */}
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{color:"var(--clr-text-muted)"}}>Frequently Asked Questions</h3>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="vv-card p-4">
              <p className="text-sm font-semibold mb-1" style={{color:"var(--clr-text)"}}>{faq.q}</p>
              <p className="text-xs leading-relaxed" style={{color:"var(--clr-text-sub)"}}>{faq.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Version */}
      <p className="text-[11px] text-center pt-2" style={{color:"var(--clr-text-muted)"}}>
        VeriVision v4.2.1 · © 2025 Industrial AI Systems
      </p>
    </div>
  );
}

// ── Main Header ──────────────────────────────────────────────────────────────
export default function Header({onMenuToggle, dark, toggleDark}) {
  const {user, logout} = useAuth();
  const [search,      setSearch]      = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp,     setShowHelp]    = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const router   = useRouter();
  const userMenuRef = useRef(null);

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => {
    setShowUserMenu(false);
    logout();
    router.push("/login");
  };

  const iconBtn = (label, icon, onClick) => (
    <button
      onClick={onClick}
      className="p-2 rounded-full transition-colors flex items-center justify-center"
      style={{color:"var(--clr-text-sub)"}}
      onMouseEnter={e => e.currentTarget.style.background="var(--clr-surface-low)"}
      onMouseLeave={e => e.currentTarget.style.background=""}
      title={label}
    >
      <span className="material-symbols-outlined text-[20px]">{icon}</span>
    </button>
  );

  return (
    <>
      <header
        className="h-14 flex items-center justify-between px-4 sm:px-6 shrink-0 sticky top-0 z-20"
        style={{background:"var(--clr-bg)", borderBottom:"1px solid var(--clr-border)"}}
      >
        {/* Left */}
        <div className="flex items-center gap-3 flex-1">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-1.5 rounded transition-colors"
            style={{color:"var(--clr-text-sub)"}}
            onMouseEnter={e => e.currentTarget.style.background="var(--clr-surface-low)"}
            onMouseLeave={e => e.currentTarget.style.background=""}
          >
            <span className="material-symbols-outlined text-[22px]">menu</span>
          </button>

          {/* Search */}
          <div
            className="hidden sm:flex items-center gap-2 border rounded px-3 py-1.5 w-64 xl:w-80"
            style={{background:"var(--clr-surface)", borderColor:"var(--clr-border)"}}
          >
            <span className="material-symbols-outlined text-[18px]" style={{color:"var(--clr-text-muted)"}}>search</span>
            <input
              type="text" value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search resources..."
              className="bg-transparent border-none outline-none text-sm w-full p-0 focus:ring-0"
              style={{color:"var(--clr-text)"}}
            />
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1">
          {/* Dark mode */}
          <div className="w-12 h-8 flex items-center justify-center relative cursor-pointer" onClick={toggleDark}>
            <div className={`w-48 aspect-video rounded-xl ${dark ? "bg-[#3a3347]" : "bg-[#ebe6ef]"} border-4 border-[#121331] absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 scale-[0.25] pointer-events-none transition-colors`}>
              <div className="flex h-full w-full px-2 items-center gap-x-2">
                <div className="w-6 h-6 flex-shrink-0 rounded-full border-4 border-[#121331]"></div>
                <div className={`w-full h-10 border-4 border-[#121331] rounded ${dark ? "scale-x-[-1]" : ""} transition-transform`}>
                  <div className="w-full h-full bg-[#3b82f6] relative">
                    <div className="w-0 h-0 z-20 border-l-[24px] border-l-transparent border-r-[24px] border-r-transparent border-t-[20px] border-t-[#121331] relative">
                      <div className="w-0 h-0 absolute border-l-[18px] border-l-transparent border-r-[18px] border-r-transparent border-t-[15px] border-t-[#2563eb] -top-5 -left-[18px]"></div>
                    </div>
                    <div className="w-[24px] h-9 z-10 absolute top-[9px] left-0 bg-[#3b82f6] border-r-2 border-b-4 border-[#121331] transform skew-y-[39deg]"></div>
                    <div className="w-[25px] h-9 z-10 absolute top-[9px] left-[24px] bg-[#1d4ed8] border-r-4 border-l-2 border-b-4 border-[#121331] transform skew-y-[-39deg]"></div>
                  </div>
                </div>
                <div className="w-6 h-1 flex-shrink-0 bg-[#121331] rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Settings */}
          {iconBtn("System Settings", "settings", () => setShowSettings(true))}

          {/* Help */}
          {iconBtn("Help & Support", "help_center", () => setShowHelp(true))}

          {/* User avatar + dropdown */}
          {user && (
            <div ref={userMenuRef} className="relative ml-2">
              <div
                onClick={() => setShowUserMenu(v => !v)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer transition-transform hover:scale-105 shadow-sm select-none"
                style={{background:"var(--clr-text)", color:"var(--clr-bg)"}}
                title={`Logged in as ${user.username}`}
              >
                {user.username?.substring(0,2).toUpperCase()}
              </div>

              {/* Dropdown */}
              {showUserMenu && (
                <div
                  className="absolute right-0 top-10 w-52 rounded-xl overflow-hidden animate-slide-right shadow-xl z-50"
                  style={{background:"var(--clr-surface)", border:"1px solid var(--clr-border)"}}
                >
                  {/* Profile header */}
                  <div className="px-4 py-3" style={{borderBottom:"1px solid var(--clr-border)", background:"var(--clr-surface-low)"}}>
                    <p className="text-sm font-semibold" style={{color:"var(--clr-text)"}}>{user.username}</p>
                    <p className="text-xs capitalize mt-0.5" style={{color:"var(--clr-text-muted)"}}>
                      {user.role || "Operator"} · VeriVision
                    </p>
                  </div>

                  {/* Menu items */}
                  {[
                    {icon:"person",   label:"Profile",   action:() => { setShowUserMenu(false); setShowSettings(true); }},
                    {icon:"settings", label:"Settings",  action:() => { setShowUserMenu(false); setShowSettings(true); }},
                    {icon:"help",     label:"Help",      action:() => { setShowUserMenu(false); setShowHelp(true); }},
                  ].map(item => (
                    <button key={item.label} onClick={item.action}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                      style={{color:"var(--clr-text-sub)", background:"transparent", border:"none", textAlign:"left", cursor:"pointer"}}
                      onMouseEnter={e => e.currentTarget.style.background="var(--clr-surface-low)"}
                      onMouseLeave={e => e.currentTarget.style.background=""}
                    >
                      <span className="material-symbols-outlined text-[17px]">{item.icon}</span>
                      {item.label}
                    </button>
                  ))}

                  {/* Logout */}
                  <div style={{borderTop:"1px solid var(--clr-border)"}}>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                      style={{color:"var(--clr-error)", background:"transparent", border:"none", textAlign:"left", cursor:"pointer"}}
                      onMouseEnter={e => e.currentTarget.style.background="rgba(186,26,26,.07)"}
                      onMouseLeave={e => e.currentTarget.style.background=""}
                    >
                      <span className="material-symbols-outlined text-[17px]">logout</span>
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Modals */}
      {showSettings && (
        <Modal title="System Settings" icon="settings" onClose={() => setShowSettings(false)}>
          <SettingsContent dark={dark} toggleDark={toggleDark} />
        </Modal>
      )}
      {showHelp && (
        <Modal title="Help & Support" icon="help_center" onClose={() => setShowHelp(false)}>
          <HelpContent />
        </Modal>
      )}
    </>
  );
}
