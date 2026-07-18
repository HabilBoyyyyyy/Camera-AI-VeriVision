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
      className="fixed bottom-24 right-6 z-40 animate-fade-in"
      title={`${criticalCount} Critical Alert(s)`}>
      <div className="relative flex items-center gap-2 px-3 py-2 bg-[#ba1a1a] text-white rounded-full shadow-lg hover:bg-[#93000a] transition-colors">
        <span className="material-symbols-outlined text-[18px]">notifications_active</span>
        <span className="text-xs font-bold">{criticalCount} Critical</span>
        {/* Ping effect */}
        <span className="absolute -top-1 -right-1 w-3 h-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-40" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-white opacity-60" />
        </span>
      </div>
    </Link>
  );
}
