"use client";

import {useState} from "react";
import {useRouter, usePathname} from "next/navigation";
import {AuthProvider, useAuth} from "@/lib/AuthContext";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import FloatingAlertBadge from "@/components/FloatingAlertBadge";
import FloatingChatbot from "@/components/FloatingChatbot";
import "./globals.css";
import {useEffect} from "react";

function AppShell({children}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {user, loading} = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user && pathname !== "/login") {
      router.push("/login");
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#14171c]">
        <div className="animate-pulse text-[#5a6270] text-sm font-bold tracking-widest uppercase font-mono">
          Loading...
        </div>
      </div>
    );
  }

  if (pathname === "/login") {
    return <>{children}</>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden relative">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden relative bg-[#14171c]">
        <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto p-5 lg:p-8 pb-24 relative">
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <title>VeriVision — AI Visual Inspection</title>
        <meta
          name="description"
          content="AI-powered visual inspection platform for quality control"
        />
      </head>
      <body className="bg-[#14171c] text-[#c4c9d1] min-h-screen">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
