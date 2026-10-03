"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { capturePageview, initAnalytics } from "@/lib/analytics";

/**
 * Initialises PostHog once on mount and emits a manual `$pageview` on every
 * App Router navigation (the SDK's automatic pageview is disabled so we can
 * attribute route segments consistently).
 */
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    if (!pathname || lastPath.current === pathname) return;
    lastPath.current = pathname;
    capturePageview(pathname, {
      route_type: pathname.startsWith("/clusters/") ? "cluster_detail" : "page",
    });
  }, [pathname]);

  return <>{children}</>;
}
