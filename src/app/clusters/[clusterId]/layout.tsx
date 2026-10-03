"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useMemo } from "react";
import { GpuBadge, HealthBadge } from "@/components/ui/domain";
import { Icon } from "@/components/ui/icons";
import { Badge, EmptyState, ProgressBar } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { compact, compactUsd, pct } from "@/lib/format";
import { clusterAggregate } from "@/lib/selectors";
import { useSim } from "@/lib/store";

export default function ClusterLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ clusterId: string }>();
  const pathname = usePathname();
  const { state } = useSim();
  const clusterId = params.clusterId;
  const cluster = state.clusters.find((c) => c.id === clusterId);
  const agg = useMemo(() => (cluster ? clusterAggregate(state, cluster) : null), [state, cluster]);

  if (!cluster || !agg) {
    return (
      <div className="p-7">
        <EmptyState title="Cluster not found" hint="It may have been decommissioned." />
        <div className="mt-4">
          <Link href="/clusters" className="text-sm text-nv-300 hover:underline">
            ← Back to fleet
          </Link>
        </div>
      </div>
    );
  }

  const tabs = [
    { href: `/clusters/${clusterId}`, label: "Overview", icon: "dashboard" },
    { href: `/clusters/${clusterId}/nodes`, label: "Nodes & GPUs", icon: "server" },
    { href: `/clusters/${clusterId}/jobs`, label: "Workloads", icon: "jobs" },
    { href: `/clusters/${clusterId}/storage`, label: "Storage & Fabric", icon: "storage" },
    { href: `/clusters/${clusterId}/alerts`, label: "Alerts", icon: "alert" },
    { href: `/clusters/${clusterId}/settings`, label: "Settings", icon: "settings" },
  ];

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-5 lg:p-7">
      <div className="flex flex-col gap-4 border-b border-ink-800 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <nav className="mb-1.5 flex items-center gap-1.5 text-xs text-ink-500">
              <Link href="/" className="hover:text-ink-300">Mission Control</Link>
              <Icon name="chevron" size={12} className="text-ink-600" />
              <Link href="/clusters" className="hover:text-ink-300">Fleet</Link>
              <Icon name="chevron" size={12} className="text-ink-600" />
              <span className="text-ink-300">{cluster.name}</span>
            </nav>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight text-ink-100">{cluster.name}</h1>
              <HealthBadge status={cluster.status === "provisioning" ? "provisioning" : cluster.health} />
              <Badge tone="neutral">{cluster.kind}</Badge>
              <GpuBadge gpuModelId={cluster.gpuModelId} count={cluster.gpuCount} />
            </div>
            <p className="mt-1 text-sm text-ink-400">
              <Link href={`/regions/${cluster.regionId}`} className="text-nv-300 hover:underline">
                {cluster.regionId}
              </Link>{" "}
              · {cluster.zone} · {cluster.orchestrator} · {cluster.fabric} · {compact(cluster.nodeCount)} nodes · SLA{" "}
              {cluster.sla}%
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="GPU util" value={pct(cluster.utilization, 1)} color="#76b900" />
            <MiniStat label="Running" value={String(agg.running)} color="#a855f7" />
            <MiniStat label="Alerts" value={String(agg.alerts.filter((a) => a.state === "active").length)} color="#f59e0b" />
            <MiniStat label="Cost/h" value={compactUsd(cluster.costPerHour)} color="#10b981" />
          </div>
        </div>
        {cluster.status === "provisioning" && (
          <div className="rounded-lg border border-vol-teal/30 bg-vol-teal/5 p-3">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-vol-teal">Provisioning in progress — bare-metal imaging and driver install</span>
              <span className="font-mono text-vol-teal">{cluster.provisionProgress.toFixed(0)}%</span>
            </div>
            <ProgressBar value={cluster.provisionProgress / 100} color="#22d3ee" />
          </div>
        )}
        <nav className="flex flex-wrap gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const active = t.href === `/clusters/${clusterId}` ? pathname === t.href : pathname.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors",
                  active ? "bg-nv-500/12 text-nv-200" : "text-ink-400 hover:bg-ink-800 hover:text-ink-200"
                )}
              >
                <Icon name={t.icon} size={14} className={active ? "text-nv-300" : "text-ink-500"} />
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-ink-700/70 bg-ink-900/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-ink-500">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-semibold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}
