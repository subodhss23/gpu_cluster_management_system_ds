"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { AreaChart, Donut, GpuHeatmap, HBar, RadialGauge, tempColor, utilColor } from "@/components/charts/charts";
import { GpuBadge, HealthBadge, JobStateBadge, SeverityBadge } from "@/components/ui/domain";
import { Icon } from "@/components/ui/icons";
import { Badge, EmptyState, KeyValue, Panel, ProgressBar, StatTile } from "@/components/ui/primitives";
import { GPU_BY_ID } from "@/lib/constants";
import { compact, compactUsd, gb, num, pct, relTime, tb } from "@/lib/format";
import { clusterAggregate, teamById } from "@/lib/selectors";
import { useSim } from "@/lib/store";

export default function ClusterOverviewPage() {
  const params = useParams<{ clusterId: string }>();
  const clusterId = params.clusterId;
  const { state } = useSim();
  const cluster = state.clusters.find((c) => c.id === clusterId);
  const agg = useMemo(() => (cluster ? clusterAggregate(state, cluster) : null), [state, cluster]);

  const gpuNodes = useMemo(
    () => state.nodes.filter((n) => n.clusterId === clusterId && n.role === "gpu-worker"),
    [state.nodes, clusterId]
  );

  const history = state.history[clusterId] ?? [];
  const utilSeries = history.map((h) => h.gpuUtil * 100);
  const memSeries = history.map((h) => h.memUtil * 100);
  const powerSeries = history.map((h) => h.powerKw);
  const racks = state.racks[clusterId] ?? [];
  const blocks = state.topology[clusterId] ?? [];
  const reservations = state.reservations.filter((r) => r.clusterId === clusterId && r.endAt > Date.now() - 3600000);
  const settings = state.settings[clusterId];
  const metering = state.metering[clusterId];
  const peaks = useMemo(() => {
    const gpus = gpuNodes.flatMap((n) => n.gpus);
    return {
      temp: gpus.length ? Math.max(...gpus.map((g) => g.tempC)) : 0,
      throttled: gpus.filter((g) => g.throttle !== "none").length,
      xid: gpus.reduce((s, g) => s + g.xidErrors, 0),
      ecc: gpus.reduce((s, g) => s + g.eccErrors, 0),
    };
  }, [gpuNodes]);

  const heatCells = useMemo(() => {
    const cells: { id: string; label: string; sub: string; value: number; color: string }[] = [];
    for (const node of gpuNodes) {
      node.gpus.forEach((g) => {
        const value = g.utilPct / 100;
        cells.push({
          id: `${node.id}-g${g.index}`,
          label: `${node.hostname} · GPU ${g.index}`,
          sub: `${g.utilPct.toFixed(0)}% · ${g.tempC.toFixed(0)}°C · ${g.memUsedGb.toFixed(0)}/${g.memTotalGb}GB`,
          value,
          color: node.status === "critical" ? "#ef4444" : node.status === "warning" && g.throttle !== "none" ? tempColor(g.tempC) : utilColor(value),
        });
      });
    }
    return cells;
  }, [gpuNodes]);

  const teamJobs = useMemo(() => {
    const map = new Map<string, { gpus: number }>();
    for (const j of agg?.jobs ?? []) {
      if (j.state !== "running" && j.state !== "pending") continue;
      const prev = map.get(j.teamId) ?? { gpus: 0 };
      prev.gpus += j.gpusRequested;
      map.set(j.teamId, prev);
    }
    return state.teams
      .map((t, i) => ({
        label: t.name,
        value: map.get(t.id)?.gpus ?? 0,
        color: t.color,
        sub: `${map.get(t.id)?.gpus ?? 0} GPUs · ${pct((map.get(t.id)?.gpus ?? 0) / Math.max(1, t.quota.gpuLimit))} of quota`,
      }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [agg, state.teams]);

  if (!cluster || !agg) {
    return <EmptyState title="Cluster not found" />;
  }

  const spec = GPU_BY_ID[cluster.gpuModelId];
  const onlineNodes = gpuNodes.filter((n) => n.status !== "offline").length;
  const gpusAtWork = gpuNodes.reduce(
    (s, n) => s + n.gpus.filter((g) => g.utilPct > 10).length,
    0
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="GPU utilization" value={pct(cluster.utilization, 1)} accent="#76b900" icon={<Icon name="activity" size={16} />} sub={`${num(gpusAtWork)} GPUs active`} />
        <StatTile label="HBM utilization" value={pct(cluster.memUtilization, 1)} accent="#22d3ee" icon={<Icon name="memory" size={16} />} sub={`${gb(cluster.memGbPerNode * gpuNodes.length)} node RAM`} />
        <StatTile label="Power draw" value={`${(cluster.powerKw * (0.55 + cluster.utilization * 0.45)).toFixed(1)} kW`} accent="#f59e0b" icon={<Icon name="power" size={16} />} sub={`${cluster.powerKw.toFixed(0)} kW budget`} />
        <StatTile label="Nodes online" value={`${onlineNodes}/${gpuNodes.length}`} accent="#a855f7" icon={<Icon name="server" size={16} />} sub={`${agg.criticalNodes} critical`} />
        <StatTile label="Workloads" value={String(agg.running)} accent="#3b82f6" icon={<Icon name="jobs" size={16} />} sub={`${agg.pending} queued · ${agg.failed} failed`} />
        <StatTile label="Burn rate" value={`${compactUsd(cluster.costPerHour)}/h`} accent="#10b981" icon={<Icon name="dollar" size={16} />} sub={`${cluster.sla}% SLA`} />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Utilization telemetry"
          subtitle="5-minute sliding window from DCGM-exported metrics"
          actions={<Badge tone="green">live</Badge>}
        >
          <AreaChart data={utilSeries} color="#76b900" compare={memSeries} compareColor="#22d3ee" yFormat={(v) => `${v.toFixed(0)}%`} height={230} />
          <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-ink-400">
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-full bg-nv-500" /> SM / GPU utilization</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-full bg-vol-teal" /> HBM allocation</span>
          </div>
          <div className="mt-4">
            <AreaChart data={powerSeries} color="#f59e0b" height={90} yFormat={(v) => `${(v / 1000).toFixed(1)}MW`} />
          </div>
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel fill title="Cluster profile" subtitle={cluster.orchestrator}>
            <div className="flex flex-col items-center gap-3">
              <RadialGauge value={cluster.utilization} size={140} label="Fleet saturation" />
              <div className="flex items-center gap-2">
                <GpuBadge gpuModelId={cluster.gpuModelId} count={cluster.gpuCount} />
                <HealthBadge status={cluster.health} />
              </div>
            </div>
            <div className="mt-4">
              <KeyValue label="Accelerator">{spec?.name}</KeyValue>
              <KeyValue label="Architecture">{spec?.arch}</KeyValue>
              <KeyValue label="HBM per GPU">{spec?.memoryGb} GB</KeyValue>
              <KeyValue label="Interconnect">{cluster.fabric}</KeyValue>
              <KeyValue label="GPUs per node">{cluster.gpusPerNode}</KeyValue>
              <KeyValue label="CPU cores / node">{cluster.cpuCoresPerNode}</KeyValue>
              <KeyValue label="Node memory">{gb(cluster.memGbPerNode)}</KeyValue>
              <KeyValue label="Local NVMe / node">{tb(cluster.localNvmeTbPerNode)}</KeyValue>
              <KeyValue label="Queue" >{cluster.orchestrator === "Slurm" ? "5 partitions" : "namespaces + MIG"}</KeyValue>
            </div>
          </Panel>

          <Panel fill title="Team allocation" subtitle="Active GPU reservations by team">
            <div className="flex h-full flex-col justify-center">
              {teamJobs.length ? <HBar items={teamJobs} unit=" GPUs" /> : <p className="text-sm text-ink-500">No active allocations.</p>}
            </div>
          </Panel>
        </div>
      </div>

      <Panel
        title="Round-trip latency & rack overview"
        subtitle={`${gpuNodes.length} GPU nodes rendered · each cell is one accelerator`}
        actions={
          <Link href={`/clusters/${clusterId}/nodes`}>
            <Badge tone="cyan">node explorer</Badge>
          </Link>
        }
      >
        <div className="mb-3 flex flex-wrap gap-4 text-[11px] text-ink-400">
          <Legend color="#2f4a00" label="idle" />
          <Legend color="#c8f56e" label=">30%" />
          <Legend color="#93e000" label=">70%" />
          <Legend color="#76b900" label=">90%" />
          <Legend color="#f59e0b" label="throttled" />
          <Legend color="#ef4444" label="fault" />
        </div>
        {heatCells.length ? <GpuHeatmap cells={heatCells} columns={24} /> : <EmptyState title="No materialized GPU nodes" />}
      </Panel>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <Panel fill title="Thermal & power" subtitle="Cluster envelope">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-ink-700/60 bg-ink-900/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-ink-500">Peak GPU temp</p>
              <p className="mt-1 font-mono text-lg" style={{ color: tempColor(peaks.temp) }}>{peaks.temp.toFixed(0)}°C</p>
            </div>
            <div className="rounded-lg border border-ink-700/60 bg-ink-900/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-ink-500">Throttled</p>
              <p className="mt-1 font-mono text-lg" style={{ color: peaks.throttled ? "#f59e0b" : "#76b900" }}>{peaks.throttled}</p>
            </div>
            <div className="rounded-lg border border-ink-700/60 bg-ink-900/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-ink-500">XID / ECC</p>
              <p className="mt-1 font-mono text-lg text-ink-100">{peaks.xid} / {peaks.ecc}</p>
            </div>
            <div className="rounded-lg border border-ink-700/60 bg-ink-900/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-ink-500">Racks</p>
              <p className="mt-1 font-mono text-lg text-ink-100">{racks.length}</p>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {racks.slice(0, 4).map((rack) => {
              const drawKw = rack.nodeIds.map((id) => state.nodes.find((n) => n.id === id)).reduce((s, n) => s + (n?.powerW ?? 0), 0) / 1000;
              return (
                <div key={rack.id}>
                  <div className="mb-1 flex justify-between text-[10px] text-ink-500">
                    <span className="font-mono">{rack.name} · inlet {rack.inletTempC}°C</span>
                    <span className="font-mono">{drawKw.toFixed(1)}/{rack.powerCapacityKw} kW</span>
                  </div>
                  <ProgressBar value={drawKw / Math.max(1, rack.powerCapacityKw)} color={drawKw / rack.powerCapacityKw > 1 ? "#ef4444" : "#76b900"} />
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel fill title="Topology & tenancy" subtitle="Placement domains and policy">
          <div className="space-y-2 text-xs">
            {blocks.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg border border-ink-700/60 bg-ink-900/40 p-2.5">
                <span className="text-ink-300">{b.name}</span>
                <span className="font-mono text-[11px] text-ink-500">{b.nodeIds.length} nodes · {b.oversubscription}× · {b.bandwidthTbps} Tbps</span>
              </div>
            ))}
            {blocks.length === 0 && <p className="text-ink-500">No topology blocks.</p>}
          </div>
          <div className="mt-3">
            <KeyValue label="Autoscaling">{settings?.autoscaling ? "enabled" : "disabled"}</KeyValue>
            <KeyValue label="Power steering">{settings?.powerSteering ? "enabled" : "disabled"}</KeyValue>
            <KeyValue label="Preemption">{settings?.preemption ? "enabled" : "disabled"}</KeyValue>
            <KeyValue label="Isolation">{settings?.isolation ?? "—"}</KeyValue>
            <KeyValue label="MIG">{settings?.migEnabled ? "enabled" : "disabled"}</KeyValue>
          </div>
        </Panel>

        <Panel fill title="Chargeback & reservations" subtitle="Metering and guarantees">
          <KeyValue label="GPU-hours (24h)">{metering ? num(Math.round(metering.gpuHours24h)) : "—"}</KeyValue>
          <KeyValue label="Storage">{metering ? tb(metering.storageTb) : "—"}</KeyValue>
          <KeyValue label="Egress (24h)">{metering ? `${compact(metering.egressGb24h)} GB` : "—"}</KeyValue>
          <KeyValue label="Reserved GPUs">{metering ? num(metering.reservedGpus) : "—"}</KeyValue>
          <KeyValue label="Spot GPUs">{metering ? num(metering.spotGpus) : "—"}</KeyValue>
          <p className="mb-1 mt-3 text-[10px] uppercase tracking-wider text-ink-500">Reservations</p>
          <div className="flex flex-col gap-1.5">
            {reservations.slice(0, 4).map((r) => {
              const active = r.startAt <= Date.now() && r.endAt > Date.now();
              return (
                <div key={r.id} className="flex items-center justify-between text-[11px]">
                  <span className="truncate text-ink-400">{r.name}</span>
                  <span className="flex items-center gap-1.5">
                    <span className="font-mono text-ink-300">{num(r.gpuCount)}</span>
                    <Badge tone={active ? "green" : "cyan"}>{active ? "active" : "sched"}</Badge>
                  </span>
                </div>
              );
            })}
            {reservations.length === 0 && <p className="text-[11px] text-ink-500">No reservations.</p>}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <Panel fill className="lg:col-span-2" title="Active workloads" subtitle="Highest-priority running jobs"
          actions={<Link href={`/clusters/${clusterId}/jobs`}><span className="text-xs text-nv-300 hover:underline">All workloads →</span></Link>}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-ink-700 text-left text-[11px] uppercase tracking-wider text-ink-500">
                  <th className="py-2 pr-4 font-medium">Job</th>
                  <th className="py-2 pr-4 font-medium">User</th>
                  <th className="py-2 pr-4 font-medium">GPUs</th>
                  <th className="py-2 pr-4 font-medium">Progress</th>
                  <th className="py-2 font-medium">State</th>
                </tr>
              </thead>
              <tbody>
                {agg.jobs
                  .filter((j) => j.state === "running")
                  .slice(0, 7)
                  .map((j) => {
                    const user = state.users.find((u) => u.id === j.userId);
                    return (
                      <tr key={j.id} className="border-b border-ink-800/60">
                        <td className="py-2 pr-4">
                          <p className="font-medium text-ink-200">{j.name}</p>
                          <p className="text-[11px] text-ink-500">{j.framework} · {j.partition}</p>
                        </td>
                        <td className="py-2 pr-4 text-ink-300">{user?.name ?? "—"}</td>
                        <td className="py-2 pr-4 font-mono text-ink-300">{j.gpusRequested}</td>
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="w-24"><ProgressBar value={j.progress} /></div>
                            <span className="font-mono text-[11px] text-ink-400">{pct(j.progress)}</span>
                          </div>
                        </td>
                        <td className="py-2"><JobStateBadge state={j.state} /></td>
                      </tr>
                    );
                  })}
                {agg.running === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm text-ink-500">No running workloads.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel fill title="Recent alerts" subtitle={`${agg.alerts.filter((a) => a.state === "active").length} active`}>
            <div className="flex h-full flex-col justify-center gap-2">
              {agg.alerts.slice(0, 4).map((a) => (
                <div key={a.id} className="flex items-start gap-2">
                  <SeverityBadge severity={a.severity} />
                  <div className="min-w-0">
                    <p className="truncate text-xs text-ink-200">{a.title}</p>
                    <p className="text-[10px] text-ink-500">{a.code} · {relTime(a.raisedAt)}</p>
                  </div>
                </div>
              ))}
              {agg.alerts.length === 0 && <p className="text-sm text-ink-500">No alerts.</p>}
            </div>
          </Panel>
          <Panel fill title="Owner" subtitle="Responsible team">
            {(() => {
              const team = teamById(state, cluster.ownerTeamId);
              return team ? (
                <div className="flex h-full items-center gap-3">
                  <span className="h-9 w-9 rounded-lg" style={{ backgroundColor: `${team.color}22`, border: `1px solid ${team.color}55` }} />
                  <div>
                    <p className="text-sm text-ink-100">{team.name}</p>
                    <p className="text-[11px] text-ink-500">{team.gpuHours30d.toFixed(0)} GPU-hours · 30d</p>
                  </div>
                </div>
              ) : null;
            })()}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
