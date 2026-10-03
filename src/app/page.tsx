"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AreaChart, Donut, HBar, LineChart, RadialGauge } from "@/components/charts/charts";
import { WorldMap, type MapMarker } from "@/components/charts/WorldMap";
import { ClusterCard } from "@/components/domain/ClusterCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { HealthBadge, SeverityBadge } from "@/components/ui/domain";
import { Icon } from "@/components/ui/icons";
import { Badge, Button, Panel, StatTile } from "@/components/ui/primitives";
import { compact, compactUsd, num, pct, relTime } from "@/lib/format";
import { fleetKpis, regionKpis } from "@/lib/selectors";
import { useSim } from "@/lib/store";

export default function MissionControlPage() {
  const { state, actions } = useSim();
  const kpis = useMemo(() => fleetKpis(state), [state]);

  const markers: MapMarker[] = useMemo(
    () =>
      state.regions.map((r) => {
        const rk = regionKpis(state, r.id);
        const health = rk.clusters.some((c) => c.health === "critical")
          ? "critical"
          : rk.clusters.some((c) => c.health === "warning" || c.status === "degraded")
            ? "warning"
            : rk.clusters.some((c) => c.status === "provisioning")
              ? "provisioning"
              : "healthy";
        return {
          id: r.id,
          name: r.name,
          city: r.city,
          lat: r.lat,
          lng: r.lng,
          gpuCount: rk.totalGpus,
          utilization: rk.utilization,
          health,
          clusters: rk.clusters.length,
        };
      }),
    [state]
  );

  const gpuUtilSeries = state.globalHistory.map((h) => h.gpuUtil * 100);
  const powerSeries = state.globalHistory.map((h) => h.powerKw);
  const netSeries = state.globalHistory.map((h) => h.netGbps / 1000);

  const gpuComposition = useMemo(() => {
    const colors = ["#76b900", "#22d3ee", "#a855f7", "#f59e0b", "#3b82f6", "#f43f5e"];
    const map = new Map<string, number>();
    for (const c of state.clusters) map.set(c.gpuModelId, (map.get(c.gpuModelId) ?? 0) + c.gpuCount);
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id, value], i) => ({
        label: state.gpuCatalog.find((g) => g.id === id)?.name.replace("NVIDIA ", "") ?? id,
        value,
        color: colors[i % colors.length],
      }));
  }, [state.clusters, state.gpuCatalog]);

  const topAlertClusters = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of state.alerts.filter((a) => a.state === "active")) {
      counts.set(a.clusterId, (counts.get(a.clusterId) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, value], i) => ({
        label: state.clusters.find((c) => c.id === id)?.name ?? id,
        value,
        color: ["#ef4444", "#f59e0b", "#fb923c", "#f43f5e", "#a855f7", "#22d3ee"][i % 6],
        sub: state.clusters.find((c) => c.id === id)?.regionId,
      }));
  }, [state]);

  const recentAlerts = state.alerts.filter((a) => a.state === "active").slice(0, 5);

  const gpuNodes = useMemo(() => state.nodes.filter((n) => n.role === "gpu-worker"), [state.nodes]);
  const allGpus = useMemo(() => gpuNodes.flatMap((n) => n.gpus), [gpuNodes]);
  const peakTemp = useMemo(() => (allGpus.length ? Math.max(...allGpus.map((g) => g.tempC)) : 0), [allGpus]);
  const throttled = useMemo(() => allGpus.filter((g) => g.throttle !== "none").length, [allGpus]);
  const totalFabricBw = useMemo(() => state.fabrics.reduce((s, f) => s + f.bwTbps, 0), [state.fabrics]);
  const degradedClusters = state.clusters.filter((c) => c.status === "degraded").length;

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-5 lg:p-7">
      <PageHeader
        title="Mission Control"
        subtitle="Global control plane for the accelerated fleet — regions, clusters, capacity, power and live workload telemetry."
        actions={
          <>
            <span className="hidden items-center gap-2 rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-1.5 text-xs text-ink-400 sm:flex">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-nv-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-nv-500" />
              </span>
              Live synthetic telemetry
            </span>
            <Button variant="primary" onClick={() => actions.regenerate()}>
              <Icon name="refresh" size={15} /> Resample fleet
            </Button>
            <Link href="/provision">
              <Button>
                <Icon name="plus" size={15} /> Provision
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label="Total GPUs"
          value={compact(kpis.totalGpus)}
          sub={`${compact(kpis.allocatedGpus)} allocated · ${kpis.clusters} clusters`}
          accent="#76b900"
          icon={<Icon name="chip" size={16} />}
        />
        <StatTile
          label="GPU Utilization"
          value={pct(kpis.gpuUtilization, 1)}
          sub={`Fleet-wide across ${kpis.regions} regions`}
          accent="#22d3ee"
          icon={<Icon name="activity" size={16} />}
        />
        <StatTile
          label="Running Jobs"
          value={num(kpis.runningJobs)}
          sub={`${kpis.pendingJobs} queued`}
          accent="#a855f7"
          icon={<Icon name="jobs" size={16} />}
        />
        <StatTile
          label="Active Alerts"
          value={num(kpis.activeAlerts)}
          sub={`${kpis.criticalAlerts} critical`}
          accent={kpis.criticalAlerts > 0 ? "#ef4444" : "#f59e0b"}
          icon={<Icon name="alert" size={16} />}
        />
        <StatTile
          label="Power Draw"
          value={`${(kpis.totalPowerKw / 1000).toFixed(2)} MW`}
          sub={`Fleet PUE-adjusted`}
          accent="#f59e0b"
          icon={<Icon name="power" size={16} />}
        />
        <StatTile
          label="Compute Spend"
          value={`${compactUsd(kpis.costPerHour)}/h`}
          sub={`${compactUsd(kpis.costPerHour * 24 * 30)}/mo est.`}
          accent="#10b981"
          icon={<Icon name="dollar" size={16} />}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <OpsChip
          icon="temp"
          label="Peak GPU temp"
          value={`${peakTemp.toFixed(0)}°C`}
          tone={peakTemp > 85 ? "red" : peakTemp > 75 ? "amber" : "green"}
        />
        <OpsChip
          icon="power"
          label="Throttled GPUs"
          value={num(throttled)}
          tone={throttled > 0 ? "amber" : "green"}
        />
        <OpsChip
          icon="network"
          label="Fabric BW"
          value={`${num(totalFabricBw)} Tbps`}
          tone="cyan"
        />
        <OpsChip
          icon="layers"
          label="Scheduler backlog"
          value={`${num(kpis.pendingJobs)} jobs`}
          tone={kpis.pendingJobs > 40 ? "amber" : "green"}
        />
        <OpsChip
          icon="bolt"
          label="Degraded adapters"
          value={String(degradedClusters)}
          tone={degradedClusters > 0 ? "amber" : "green"}
        />
        <OpsChip
          icon="memory"
          label="HBM allocated"
          value={pct(kpis.avgMemUtilization, 0)}
          tone="violet"
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <Panel
          fill
          className="xl:col-span-2"
          title="Global fleet topology"
          subtitle="Multi-region footprint · node size encodes GPU capacity · arcs show inter-region control traffic"
          actions={<Badge tone="green">{state.regions.length} regions</Badge>}
        >
          <WorldMap markers={markers} />
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {state.regions.map((r) => {
              const rk = regionKpis(state, r.id);
              return (
                <Link
                  key={r.id}
                  href={`/regions/${r.id}`}
                  className="flex items-center gap-3 rounded-lg border border-ink-700/70 bg-ink-900/50 p-3 transition hover:border-nv-500/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-ink-100">{r.city}</span>
                      <span className="font-mono text-[11px] text-ink-400">{r.id}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-ink-500">
                      <span>{compact(rk.totalGpus)} GPUs</span>
                      <span>{rk.clusters.length} clusters</span>
                      <span>{pct(rk.utilization)} util</span>
                    </div>
                  </div>
                  <RadialGauge value={rk.utilization} size={46} thickness={5} color="#76b900" />
                </Link>
              );
            })}
          </div>
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel
            fill
            title="Fleet GPU utilization"
            subtitle="Live 5-minute window"
            actions={<span className="font-mono text-xs text-nv-300">{pct(kpis.gpuUtilization, 1)}</span>}
          >
            <AreaChart data={gpuUtilSeries} yFormat={(v) => `${v.toFixed(0)}%`} color="#76b900" height={200} />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-ink-700/60 bg-ink-900/40 p-3">
                <p className="text-[10px] uppercase tracking-wider text-ink-500">Power</p>
                <p className="mt-1 font-mono text-lg text-ink-100">{(kpis.totalPowerKw / 1000).toFixed(2)} MW</p>
                <AreaChart data={powerSeries} color="#f59e0b" height={44} gridLines={1} />
              </div>
              <div className="rounded-lg border border-ink-700/60 bg-ink-900/40 p-3">
                <p className="text-[10px] uppercase tracking-wider text-ink-500">Fabric</p>
                <p className="mt-1 font-mono text-lg text-ink-100">
                  {netSeries.length ? netSeries[netSeries.length - 1].toFixed(1) : "0"} Tbps
                </p>
                <AreaChart data={netSeries} color="#22d3ee" height={44} gridLines={1} />
              </div>
            </div>
          </Panel>

          <Panel fill title="Accelerator mix" subtitle="Fleet composition by GPU architecture">
            <div className="flex h-full items-center justify-center">
              <Donut segments={gpuComposition} centerLabel="GPUs" centerValue={compact(kpis.totalGpus)} size={130} />
            </div>
          </Panel>
        </div>
      </div>

      <Panel
        title="Cluster fleet"
        subtitle={`${kpis.clusters} clusters · ${kpis.healthyClusters} healthy · ${kpis.degradedClusters} degraded · ${kpis.provisioningClusters} provisioning`}
        actions={
          <Link href="/clusters">
            <Button size="sm" variant="ghost">
              View fleet <Icon name="chevron" size={13} />
            </Button>
          </Link>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {state.clusters.map((c) => (
            <ClusterCard key={c.id} cluster={c} />
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <Panel fill title="Active alerts" subtitle="Most severe unresolved events" className="lg:col-span-2"
          actions={<Link href="/alerts"><Button size="sm" variant="ghost">Alert center <Icon name="chevron" size={13} /></Button></Link>}
        >
          <div className="divide-y divide-ink-700/50">
            {recentAlerts.length === 0 && <p className="py-6 text-center text-sm text-ink-500">No active alerts. Fleet nominal.</p>}
            {recentAlerts.map((a) => (
              <Link
                key={a.id}
                href={`/clusters/${a.clusterId}/alerts`}
                className="flex items-center gap-3 py-3 transition hover:bg-ink-800/40"
              >
                <SeverityBadge severity={a.severity} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink-200">
                    <span className="font-mono text-ink-400">{a.code}</span> · {a.title}
                  </p>
                  <p className="truncate text-xs text-ink-500">
                    {state.clusters.find((c) => c.id === a.clusterId)?.name} · {a.source} · {relTime(a.raisedAt)}
                  </p>
                </div>
                <Badge tone="neutral">{a.state}</Badge>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel fill title="Alert hotspot" subtitle="Active alerts by cluster">
          <div className="flex h-full flex-col justify-center">
            {topAlertClusters.length ? <HBar items={topAlertClusters} /> : <p className="text-sm text-ink-500">All clear.</p>}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Panel fill title="Fleet activity" subtitle="Scheduler, DCGM, autoscaler and operator events">
          <div className="flex max-h-80 flex-col gap-0 overflow-y-auto">
            {state.activity.slice(0, 14).map((e) => (
              <div key={e.id} className="flex items-start gap-3 border-b border-ink-700/40 py-2.5 last:border-0">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: e.severity === "warning" ? "#f59e0b" : "#76b900" }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-ink-300">{e.message}</p>
                  <p className="text-[10px] text-ink-600">
                    {e.actor} · {e.kind} · {relTime(e.t)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel fill title="Capacity & demand" subtitle="Allocated vs available across the fleet">
          <LineChart
            height={200}
            yFormat={(v) => `${v.toFixed(0)}%`}
            series={[
              { name: "GPU allocation", color: "#76b900", data: gpuUtilSeries },
              {
                name: "HBM allocation",
                color: "#22d3ee",
                data: state.globalHistory.map((h) => h.memUtil * 100),
              },
            ]}
          />
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border border-ink-700/60 bg-ink-900/40 p-3">
              <p className="font-mono text-lg text-ink-100">{compact(kpis.allocatedGpus)}</p>
              <p className="text-[10px] uppercase tracking-wider text-ink-500">Allocated</p>
            </div>
            <div className="rounded-lg border border-ink-700/60 bg-ink-900/40 p-3">
              <p className="font-mono text-lg text-ink-100">{compact(kpis.totalGpus - kpis.allocatedGpus)}</p>
              <p className="text-[10px] uppercase tracking-wider text-ink-500">Available</p>
            </div>
            <div className="rounded-lg border border-ink-700/60 bg-ink-900/40 p-3">
              <p className="font-mono text-lg text-nv-300">{pct(kpis.avgMemUtilization)}</p>
              <p className="text-[10px] uppercase tracking-wider text-ink-500">HBM used</p>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function OpsChip({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  tone: "green" | "amber" | "red" | "cyan" | "violet";
}) {
  const colors: Record<string, string> = {
    green: "#76b900",
    amber: "#f59e0b",
    red: "#ef4444",
    cyan: "#22d3ee",
    violet: "#a855f7",
  };
  const color = colors[tone];
  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink-700/80 bg-ink-850/70 p-3 shadow-panel">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}1a`, color }}>
        <Icon name={icon} size={15} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-ink-500">{label}</p>
        <p className="font-mono text-sm font-semibold" style={{ color }}>{value}</p>
      </div>
    </div>
  );
}
