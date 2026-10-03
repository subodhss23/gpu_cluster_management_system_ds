"use client";

import { useParams } from "next/navigation";
import { useMemo } from "react";
import { AreaChart, Donut, RadialGauge } from "@/components/charts/charts";
import { HealthBadge } from "@/components/ui/domain";
import { Icon } from "@/components/ui/icons";
import { Badge, EmptyState, Panel, ProgressBar, StatTile } from "@/components/ui/primitives";
import { compact, num, pct, tb } from "@/lib/format";
import { useSim } from "@/lib/store";

export default function ClusterStoragePage() {
  const params = useParams<{ clusterId: string }>();
  const clusterId = params.clusterId;
  const { state } = useSim();
  const cluster = state.clusters.find((c) => c.id === clusterId);
  const filesystems = useMemo(
    () => state.filesystems.filter((f) => f.clusterId === clusterId),
    [state.filesystems, clusterId]
  );
  const fabrics = useMemo(
    () => state.fabrics.filter((f) => f.clusterId === clusterId),
    [state.fabrics, clusterId]
  );

  const capacity = filesystems.reduce((s, f) => s + f.capacityTb, 0);
  const used = filesystems.reduce((s, f) => s + f.usedTb, 0);
  const read = filesystems.reduce((s, f) => s + f.readGbps, 0);
  const write = filesystems.reduce((s, f) => s + f.writeGbps, 0);
  const history = state.history[clusterId] ?? [];
  const netSeries = history.map((h) => h.netGbps / 1000);
  const readSeries = history.map((h) => h.storageGbps);
  const iopsSeries = history.map((h) => h.storageIops / 1000);

  if (!cluster) return <EmptyState title="Cluster not found" />;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Provisioned" value={tb(capacity)} accent="#3b82f6" icon={<Icon name="storage" size={16} />} />
        <StatTile label="Used" value={tb(used)} accent="#22d3ee" icon={<Icon name="storage" size={16} />} sub={pct(used / Math.max(1, capacity), 1)} />
        <StatTile label="Read throughput" value={`${read.toFixed(0)} GB/s`} accent="#76b900" icon={<Icon name="download" size={16} />} />
        <StatTile label="Write throughput" value={`${write.toFixed(0)} GB/s`} accent="#a855f7" icon={<Icon name="refresh" size={16} />} />
        <StatTile label="Fabric BW" value={`${fabrics.reduce((s, f) => s + f.bwTbps, 0).toFixed(0)} Tbps`} accent="#f59e0b" icon={<Icon name="network" size={16} />} />
        <StatTile label="Fabric errors" value={num(fabrics.reduce((s, f) => s + f.errors, 0))} accent={fabrics.some((f) => f.errors > 10) ? "#ef4444" : "#10b981"} icon={<Icon name="alert" size={16} />} />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="File systems" subtitle="Parallel and object storage attached to the cluster">
          <div className="flex flex-col gap-3">
            {filesystems.map((fs) => {
              const usage = fs.usedTb / Math.max(1, fs.capacityTb);
              return (
                <div key={fs.id} className="rounded-lg border border-ink-700/70 bg-ink-900/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-ink-200">{fs.name}</span>
                      <Badge tone="neutral">{fs.type}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-ink-400">
                      <span>R {fs.readGbps} GB/s</span>
                      <span>W {fs.writeGbps} GB/s</span>
                      <span>{compact(fs.iops)} IOPS</span>
                      <HealthBadge status={fs.status} />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1">
                      <ProgressBar value={usage} color={usage > 0.85 ? "#ef4444" : usage > 0.7 ? "#f59e0b" : "#3b82f6"} />
                    </div>
                    <span className="font-mono text-[11px] text-ink-400">
                      {tb(fs.usedTb)} / {tb(fs.capacityTb)}
                    </span>
                  </div>
                </div>
              );
            })}
            {filesystems.length === 0 && <EmptyState title="No file systems" />}
          </div>
        </Panel>

        <Panel title="Capacity breakdown" subtitle="Used vs available across tiers">
          <Donut
            segments={[
              { label: "Used", value: Math.round(used), color: "#22d3ee" },
              { label: "Available", value: Math.round(Math.max(0, capacity - used)), color: "#223040" },
            ]}
            centerLabel="capacity"
            centerValue={tb(capacity).replace(" ", "")}
            size={140}
          />
          <div className="mt-4">
            <AreaChart data={netSeries} color="#22d3ee" height={110} yFormat={(v) => `${v.toFixed(1)}Tbps`} />
            <p className="mt-1 text-[11px] text-ink-500">Aggregate fabric throughput (5m window)</p>
          </div>
        </Panel>
      </div>

      <Panel title="Interconnect fabric" subtitle={`${cluster.fabric} · ${fabrics.length} network domains`}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {fabrics.map((f) => (
            <div key={f.id} className="flex items-center gap-4 rounded-lg border border-ink-700/70 bg-ink-900/40 p-4">
              <RadialGauge
                value={f.portsUp / Math.max(1, f.portsTotal)}
                size={96}
                thickness={8}
                color={f.kind === "NVLink" ? "#a855f7" : f.kind === "InfiniBand" ? "#22d3ee" : "#3b82f6"}
                label="ports up"
                display={`${f.portsUp}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink-200">{f.kind}</span>
                  <HealthBadge status={f.status} />
                </div>
                <div className="mt-2 space-y-1 text-[11px] text-ink-400">
                  <p>Ports: <span className="font-mono text-ink-200">{f.portsUp}/{f.portsTotal}</span></p>
                  <p>Bandwidth: <span className="font-mono text-ink-200">{f.bwTbps} Tbps</span></p>
                  <p>Latency: <span className="font-mono text-ink-200">{f.latencyUs.toFixed(2)} µs</span></p>
                  <p>Errors: <span className={f.errors > 0 ? "text-vol-amber" : "text-nv-300"}>{f.errors}</span></p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Panel title="Storage throughput" subtitle="Aggregate GB/s and IOPS (5m window)">
          <AreaChart data={readSeries} color="#76b900" height={150} yFormat={(v) => `${v.toFixed(0)} GB/s`} />
          <div className="mt-3">
            <AreaChart data={iopsSeries} color="#22d3ee" height={100} yFormat={(v) => `${v.toFixed(0)}k IOPS`} />
          </div>
        </Panel>
        <Panel title="Storage performance tiers" subtitle="Throughput distribution across file systems">
          <div className="flex flex-col gap-3">
            {filesystems.map((fs) => (
              <div key={fs.id}>
                <div className="mb-1 flex justify-between text-[11px]">
                  <span className="text-ink-400">{fs.name}</span>
                  <span className="font-mono text-ink-300">{fs.readGbps + fs.writeGbps} GB/s</span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-ink-800">
                  <div className="bg-nv-500" style={{ width: `${(fs.readGbps / Math.max(1, read + write)) * 100}%` }} />
                  <div className="bg-vol-violet" style={{ width: `${(fs.writeGbps / Math.max(1, read + write)) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="GPUDirect Storage" subtitle="Direct storage-to-GPU datapath">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-ink-700/60 bg-ink-900/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-ink-500">Path</p>
              <p className="mt-1 text-sm text-ink-200">GPUDirect Storage active</p>
              <p className="mt-1 text-[11px] text-ink-500">Bypasses CPU bounce buffers, reducing host memory pressure.</p>
            </div>
            <div className="rounded-lg border border-ink-700/60 bg-ink-900/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-ink-500">Cache</p>
              <p className="mt-1 text-sm text-ink-200">{tb(cluster.localNvmeTbPerNode * Math.min(cluster.nodeCount, 28))} local NVMe</p>
              <p className="mt-1 text-[11px] text-ink-500">Cached dataset working set per materialized node.</p>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
