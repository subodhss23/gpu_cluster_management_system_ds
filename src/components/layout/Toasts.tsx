"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { severityColor } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";
import { useSim } from "@/lib/store";
import { Icon } from "@/components/ui/icons";

const AUTO_DISMISS_MS = 9000;

export function Toasts() {
  const { state, actions } = useSim();
  const { prefs } = usePrefs();
  const router = useRouter();
  const [, force] = useState(0);
  const mountedAt = useRef<Record<string, number>>({});

  // Track mount times so toasts auto-expire.
  useEffect(() => {
    const now = Date.now();
    for (const n of state.notifications) {
      if (!mountedAt.current[n.id]) mountedAt.current[n.id] = now;
    }
  }, [state.notifications]);

  useEffect(() => {
    const t = window.setInterval(() => {
      const now = Date.now();
      for (const n of state.notifications) {
        const at = mountedAt.current[n.id] ?? now;
        if (now - at > AUTO_DISMISS_MS) {
          actions.dismissNotification(n.id);
        }
      }
      force((x) => x + 1);
    }, 1000);
    return () => window.clearInterval(t);
  }, [state.notifications, actions]);

  const visible = prefs.showToasts ? state.notifications.slice(0, 3) : [];
  if (visible.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-20 flex w-[min(340px,calc(100vw-2rem))] flex-col gap-2">
      {visible.map((n) => {
        const cluster = n.clusterId ? state.clusters.find((c) => c.id === n.clusterId) : undefined;
        const color = severityColor(n.severity);
        return (
          <div
            key={n.id}
            className={cn(
              "pointer-events-auto relative overflow-hidden rounded-xl border bg-ink-850/95 p-3 shadow-panel backdrop-blur transition-all",
              "animate-[floaty_0.001s_ease-out]"
            )}
            style={{ borderColor: `${color}55` }}
          >
            <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color }} />
            <div className="flex items-start gap-3 pl-1.5">
              <span
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${color}1a`, color }}
              >
                <Icon name={n.severity === "critical" ? "alert" : n.severity === "warning" ? "alert" : "activity"} size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-ink-100">{n.title}</p>
                <p className="line-clamp-2 text-[11px] text-ink-400">{n.message}</p>
                {cluster && <p className="mt-0.5 truncate text-[10px] text-ink-500">{cluster.name}</p>}
              </div>
              <button
                type="button"
                onClick={() => actions.dismissNotification(n.id)}
                className="shrink-0 rounded p-1 text-ink-500 transition hover:text-ink-200"
                title="Dismiss"
              >
                <Icon name="close" size={13} />
              </button>
            </div>
            {(n.alertId || n.clusterId) && (
              <button
                type="button"
                onClick={() => {
                  if (n.alertId) {
                    router.push(cluster ? `/clusters/${cluster.id}/alerts` : "/alerts");
                  } else if (n.clusterId) {
                    router.push(`/clusters/${n.clusterId}`);
                  }
                  actions.dismissNotification(n.id);
                }}
                className="mt-2 text-[10px] font-medium text-nv-300 hover:underline"
              >
                {n.alertId ? "Open alert center →" : "Open cluster →"}
              </button>
            )}
          </div>
        );
      })}
      {state.notifications.length > 1 && (
        <button
          type="button"
          onClick={actions.clearNotifications}
          className="pointer-events-auto self-end rounded-lg border border-ink-700 bg-ink-900/80 px-2.5 py-1 text-[10px] text-ink-400 hover:border-ink-500 hover:text-ink-200"
        >
          Clear all ({state.notifications.length})
        </button>
      )}
    </div>
  );
}
