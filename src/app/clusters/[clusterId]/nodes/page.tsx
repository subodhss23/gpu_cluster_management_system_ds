"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { RadialGauge, tempColor, utilColor } from "@/components/charts/charts";
import { GpuBadge, HealthBadge } from "@/components/ui/domain";
import { Icon } from "@/components/ui/icons";
import { Badge, Button, EmptyState, KeyValue, Panel, ProgressBar } from "@/components/ui/primitives";
import { GPU_BY_ID } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { gb, num } from "@/lib/format";
import { useSim } from "@/lib/store";
import type { ClusterNode } from "@/lib/types";

function tempLabel2(c: number) {
  return `${c.toFixed(0)}°C`;
}

export default function ClusterNodesPage() {
  const params = useParams<{ clusterId: string }>();
  const clusterId = params.clusterId;
  const { state, actions } = useSim();
  const cluster = state.clusters.find((c) => c.id === clusterId);
  const nodes = useMemo(
    () => state.nodes.filter((n) => n.clusterId === clusterId),
    [state.nodes, clusterId]
  );
  const gpuNodes = nodes.filter((n) => n.role === "gpu-worker");
  const racks = state.racks[clusterId] ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(
    () =>
      nodes
        .filter((n) => (roleFilter === "all" ? true : n.role === roleFilter))
        .filter((n) => (statusFilter === "all" ? true : n.status === statusFilter))
        .sort((a, b) => a.hostname.localeCompare(b.hostname)),
    [nodes, roleFilter, statusFilter]
  );

  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  if (!cluster) return <EmptyState title="Cluster not found" />;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
      <div className="flex min-w-0 flex-col gap-6">
        <Panel
          title="Rack view"
          subtitle={`${gpuNodes.length} materialized GPU nodes · cell = one accelerator · color = utilization`}
          actions={
            <div className="flex items-center gap-2">
              <Badge tone="green">{gpuNodes.filter((n) => n.status === "healthy").length} healthy</Badge>
              <Badge tone="amber">{gpuNodes.filter((n) => n.status === "warning").length} warn</Badge>
              <Badge tone="red">{gpuNodes.filter((n) => n.status === "critical").length} crit</Badge>
            </div>
          }
        >
          {gpuNodes.length ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
              {gpuNodes.map((node) => (
                <div
                  key={node.id}
                  className={cn(
                    "rounded-lg border bg-ink-900/50 p-3 transition",
                    selectedId === node.id ? "border-nv-500/60" : "border-ink-700/70 hover:border-ink-600"
                  )}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setSelectedId(node.id)}
                      className="truncate font-mono text-xs text-ink-200 hover:text-nv-200"
                    >
                      {node.hostname}
                    </button>
                    <span className="text-[10px] text-ink-500">{node.rack}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {node.gpus.map((g) => (
                      <span
                        key={g.index}
                        title={`GPU ${g.index} · ${g.utilPct.toFixed(0)}% · ${g.tempC.toFixed(0)}°C`}
                        className="aspect-square rounded-[3px]"
                        style={{
                          backgroundColor:
                            g.throttle !== "none" ? tempColor(g.tempC) : utilColor(g.utilPct / 100),
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No GPU nodes materialized" />
          )}
        </Panel>

        {racks.length > 0 && (
          <Panel title="Rack thermal & power" subtitle={`${racks.length} racks · inlet / coolant temperatures and power budget`}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {racks.map((rack) => {
                const drawKw = rack.nodeIds
                  .map((id) => state.nodes.find((n) => n.id === id))
                  .reduce((s, n) => s + (n?.powerW ?? 0), 0) / 1000;
                return (
                  <div key={rack.id} className="rounded-lg border border-ink-700/70 bg-ink-900/40 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-ink-200">{rack.name}</span>
                      <HealthBadge status={rack.status} />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-ink-400">
                      <span>Inlet <span className="float-right font-mono" style={{ color: tempColor(rack.inletTempC + 45) }}>{rack.inletTempC}°C</span></span>
                      <span>Coolant <span className="float-right font-mono text-ink-200">{rack.coolantTempC}°C</span></span>
                      <span>Airflow <span className="float-right font-mono text-ink-200">{rack.airflowCfm} CFM</span></span>
                      <span>Draw <span className="float-right font-mono text-ink-200">{drawKw.toFixed(1)} kW</span></span>
                    </div>
                    <div className="mt-2">
                      <div className="mb-1 flex justify-between text-[10px] text-ink-500">
                        <span>Power budget</span>
                        <span className="font-mono">{drawKw.toFixed(1)}/{rack.powerCapacityKw} kW</span>
                      </div>
                      <ProgressBar
                        value={drawKw / Math.max(1, rack.powerCapacityKw)}
                        color={drawKw / rack.powerCapacityKw > 1 ? "#ef4444" : drawKw / rack.powerCapacityKw > 0.85 ? "#f59e0b" : "#76b900"}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}

        <Panel
          title="Node inventory"
          subtitle={`${filtered.length} nodes`}
          padded={false}
          actions={
            <div className="flex items-center gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded-lg border border-ink-700 bg-ink-900/60 px-2 py-1 text-xs text-ink-200 outline-none"
              >
                <option value="all">All roles</option>
                <option value="gpu-worker">GPU worker</option>
                <option value="head">Head</option>
                <option value="login">Login</option>
                <option value="storage">Storage</option>
                <option value="management">Management</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-ink-700 bg-ink-900/60 px-2 py-1 text-xs text-ink-200 outline-none"
              >
                <option value="all">All status</option>
                <option value="healthy">Healthy</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-ink-700 text-left text-[11px] uppercase tracking-wider text-ink-500">
                  <th className="px-4 py-2.5 font-medium">Hostname</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
                  <th className="px-4 py-2.5 font-medium">GPUs</th>
                  <th className="px-4 py-2.5 font-medium">GPU util</th>
                  <th className="px-4 py-2.5 font-medium">Temp</th>
                  <th className="px-4 py-2.5 font-medium">Power</th>
                  <th className="px-4 py-2.5 font-medium">Memory</th>
                  <th className="px-4 py-2.5 font-medium">Net</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((n) => {
                  const avgUtil = n.gpus.length ? n.gpus.reduce((s, g) => s + g.utilPct, 0) / n.gpus.length : 0;
                  const maxTemp = n.gpus.length ? Math.max(...n.gpus.map((g) => g.tempC)) : 0;
                  return (
                    <tr
                      key={n.id}
                      onClick={() => setSelectedId(n.id)}
                      className={cn(
                        "cursor-pointer border-b border-ink-800/60 hover:bg-ink-800/30",
                        selectedId === n.id && "bg-nv-500/5"
                      )}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-ink-200">{n.hostname}</td>
                      <td className="px-4 py-2.5 text-xs text-ink-400">{n.role}</td>
                      <td className="px-4 py-2.5 text-xs text-ink-300">{n.gpus.length || "—"}</td>
                      <td className="px-4 py-2.5">
                        {n.gpus.length ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16"><ProgressBar value={avgUtil / 100} color={utilColor(avgUtil / 100)} /></div>
                            <span className="font-mono text-[11px] text-ink-400">{avgUtil.toFixed(0)}%</span>
                          </div>
                        ) : (
                          <span className="text-xs text-ink-600">n/a</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs" style={{ color: maxTemp ? tempColor(maxTemp) : undefined }}>
                        {maxTemp ? tempLabel2(maxTemp) : "—"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-ink-300">{(n.powerW / 1000).toFixed(2)} kW</td>
                      <td className="px-4 py-2.5 text-xs text-ink-300">{gb(n.memUsedGb)} / {gb(n.memTotalGb)}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-ink-300">{(n.netRxGbps / 1000).toFixed(1)} Tbps</td>
                      <td className="px-4 py-2.5"><HealthBadge status={n.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div className="xl:sticky xl:top-24 xl:self-start">
        {selected ? (
          <NodeDetail node={selected} onDrain={() => actions.drainNode(selected.id)} onRestore={() => actions.restoreNode(selected.id)} />
        ) : (
          <Panel title="Node inspector" subtitle="Select a node to inspect per-GPU telemetry">
            <EmptyState title="No node selected" hint="Click a rack cell or a row in the inventory." />
          </Panel>
        )}
      </div>
    </div>
  );
}

function NodeDetail({ node, onDrain, onRestore }: { node: ClusterNode; onDrain: () => void; onRestore: () => void }) {
  const { actions } = useSim();
  const [clockCap, setClockCap] = useState(1600);
  const [powerCap, setPowerCap] = useState(80);
  const spec = node.gpuModelId ? GPU_BY_ID[node.gpuModelId] : undefined;
  const avgUtil = node.gpus.length ? node.gpus.reduce((s, g) => s + g.utilPct, 0) / node.gpus.length : 0;
  const totalPower = node.gpus.reduce((s, g) => s + g.powerW, 0);

  return (
    <Panel
      title={node.hostname}
      subtitle={`${node.rack} · slot ${node.slot} · ${node.role}`}
      actions={<HealthBadge status={node.status} />}
    >
      <div className="flex items-center justify-between gap-3">
        {node.gpuModelId ? <GpuBadge gpuModelId={node.gpuModelId} count={node.gpus.length} /> : <Badge tone="neutral">{node.role}</Badge>}
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onRestore} title="Restore node">
            <Icon name="check" size={13} /> Restore
          </Button>
          <Button size="sm" variant="danger" onClick={onDrain} title="Drain node">
            <Icon name="power" size={13} /> Drain
          </Button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button size="sm" variant="default" onClick={() => actions.rebootNode(node.id)}>
          <Icon name="refresh" size={13} /> Reboot node
        </Button>
        <Button size="sm" variant="default" onClick={() => actions.resetNodeErrors(node.id)}>
          <Icon name="check" size={13} /> Clear XID/ECC
        </Button>
      </div>

      <div className="mt-3 rounded-lg border border-ink-700/60 bg-ink-900/40 p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-500">Deep configuration</p>
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-[11px] text-ink-400">
              <span>Clock ceiling</span>
              <span className="font-mono text-ink-300">{clockCap} MHz</span>
            </div>
            <input type="range" min={900} max={2100} step={30} value={clockCap} onChange={(e) => setClockCap(Number(e.target.value))} className="w-full" />
            <Button size="sm" variant="ghost" className="mt-1 w-full" onClick={() => actions.throttleNodeClock(node.id, clockCap)}>
              Apply clock cap
            </Button>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-[11px] text-ink-400">
              <span>Power cap</span>
              <span className="font-mono text-ink-300">{powerCap}%</span>
            </div>
            <input type="range" min={50} max={100} step={5} value={powerCap} onChange={(e) => setPowerCap(Number(e.target.value))} className="w-full" />
            <Button size="sm" variant="ghost" className="mt-1 w-full" onClick={() => actions.capNodePower(node.id, powerCap)}>
              Apply power cap
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <RadialGauge value={avgUtil / 100} size={104} label="GPU util" color={utilColor(avgUtil / 100)} />
        <div className="flex-1">
          <div className="mb-2"><MeterRow label="CPU" value={node.cpuUtilPct} /></div>
          <div className="mb-2"><MeterRow label="Memory" value={(node.memUsedGb / node.memTotalGb) * 100} /></div>
          <div className="mb-2"><MeterRow label="Local NVMe" value={(node.nvmeUsedTb / Math.max(0.01, node.nvmeTotalTb)) * 100} /></div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-1.5">
        {node.gpus.map((g) => (
          <div key={g.index} className="rounded-lg border border-ink-700/60 bg-ink-900/40 p-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-ink-300">GPU {g.index}</span>
              <span className="font-mono text-[11px]" style={{ color: tempColor(g.tempC) }}>{g.tempC.toFixed(0)}°C</span>
            </div>
            <div className="mt-1.5"><ProgressBar value={g.utilPct / 100} color={utilColor(g.utilPct / 100)} /></div>
            <div className="mt-1 flex justify-between text-[10px] text-ink-500">
              <span>{g.utilPct.toFixed(0)}%</span>
              <span>{g.powerW.toFixed(0)}W</span>
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-ink-500">
              <span>HBM {g.memUsedGb.toFixed(0)}/{g.memTotalGb}GB</span>
              <span className="font-mono">{g.smClockMhz} MHz</span>
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-ink-500">
              <span>{g.memClockMhz} MHz HBM</span>
              {g.throttle !== "none" ? (
                <span className="text-vol-amber">{g.throttle} throttle</span>
              ) : (
                <span className="text-nv-400">nominal</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <KeyValue label="Accelerator">{spec?.name ?? "—"}</KeyValue>
        <KeyValue label="CPU cores">{node.cpuCores}</KeyValue>
        <KeyValue label="System memory">{gb(node.memTotalGb)}</KeyValue>
        <KeyValue label="Local NVMe">{node.nvmeUsedTb.toFixed(1)} / {node.nvmeTotalTb.toFixed(1)} TB</KeyValue>
        <KeyValue label="Network in">{node.netRxGbps.toFixed(1)} Gbps</KeyValue>
        <KeyValue label="Network out">{node.netTxGbps.toFixed(1)} Gbps</KeyValue>
        <KeyValue label="GPU power">{totalPower.toFixed(0)} W</KeyValue>
        <KeyValue label="Uptime">{num(node.uptimeHours)} h</KeyValue>
        <KeyValue label="XID / ECC errors">
          {node.gpus.reduce((s, g) => s + g.xidErrors, 0)} / {node.gpus.reduce((s, g) => s + g.eccErrors, 0)}
        </KeyValue>
      </div>
    </Panel>
  );
}

function MeterRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[10px] text-ink-500">
        <span>{label}</span>
        <span className="font-mono">{value.toFixed(0)}%</span>
      </div>
      <ProgressBar value={value / 100} />
    </div>
  );
}
