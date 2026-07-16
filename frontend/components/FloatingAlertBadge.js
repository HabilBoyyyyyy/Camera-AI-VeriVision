"use client";

import {useState, useEffect} from "react";
import Link from "next/link";
import {fetchAlerts} from "@/lib/api";
import {usePathname} from "next/navigation";

export default function FloatingAlertBadge() {
  const [criticalCount, setCriticalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    let isMounted = true;

    const loadCount = async () => {
      try {
        const data = await fetchAlerts();
        if (isMounted && data?.alerts) {
          const count = data.alerts.filter(
            (a) => a.severity === "critical",
          ).length;
          setCriticalCount(count);
        }
      } catch (e) {
        console.error("Failed to fetch alerts for badge", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadCount();

    // Poll every 60 seconds to keep the badge up to date
    const intervalId = setInterval(loadCount, 60000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [pathname]); // Re-fetch on navigation as well

  if (loading || criticalCount === 0) return null;

  return (
    <Link
      href="/alerts"
      className="fixed bottom-6 right-6 z-50 group flex items-center justify-center animate-fade-in"
      title={`${criticalCount} Critical Alert(s) Today`}>
      <div className="relative flex items-center justify-center w-14 h-14 rounded-full bg-[#0a1122] border border-slate-700/80 shadow-[0_0_20px_rgba(239,68,68,0.2)] hover:scale-110 transition-transform duration-300">
        {/* Floating Logo - using the same logo.png from public */}
        <img
          src="/logo.png"
          alt="Alert Logo"
          className="w-8 h-8 object-contain drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]"
        />

        {/* Red Dot & Count */}
        <div className="absolute -top-1 -right-1 flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold border-[3px] border-[#040812] shadow-sm shadow-red-500/50 animate-bounce">
          {criticalCount}
        </div>

        {/* Radar Ping Effect */}
        <div className="absolute inset-0 rounded-full border-2 border-red-500/50 animate-ping -z-10" />
      </div>
    </Link>
  );
}
