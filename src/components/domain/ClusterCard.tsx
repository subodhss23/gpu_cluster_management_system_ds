"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Sparkline } from "@/components/charts/charts";
import { GpuBadge, HealthBadge } from "@/components/ui/domain";
import { Icon } from "@/components/ui/icons";
import { Badge, ProgressBar } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { compactUsd, num, pct } from "@/lib/format";
import { useSim } from "@/lib/store";
import type { Cluster } from "@/lib/types";

export function ClusterCard({ cluster }: { cluster: Cluster }) {
  const { state, actions } = useSim();
  const region = state.regions.find((r) => r.id === cluster.regionId);
  const jobs = useMemo(
    () => state.jobs.filter((j) => j.clusterId === cluster.id),
    [state.jobs, cluster.id]
  );
  const alerts = state.alerts.filter((a) => a.clusterId === cluster.id && a.state === "active");
  const history = state.history[cluster.id] ?? [];
  const utilSeries = history.map((h) => h.gpuUtil * 100);

  return (
    <Link
      href={`/clusters/${cluster.id}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-ink-850/70 p-4 shadow-panel transition-all hover:border-nv-500/40 hover:shadow-glow",
        cluster.pinned ? "border-nv-500/40" : "border-ink-700/80"
      )}
    >
      <button
        type="button"
        title={cluster.pinned ? "Unpin cluster" : "Pin cluster"}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          actions.togglePin(cluster.id);
        }}
        className={cn(
          "absolute right-2.5 top-2.5 z-10 rounded-md p-1 transition",
          cluster.pinned ? "text-vol-amber" : "text-ink-600 opacity-0 hover:text-ink-300 group-hover:opacity-100"
        )}
      >
        <Icon name="pin" size={14} />
      </button>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-ink-100 group-hover:text-nv-200">
              {cluster.name}
            </span>
            <Badge tone="neutral">{cluster.kind}</Badge>
          </div>
          <p className="mt-0.5 truncate text-xs text-ink-500">
            {region?.city ?? cluster.regionId} · {cluster.zone}
          </p>
        </div>
        <HealthBadge status={cluster.status === "provisioning" ? "provisioning" : cluster.health} />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <GpuBadge gpuModelId={cluster.gpuModelId} count={cluster.gpuCount} />
        <span className="text-[11px] text-ink-500">{num(cluster.nodeCount)} nodes</span>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[11px]">
          <span className="text-ink-400">GPU utilization</span>
          <span className="font-mono text-ink-200">{pct(cluster.utilization, 1)}</span>
        </div>
        <ProgressBar value={cluster.utilization} />
      </div>

      <div className="mt-3 h-9">
        {utilSeries.length > 1 && (
          <Sparkline data={utilSeries} color={cluster.health === "healthy" ? "#76b900" : "#f59e0b"} height={36} />
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-ink-700/50 pt-3 text-[11px]">
        <span className="flex items-center gap-1.5 text-ink-400">
          <Icon name="jobs" size={12} className="text-vol-teal" />
          {jobs.filter((j) => j.state === "running").length} run
        </span>
        <span className="flex items-center gap-1.5 text-ink-400">
          <Icon name="clock" size={12} className="text-vol-amber" />
          {jobs.filter((j) => j.state === "pending").length} pend
        </span>
        <span className="flex items-center gap-1.5 text-ink-400">
          <Icon name="dollar" size={12} className="text-nv-300" />
          {compactUsd(cluster.costPerHour)}/h
        </span>
      </div>
      {alerts.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-vol-amber">
          <Icon name="alert" size={12} />
          {alerts.length} active alert{alerts.length > 1 ? "s" : ""}
        </div>
      )}
    </Link>
  );
}
