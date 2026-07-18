"use client";

import {useState, useEffect} from "react";
import {useRouter, usePathname} from "next/navigation";
import {AuthProvider, useAuth} from "@/lib/AuthContext";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import FloatingChatbot from "@/components/FloatingChatbot";
import FloatingAlertBadge from "@/components/FloatingAlertBadge";
import "./globals.css";

// ── Dark mode provider ─────────────────────────────────────────
function ThemeProvider({children}) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("vv-theme");
    if (saved === "dark") { setDark(true); document.documentElement.setAttribute("data-theme", "dark"); }
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "");
    localStorage.setItem("vv-theme", next ? "dark" : "light");
  };

  return children(dark, toggle);
}

function AppShell({children, dark, toggleDark}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {user, loading} = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user && pathname !== "/login") router.push("/login");
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{background:"var(--clr-bg)"}}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--clr-border)] border-t-[var(--clr-accent)] rounded-full animate-spin" />
          <span className="text-xs uppercase tracking-widest font-semibold" style={{color:"var(--clr-text-muted)"}}>Loading…</span>
        </div>
      </div>
    );
  }

  if (pathname === "/login") return <>{children}</>;
  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden" style={{background:"var(--clr-bg)"}}>
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-[216px]">
        <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} dark={dark} toggleDark={toggleDark} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 relative">
          {children}
        </main>
      </div>

      <FloatingChatbot />
      <FloatingAlertBadge />
    </div>
  );
}

export default function RootLayout({children}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@400,0&display=swap" rel="stylesheet" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <title>VERIVISION — Industrial AI Platform</title>
        <meta name="description" content="Industrial AI-powered visual inspection for quality control" />
      </head>
      <body style={{background:"var(--clr-bg)", color:"var(--clr-text)", minHeight:"100vh"}}>
        <AuthProvider>
          <ThemeProvider>
            {(dark, toggleDark) => (
              <AppShell dark={dark} toggleDark={toggleDark}>
                {children}
              </AppShell>
            )}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
