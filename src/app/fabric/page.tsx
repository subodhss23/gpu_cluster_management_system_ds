"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AreaChart, HBar, RadialGauge } from "@/components/charts/charts";
import { PageHeader } from "@/components/layout/PageHeader";
import { HealthBadge } from "@/components/ui/domain";
import { Icon } from "@/components/ui/icons";
import { Badge, Panel, ProgressBar, StatTile } from "@/components/ui/primitives";
import { compact, num, pct } from "@/lib/format";
import { useSim } from "@/lib/store";

export default function FabricPage() {
  const { state } = useSim();
  const fabrics = state.fabrics;
  const totalPorts = fabrics.reduce((s, f) => s + f.portsTotal, 0);
  const upPorts = fabrics.reduce((s, f) => s + f.portsUp, 0);
  const totalBw = fabrics.reduce((s, f) => s + f.bwTbps, 0);
  const totalErrors = fabrics.reduce((s, f) => s + f.errors, 0);
  const ib = fabrics.filter((f) => f.kind === "InfiniBand");
  const nv = fabrics.filter((f) => f.kind === "NVLink");
  const eth = fabrics.filter((f) => f.kind === "Ethernet");
  const netSeries = state.globalHistory.map((h) => h.netGbps / 1000);
  const netByCluster = useMemo(() => {
    return [...fabrics]
      .sort((a, b) => b.bwTbps - a.bwTbps)
      .slice(0, 10)
      .map((f) => ({
        label: state.clusters.find((c) => c.id === f.clusterId)?.name ?? f.clusterId,
        value: f.bwTbps,
        color: f.kind === "NVLink" ? "#a855f7" : f.kind === "InfiniBand" ? "#22d3ee" : "#3b82f6",
        sub: `${f.kind} · ${f.portsUp}/${f.portsTotal} ports`,
      }));
  }, [fabrics, state.clusters]);

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-5 lg:p-7">
      <PageHeader
        title="Fabric Operations"
        subtitle="Interconnect domains across the fleet — InfiniBand, NVLink and RoCEv2. Monitor port health, bandwidth and errors."
        actions={<Badge tone={totalErrors > 50 ? "amber" : "green"}>{totalErrors} cumulative errors</Badge>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Fabric domains" value={num(fabrics.length)} accent="#22d3ee" icon={<Icon name="network" size={16} />} />
        <StatTile label="Ports up" value={`${compact(upPorts)}/${compact(totalPorts)}`} accent="#76b900" icon={<Icon name="network" size={16} />} sub={pct(upPorts / Math.max(1, totalPorts), 1)} />
        <StatTile label="Aggregate BW" value={`${num(totalBw)} Tbps`} accent="#a855f7" icon={<Icon name="bolt" size={16} />} />
        <StatTile label="InfiniBand" value={num(ib.length)} accent="#22d3ee" icon={<Icon name="layers" size={16} />} />
        <StatTile label="NVLink domains" value={num(nv.length)} accent="#f59e0b" icon={<Icon name="chip" size={16} />} />
        <StatTile label="Ethernet / RoCE" value={num(eth.length)} accent="#3b82f6" icon={<Icon name="network" size={16} />} />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <Panel fill className="xl:col-span-2" title="Fleet interconnect throughput" subtitle="Aggregate Tbps across all fabrics (5m window)">
          <AreaChart data={netSeries} color="#22d3ee" height={210} yFormat={(v) => `${v.toFixed(1)} Tbps`} />
        </Panel>
        <Panel fill title="Bandwidth by domain" subtitle="Top fabrics by raw bandwidth">
          <HBar items={netByCluster} unit=" Tbps" />
        </Panel>
      </div>

      <Panel title="Fabric domains" subtitle={`${fabrics.length} interconnect domains`} padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-ink-700 text-left text-[11px] uppercase tracking-wider text-ink-500">
                <th className="px-4 py-2.5 font-medium">Cluster</th>
                <th className="px-4 py-2.5 font-medium">Kind</th>
                <th className="px-4 py-2.5 font-medium">Ports</th>
                <th className="px-4 py-2.5 font-medium">Bandwidth</th>
                <th className="px-4 py-2.5 font-medium">Latency</th>
                <th className="px-4 py-2.5 font-medium">Errors</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {fabrics.map((f) => {
                const cluster = state.clusters.find((c) => c.id === f.clusterId);
                return (
                  <tr key={f.id} className="border-b border-ink-800/60 hover:bg-ink-800/30">
                    <td className="px-4 py-2.5">
                      {cluster && (
                        <Link href={`/clusters/${cluster.id}/storage`} className="text-nv-300 hover:underline">
                          {cluster.name}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-2.5"><Badge tone={f.kind === "NVLink" ? "violet" : f.kind === "InfiniBand" ? "cyan" : "blue"}>{f.kind}</Badge></td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-20"><ProgressBar value={f.portsUp / Math.max(1, f.portsTotal)} /></div>
                        <span className="font-mono text-[11px] text-ink-400">{f.portsUp}/{f.portsTotal}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-ink-300">{f.bwTbps} Tbps</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-ink-300">{f.latencyUs.toFixed(2)} µs</td>
                    <td className="px-4 py-2.5 font-mono text-xs" style={{ color: f.errors > 0 ? "#f59e0b" : undefined }}>{f.errors}</td>
                    <td className="px-4 py-2.5"><HealthBadge status={f.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-3">
        <DomainCard title="InfiniBand" color="#22d3ee" domains={ib} />
        <DomainCard title="NVLink" color="#a855f7" domains={nv} />
        <DomainCard title="Ethernet / RoCE" color="#3b82f6" domains={eth} />
      </div>
    </div>
  );
}

function DomainCard({
  title,
  color,
  domains,
}: {
  title: string;
  color: string;
  domains: { id: string; portsUp: number; portsTotal: number; bwTbps: number; latencyUs: number; clusterId: string }[];
}) {
  const portsUp = domains.reduce((s, d) => s + d.portsUp, 0);
  const portsTotal = domains.reduce((s, d) => s + d.portsTotal, 0);
  const bw = domains.reduce((s, d) => s + d.bwTbps, 0);
  const latency = domains.length ? domains.reduce((s, d) => s + d.latencyUs, 0) / domains.length : 0;
  return (
    <Panel title={title} subtitle={`${domains.length} domains`}>
      <div className="flex items-center gap-4">
        <RadialGauge value={portsUp / Math.max(1, portsTotal)} size={104} thickness={9} color={color} label="port health" display={pct(portsUp / Math.max(1, portsTotal), 0)} />
        <div className="flex-1 space-y-1 text-[11px] text-ink-400">
          <p>Bandwidth <span className="float-right font-mono text-ink-200">{bw} Tbps</span></p>
          <p>Avg latency <span className="float-right font-mono text-ink-200">{latency.toFixed(2)} µs</span></p>
          <p>Ports <span className="float-right font-mono text-ink-200">{portsUp}/{portsTotal}</span></p>
        </div>
      </div>
    </Panel>
  );
}
