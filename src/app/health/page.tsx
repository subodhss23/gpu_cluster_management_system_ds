"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AreaChart, Donut, HBar, tempColor } from "@/components/charts/charts";
import { PageHeader } from "@/components/layout/PageHeader";
import { HealthBadge } from "@/components/ui/domain";
import { Icon } from "@/components/ui/icons";
import { Badge, Panel, ProgressBar, StatTile } from "@/components/ui/primitives";
import { GPU_BY_ID } from "@/lib/constants";
import { gb, num, pct } from "@/lib/format";
import { useSim } from "@/lib/store";

export default function HealthPage() {
  const { state } = useSim();
  const nodes = state.nodes;
  const gpuNodes = nodes.filter((n) => n.role === "gpu-worker");
  const allGpus = gpuNodes.flatMap((n) => n.gpus);

  const xidTotal = allGpus.reduce((s, g) => s + g.xidErrors, 0);
  const eccTotal = allGpus.reduce((s, g) => s + g.eccErrors, 0);
  const throttled = allGpus.filter((g) => g.throttle !== "none").length;
  const avgTemp = allGpus.length ? allGpus.reduce((s, g) => s + g.tempC, 0) / allGpus.length : 0;
  const maxTemp = allGpus.length ? Math.max(...allGpus.map((g) => g.tempC)) : 0;

  const tempSeries = state.globalHistory.map((h) => h.tempC);
  const powerSeries = state.globalHistory.map((h) => h.powerKw / 1000);

  const fleetHealth = useMemo(() => {
    const counts = { healthy: 0, warning: 0, critical: 0, offline: 0, provisioning: 0 };
    for (const n of nodes) counts[n.status] = (counts[n.status] ?? 0) + 1;
    return [
      { label: "Healthy", value: counts.healthy, color: "#76b900" },
      { label: "Warning", value: counts.warning, color: "#f59e0b" },
      { label: "Critical", value: counts.critical, color: "#ef4444" },
      { label: "Provisioning", value: counts.provisioning, color: "#22d3ee" },
    ].filter((x) => x.value > 0);
  }, [nodes]);

  const hottestGpus = useMemo(
    () =>
      gpuNodes
        .flatMap((n) => n.gpus.map((g) => ({ node: n, g })))
        .sort((a, b) => b.g.tempC - a.g.tempC)
        .slice(0, 8),
    [gpuNodes]
  );

  const noisyNodes = useMemo(
    () =>
      [...gpuNodes]
        .map((n) => ({ n, errors: n.gpus.reduce((s, g) => s + g.xidErrors + g.eccErrors, 0) }))
        .filter((x) => x.errors > 0)
        .sort((a, b) => b.errors - a.errors)
        .slice(0, 8),
    [gpuNodes]
  );

  const byArch = useMemo(() => {
    const map = new Map<string, { temp: number; count: number }>();
    for (const n of gpuNodes) {
      if (!n.gpuModelId) continue;
      const prev = map.get(n.gpuModelId) ?? { temp: 0, count: 0 };
      for (const g of n.gpus) {
        prev.temp += g.tempC;
        prev.count++;
      }
      map.set(n.gpuModelId, prev);
    }
    const colors = ["#76b900", "#22d3ee", "#a855f7", "#f59e0b", "#3b82f6", "#f43f5e"];
    return Array.from(map.entries()).map(([id, v], i) => ({
      label: GPU_BY_ID[id]?.name.replace("NVIDIA ", "") ?? id,
      value: Math.round(v.temp / Math.max(1, v.count)),
      color: colors[i % colors.length],
    }));
  }, [gpuNodes]);

  const rackPressure = useMemo(
    () =>
      Object.values(state.racks)
        .flat()
        .map((r) => ({
          label: `${state.clusters.find((c) => c.id === r.clusterId)?.name ?? "?"} ${r.name}`,
          value: Math.round((r.inletTempC / 30) * 100),
          color: r.inletTempC > 27 ? "#ef4444" : r.inletTempC > 25 ? "#f59e0b" : "#76b900",
          sub: `inlet ${r.inletTempC}°C · coolant ${r.coolantTempC}°C`,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
    [state.racks, state.clusters]
  );

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-5 lg:p-7">
      <PageHeader
        title="Fleet Health"
        subtitle="DCGM, NVSM and rack-level telemetry: thermal, power, ECC and XID error surveillance across every accelerator."
        actions={<Badge tone={maxTemp > 85 ? "red" : maxTemp > 75 ? "amber" : "green"}>peak {maxTemp.toFixed(0)}°C</Badge>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Node health" value={`${num(nodes.filter((n) => n.status === "healthy").length)}/${nodes.length}`} accent="#76b900" icon={<Icon name="server" size={16} />} />
        <StatTile label="Avg GPU temp" value={`${avgTemp.toFixed(1)}°C`} accent="#f59e0b" icon={<Icon name="temp" size={16} />} sub={`peak ${maxTemp.toFixed(0)}°C`} />
        <StatTile label="Thermal throttled" value={num(throttled)} accent={throttled > 0 ? "#ef4444" : "#10b981"} icon={<Icon name="power" size={16} />} />
        <StatTile label="XID errors" value={num(xidTotal)} accent="#fb923c" icon={<Icon name="alert" size={16} />} />
        <StatTile label="ECC errors" value={num(eccTotal)} accent="#a855f7" icon={<Icon name="memory" size={16} />} />
        <StatTile label="Fleet power" value={`${(state.globalHistory.at(-1)?.powerKw ?? 0) / 1000 >= 1 ? ((state.globalHistory.at(-1)?.powerKw ?? 0) / 1000).toFixed(2) : ((state.globalHistory.at(-1)?.powerKw ?? 0)).toFixed(0)} ${(state.globalHistory.at(-1)?.powerKw ?? 0) >= 1000 ? "MW" : "kW"}`} accent="#22d3ee" icon={<Icon name="bolt" size={16} />} />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <Panel fill className="xl:col-span-2" title="Thermal & power trend" subtitle="Fleet-average GPU temperature and total power draw">
          <AreaChart data={tempSeries} color="#f59e0b" height={200} yFormat={(v) => `${v.toFixed(0)}°C`} />
          <div className="mt-3">
            <AreaChart data={powerSeries} color="#22d3ee" height={90} yFormat={(v) => `${v.toFixed(1)} MW`} />
          </div>
        </Panel>
        <Panel fill title="Node health mix" subtitle={`${nodes.length} nodes`}>
          <Donut segments={fleetHealth} centerLabel="nodes" centerValue={String(nodes.length)} size={140} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Panel fill title="Hottest accelerators" subtitle="Ranked by junction temperature">
          <div className="flex flex-col gap-2">
            {hottestGpus.map(({ node, g }) => (
              <Link key={`${node.id}-${g.index}`} href={`/clusters/${node.clusterId}/nodes`} className="flex items-center gap-3 rounded-lg border border-ink-700/60 bg-ink-900/40 p-2.5 transition hover:border-ink-600">
                <span className="font-mono text-[11px] text-ink-300">{node.hostname}</span>
                <Badge tone="neutral">GPU {g.index}</Badge>
                <div className="ml-auto w-32"><ProgressBar value={g.tempC / 100} color={tempColor(g.tempC)} /></div>
                <span className="font-mono text-xs" style={{ color: tempColor(g.tempC) }}>{g.tempC.toFixed(0)}°C</span>
                {g.throttle !== "none" && <Badge tone="amber">{g.throttle}</Badge>}
              </Link>
            ))}
          </div>
        </Panel>

        <Panel fill title="Error hotspot nodes" subtitle="Nodes reporting XID / ECC errors">
          {noisyNodes.length ? (
            <div className="flex flex-col gap-2">
              {noisyNodes.map(({ n, errors }) => (
                <Link key={n.id} href={`/clusters/${n.clusterId}/nodes`} className="flex items-center gap-3 rounded-lg border border-ink-700/60 bg-ink-900/40 p-2.5 transition hover:border-ink-600">
                  <span className="font-mono text-[11px] text-ink-300">{n.hostname}</span>
                  <HealthBadge status={n.status} />
                  <span className="ml-auto font-mono text-xs text-vol-orange">{errors} errors</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-500">No nodes reporting errors. Fleet ECC-clean.</p>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Panel fill title="Temperature by architecture" subtitle="Average GPU temperature (°C)">
          <HBar items={byArch} unit="°C" />
        </Panel>
        <Panel fill title="Rack thermal pressure" subtitle="Highest inlet temperatures (index vs 30°C limit)">
          <HBar items={rackPressure} />
        </Panel>
      </div>

      <Panel title="Memory footprint" subtitle="Aggregate HBM allocation across materialized GPUs">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-ink-700/60 bg-ink-900/40 p-3">
            <p className="text-[10px] uppercase tracking-wider text-ink-500">HBM used</p>
            <p className="mt-1 font-mono text-lg text-ink-100">{gb(allGpus.reduce((s, g) => s + g.memUsedGb, 0))}</p>
          </div>
          <div className="rounded-lg border border-ink-700/60 bg-ink-900/40 p-3">
            <p className="text-[10px] uppercase tracking-wider text-ink-500">HBM capacity</p>
            <p className="mt-1 font-mono text-lg text-ink-100">{gb(allGpus.reduce((s, g) => s + g.memTotalGb, 0))}</p>
          </div>
          <div className="rounded-lg border border-ink-700/60 bg-ink-900/40 p-3">
            <p className="text-[10px] uppercase tracking-wider text-ink-500">Allocation</p>
            <p className="mt-1 font-mono text-lg text-nv-300">{pct(allGpus.reduce((s, g) => s + g.memUsedGb, 0) / Math.max(1, allGpus.reduce((s, g) => s + g.memTotalGb, 0)), 1)}</p>
          </div>
          <div className="rounded-lg border border-ink-700/60 bg-ink-900/40 p-3">
            <p className="text-[10px] uppercase tracking-wider text-ink-500">Materialized GPUs</p>
            <p className="mt-1 font-mono text-lg text-ink-100">{num(allGpus.length)}</p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
