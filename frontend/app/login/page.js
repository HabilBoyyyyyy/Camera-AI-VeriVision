"use client";

import {useState, useEffect} from "react";
import {useRouter} from "next/navigation";
import {useAuth} from "@/lib/AuthContext";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [busy,     setBusy]     = useState(false);
  const [showPw,   setShowPw]   = useState(false);
  const [dark,     setDark]     = useState(false);

  const {user, loading, login} = useAuth();
  const router = useRouter();

  // Read persisted theme
  useEffect(() => {
    const saved = localStorage.getItem("vv-theme");
    const isDark = saved === "dark";
    setDark(isDark);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "");
  }, []);

  useEffect(() => { if (!loading && user) router.replace("/"); }, [user, loading, router]);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "");
    localStorage.setItem("vv-theme", next ? "dark" : "light");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(username, password);
      router.push("/");
    } catch (err) {
      setError(err.message || "Login failed. Check credentials.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{background: dark ? "#060d1a" : "#f0f6ff"}}>
      <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{borderColor:"rgba(56,139,253,0.3)", borderTopColor:"#388bfd"}} />
    </div>
  );
  if (user) return null;

  /* ── Colours change with theme ── */
  const bg         = dark ? "#060d1a" : "#f0f6ff";
  const cardBg     = dark ? "rgba(13,20,40,0.88)" : "rgba(255,255,255,0.97)";
  const cardBorder = dark ? "rgba(56,139,253,0.18)" : "rgba(56,139,253,0.22)";
  const cardShadow = dark
    ? "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(56,139,253,0.08)"
    : "0 24px 64px rgba(0,100,200,0.12), 0 0 0 1px rgba(56,139,253,0.06)";
  const titleColor  = dark ? "#e6edf3" : "#131b2e";
  const subColor    = dark ? "rgba(148,163,184,0.85)" : "#505f76";
  const labelColor  = dark ? "#64748b" : "#76777d";
  const inputBg     = dark ? "rgba(6,12,26,0.65)" : "rgba(240,246,255,0.8)";
  const inputColor  = dark ? "#e2e8f0" : "#131b2e";
  const inputBorder = dark ? "rgba(56,139,253,0.2)" : "rgba(56,139,253,0.25)";
  const hintColor   = dark ? "#94a3b8" : "#505f76";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 relative transition-colors duration-300"
      style={{
        backgroundColor: bg,
        backgroundImage: dark
          ? `linear-gradient(rgba(56,139,253,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(56,139,253,.05) 1px, transparent 1px)`
          : `linear-gradient(rgba(56,139,253,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(56,139,253,.04) 1px, transparent 1px)`,
        backgroundSize: "80px 80px",
      }}
    >
      {/* Theme toggle (top-right) */}
      <div className="absolute top-4 right-4">
        <button
          onClick={toggleDark}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200"
          style={{
            border: `1px solid ${dark ? "rgba(255,255,255,0.12)" : "rgba(56,139,253,0.2)"}`,
            background: dark ? "rgba(255,255,255,0.06)" : "rgba(56,139,253,0.06)",
            color: dark ? "#93c5fd" : "#388bfd",
          }}
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
          onMouseEnter={e => e.currentTarget.style.opacity="0.8"}
          onMouseLeave={e => e.currentTarget.style.opacity="1"}
        >
          <span className="material-symbols-outlined text-[18px]">{dark ? "light_mode" : "dark_mode"}</span>
        </button>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-sm animate-fade-in"
        style={{
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          borderRadius: "14px",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          boxShadow: cardShadow,
          padding: "40px 32px 32px",
        }}
      >
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          {/* Logo */}
          <div className="mb-4 relative">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center p-2"
              style={{
                background: dark ? "rgba(56,139,253,0.08)" : "rgba(56,139,253,0.06)",
                border: `1px solid ${dark ? "rgba(56,139,253,0.18)" : "rgba(56,139,253,0.15)"}`,
                boxShadow: dark ? "0 0 32px rgba(56,139,253,0.12)" : "0 4px 24px rgba(56,139,253,0.1)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="VeriVision Logo"
                className="w-full h-full object-contain"
                style={{ filter: dark ? "brightness(1) drop-shadow(0 0 8px rgba(56,139,253,0.4))" : "none" }}
              />
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-[0.18em] mb-1" style={{color: titleColor}}>
            VERIVISION
          </h1>
          <p className="text-sm text-center" style={{color: subColor}}>
            Industrial AI Platform · Secure Access Required
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Operator ID */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] mb-1.5" style={{color: labelColor}}>
              Operator ID
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px]" style={{color: dark ? "#475569" : "#94a3b8"}}>
                badge
              </span>
              <input
                type="text"
                placeholder="Enter your operator ID"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required autoFocus
                style={{
                  background: inputBg,
                  border: `1px solid ${inputBorder}`,
                  borderRadius: "8px",
                  padding: "12px 14px 12px 40px",
                  color: inputColor,
                  fontSize: "14px",
                  outline: "none",
                  width: "100%",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onFocus={e => {
                  e.target.style.borderColor = "rgba(56,139,253,0.7)";
                  e.target.style.boxShadow   = "0 0 0 3px rgba(56,139,253,0.12)";
                }}
                onBlur={e => {
                  e.target.style.borderColor = inputBorder;
                  e.target.style.boxShadow   = "none";
                }}
              />
            </div>
          </div>

          {/* Access Key */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] mb-1.5" style={{color: labelColor}}>
              Access Key
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px]" style={{color: dark ? "#475569" : "#94a3b8"}}>
                key
              </span>
              <input
                type={showPw ? "text" : "password"}
                placeholder="Enter secure access key"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{
                  background: inputBg,
                  border: `1px solid ${inputBorder}`,
                  borderRadius: "8px",
                  padding: "12px 44px 12px 40px",
                  color: inputColor,
                  fontSize: "14px",
                  outline: "none",
                  width: "100%",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onFocus={e => {
                  e.target.style.borderColor = "rgba(56,139,253,0.7)";
                  e.target.style.boxShadow   = "0 0 0 3px rgba(56,139,253,0.12)";
                }}
                onBlur={e => {
                  e.target.style.borderColor = inputBorder;
                  e.target.style.boxShadow   = "none";
                }}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{color: dark ? "#475569" : "#94a3b8"}}
                tabIndex={-1}
              >
                <span className="material-symbols-outlined text-[18px]">{showPw ? "visibility_off" : "visibility"}</span>
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm"
              style={{background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.25)", color:"#fca5a5"}}>
              <span className="material-symbols-outlined text-[16px]">error</span>
              {error}
            </div>
          )}

          {/* Remember + Support */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{color: labelColor}}>
              <input type="checkbox" style={{width:"15px", height:"15px", accentColor:"#388bfd"}} />
              Keep session active
            </label>
            <button type="button" className="text-sm hover:underline" style={{color:"#388bfd", background:"none", border:"none", cursor:"pointer"}}>
              Request Support
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all"
            style={{
              background: busy ? "rgba(56,139,253,0.5)" : "rgba(56,139,253,0.9)",
              color: "#fff",
              border: "1px solid rgba(56,139,253,0.4)",
              fontSize: "13px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: busy ? "not-allowed" : "pointer",
              boxShadow: busy ? "none" : "0 4px 16px rgba(56,139,253,0.3)",
            }}
            onMouseEnter={e => { if (!busy) e.currentTarget.style.background = "rgba(56,139,253,1)"; }}
            onMouseLeave={e => { if (!busy) e.currentTarget.style.background = "rgba(56,139,253,0.9)"; }}
          >
            {busy ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Authenticating…
              </>
            ) : (
              <>
                Initialize Session
                <span className="material-symbols-outlined text-[18px]">login</span>
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 pt-5" style={{borderTop:`1px solid ${dark ? "rgba(56,139,253,0.1)" : "rgba(56,139,253,0.12)"}`}}>
          <p className="text-[11px] text-center mb-4" style={{color: dark ? "#475569" : "#94a3b8"}}>
            Default:{" "}
            <span className="font-mono" style={{color: hintColor}}>admin / admin123</span>
            {" "}or{" "}
            <span className="font-mono" style={{color: hintColor}}>inspector / inspect123</span>
          </p>
          <div className="flex items-center justify-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-[11px]" style={{color: dark ? "#475569" : "#94a3b8"}}>System Online — V.4.2.1</span>
          </div>
        </div>
      </div>
    </div>
  );
}
