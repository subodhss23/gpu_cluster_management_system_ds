"use client";

import { useMemo, useState } from "react";
import { HBar } from "@/components/charts/charts";
import { PageHeader } from "@/components/layout/PageHeader";
import { HealthBadge } from "@/components/ui/domain";
import { Icon } from "@/components/ui/icons";
import { Badge, Panel, ProgressBar, Segmented, StatTile } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { num, pct } from "@/lib/format";
import { useSim } from "@/lib/store";
import type { Connectivity } from "@/lib/types";

const CONNECTIVITY_LABEL: Record<Connectivity, string> = {
  "nvlink-domain": "NVLink domain",
  "infiniband-island": "InfiniBand island",
  "ethernet-pod": "Ethernet pod",
};

const CONNECTIVITY_TONE: Record<Connectivity, "violet" | "cyan" | "blue"> = {
  "nvlink-domain": "violet",
  "infiniband-island": "cyan",
  "ethernet-pod": "blue",
};

export default function TopologyPage() {
  const { state } = useSim();
  const [clusterId, setClusterId] = useState(state.clusters[0]?.id ?? "");
  const cluster = state.clusters.find((c) => c.id === clusterId) ?? state.clusters[0];
  const blocks = useMemo(
    () => (cluster ? state.topology[cluster.id] ?? [] : []),
    [state.topology, cluster]
  );
  const nodes = useMemo(
    () => (cluster ? state.nodes.filter((n) => n.clusterId === cluster.id && n.role === "gpu-worker") : []),
    [state.nodes, cluster]
  );

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const oversub = useMemo(
    () =>
      blocks.map((b) => ({
        label: b.name,
        value: Math.round(b.oversubscription * 100),
        color: b.oversubscription > 2 ? "#ef4444" : b.oversubscription > 1.5 ? "#f59e0b" : "#76b900",
        sub: `${b.oversubscription}× oversubscription · ${b.bandwidthTbps} Tbps`,
      })),
    [blocks]
  );

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-5 lg:p-7">
      <PageHeader
        title="Network Topology"
        subtitle="Topology-aware placement domains. NVLink domains and InfiniBand islands determine job locality and collective performance."
        actions={
          <select
            value={clusterId}
            onChange={(e) => setClusterId(e.target.value)}
            className="rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2 text-sm text-ink-200 outline-none"
          >
            {state.clusters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        }
      />

      {cluster && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Topology blocks" value={num(blocks.length)} accent="#22d3ee" icon={<Icon name="layers" size={16} />} />
            <StatTile label="Materialized nodes" value={num(nodes.length)} accent="#76b900" icon={<Icon name="server" size={16} />} />
            <StatTile label="Connectivity" value={blocks[0] ? CONNECTIVITY_LABEL[blocks[0].connectivity].split(" ")[0] : "—"} accent="#a855f7" icon={<Icon name="network" size={16} />} />
            <StatTile label="Avg oversub" value={`${(blocks.reduce((s, b) => s + b.oversubscription, 0) / Math.max(1, blocks.length)).toFixed(2)}×`} accent="#f59e0b" icon={<Icon name="bolt" size={16} />} />
          </div>

          <Panel title="Placement domains" subtitle={`${cluster.name} · ${cluster.fabric}`}>
            <div className="flex flex-col gap-4">
              {blocks.map((block) => {
                const blockNodes = block.nodeIds.map((id) => nodeById.get(id)).filter((n): n is NonNullable<typeof n> => Boolean(n));
                const avgUtil = blockNodes.length
                  ? blockNodes.reduce((s, n) => s + (n.gpus.length ? n.gpus.reduce((a, g) => a + g.utilPct, 0) / n.gpus.length : 0), 0) / blockNodes.length
                  : 0;
                return (
                  <div key={block.id} className="rounded-xl border border-ink-700/70 bg-ink-900/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-600 bg-ink-800">
                          <Icon name="layers" size={15} className="text-vol-teal" />
                        </span>
                        <div>
                          <p className="text-sm font-medium text-ink-100">{block.name}</p>
                          <p className="text-[11px] text-ink-500">
                            {blockNodes.length} nodes · {block.bandwidthTbps} Tbps · {block.oversubscription}× oversubscription
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={CONNECTIVITY_TONE[block.connectivity]}>{CONNECTIVITY_LABEL[block.connectivity]}</Badge>
                        <Badge tone="neutral">{pct(avgUtil / 100, 0)} util</Badge>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(26px,1fr))] gap-1.5">
                      {blockNodes.map((node) => (
                        <div
                          key={node.id}
                          title={`${node.hostname} · ${node.status}`}
                          className={cn(
                            "aspect-square rounded-[3px] border",
                            node.status === "critical"
                              ? "border-vol-red/60 bg-vol-red/30"
                              : node.status === "warning"
                                ? "border-vol-amber/60 bg-vol-amber/25"
                                : "border-nv-500/40 bg-nv-500/25"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            <Panel fill title="Oversubscription" subtitle="Lower is better for collective communication">
              <HBar items={oversub} unit="%" />
            </Panel>
            <Panel fill title="Node status by block" subtitle="Health distribution across placement domains">
              <div className="flex flex-col gap-3">
                {blocks.map((block) => {
                  const blockNodes = block.nodeIds.map((id) => nodeById.get(id)).filter(Boolean);
                  const healthy = blockNodes.filter((n) => n!.status === "healthy").length;
                  return (
                    <div key={block.id}>
                      <div className="mb-1 flex justify-between text-[11px]">
                        <span className="text-ink-400">{block.name}</span>
                        <span className="font-mono text-ink-300">{healthy}/{blockNodes.length} healthy</span>
                      </div>
                      <ProgressBar value={healthy / Math.max(1, blockNodes.length)} />
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>

          <Panel title="Topology-aware scheduling" subtitle="How placement domains influence job admission">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <InfoCard
                title="Block topology"
                body="Collective jobs are packed within a single topology block to keep NVLink/IB hops minimal."
                icon="network"
                tone="#a855f7"
              />
              <InfoCard
                title="Oversubscription aware"
                body="Jobs that exceed a block's bandwidth budget are deferred rather than spread across the fabric."
                icon="bolt"
                tone="#f59e0b"
              />
              <InfoCard
                title="Gang scheduling"
                body="Multi-node jobs are admitted all-or-nothing to avoid partial allocations stranding resources."
                icon="layers"
                tone="#22d3ee"
              />
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

function InfoCard({ title, body, icon, tone }: { title: string; body: string; icon: string; tone: string }) {
  return (
    <div className="rounded-lg border border-ink-700/60 bg-ink-900/40 p-4">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${tone}1a`, color: tone }}>
        <Icon name={icon} size={15} />
      </span>
      <p className="mt-2 text-sm font-medium text-ink-100">{title}</p>
      <p className="mt-1 text-[11px] text-ink-500">{body}</p>
    </div>
  );
}
