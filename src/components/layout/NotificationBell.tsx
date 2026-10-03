"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { relTime, severityColor } from "@/lib/format";
import { useSim } from "@/lib/store";
import { Icon } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/primitives";

export function NotificationBell() {
  const { state, actions } = useSim();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const unread = state.notifications.filter((n) => !n.read).length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) actions.markAllNotificationsRead();
        }}
        className="relative rounded-lg border border-ink-700 p-2 text-ink-300 transition hover:border-ink-500 hover:text-ink-100"
        title="Notifications"
      >
        <Icon name="activity" size={16} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-nv-500 px-1 text-[9px] font-bold text-ink-950">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-ink-700 bg-ink-850 shadow-panel">
          <div className="flex items-center justify-between border-b border-ink-700/60 px-3 py-2.5">
            <span className="text-xs font-semibold text-ink-100">Notifications</span>
            {state.notifications.length > 0 && (
              <button
                type="button"
                onClick={actions.clearNotifications}
                className="text-[11px] text-ink-400 hover:text-nv-300"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {state.notifications.length === 0 ? (
              <div className="p-3">
                <EmptyState title="No notifications" hint="Live fleet events will appear here." />
              </div>
            ) : (
              state.notifications.map((n) => {
                const color = severityColor(n.severity);
                const cluster = n.clusterId ? state.clusters.find((c) => c.id === n.clusterId) : undefined;
                const href = n.alertId
                  ? cluster
                    ? `/clusters/${cluster.id}/alerts`
                    : "/alerts"
                  : cluster
                    ? `/clusters/${cluster.id}`
                    : "/activity";
                return (
                  <Link
                    key={n.id}
                    href={href}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 border-b border-ink-800/50 px-3 py-2.5 transition hover:bg-ink-800/40"
                  >
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-ink-200">{n.title}</p>
                      <p className="line-clamp-2 text-[11px] text-ink-500">{n.message}</p>
                      <p className="mt-0.5 text-[10px] text-ink-600">
                        {cluster ? `${cluster.name} · ` : ""}
                        {n.source} · {relTime(n.t)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        actions.dismissNotification(n.id);
                      }}
                      className="shrink-0 rounded p-1 text-ink-600 hover:text-ink-300"
                    >
                      <Icon name="close" size={12} />
                    </button>
                  </Link>
                );
              })
            )}
          </div>
          <Link
            href="/activity"
            onClick={() => setOpen(false)}
            className={cn("block px-3 py-2.5 text-center text-[11px] text-nv-300 hover:bg-ink-800/40")}
          >
            View all activity →
          </Link>
        </div>
      )}
    </div>
  );
}
