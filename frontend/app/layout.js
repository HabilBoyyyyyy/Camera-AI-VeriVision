"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import "./globals.css";
import { useEffect } from "react";

function AppShell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user && pathname !== "/login") {
      router.push("/login");
    }
  }, [user, loading, pathname, router]);

  // Show nothing while checking auth
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#040812]">
        <div className="animate-pulse text-slate-500 text-sm font-bold tracking-widest uppercase">Loading...</div>
      </div>
    );
  }

  // If on login page, render children directly
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // If not authenticated (and not on login page), don't render anything while useEffect redirects
  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden relative">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden relative bg-[#040812]">
        <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto p-5 lg:p-8 pb-24 relative">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <title>VeriVision — AI Visual Inspection</title>
        <meta name="description" content="AI-powered visual inspection platform for quality control" />
      </head>
      <body className="bg-[#040812] text-slate-300 min-h-screen">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
