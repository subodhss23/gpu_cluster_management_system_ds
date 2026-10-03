"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { AreaChart, HBar, RadialGauge } from "@/components/charts/charts";
import { ClusterCard } from "@/components/domain/ClusterCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Icon } from "@/components/ui/icons";
import { Badge, Button, EmptyState, Panel, StatTile } from "@/components/ui/primitives";
import { compact, dateTime, num, pct } from "@/lib/format";
import { regionKpis } from "@/lib/selectors";
import { useSim } from "@/lib/store";

export default function RegionPage() {
  const params = useParams<{ regionId: string }>();
  const regionId = params.regionId;
  const { state } = useSim();
  const region = state.regions.find((r) => r.id === regionId);
  const rk = useMemo(() => regionKpis(state, regionId), [state, regionId]);

  const history = useMemo(() => {
    const ids = rk.clusters.map((c) => c.id);
    const len = Math.min(...ids.map((id) => state.history[id]?.length ?? 0), 60);
    if (!ids.length || len <= 0) return { util: [] as number[], power: [] as number[], net: [] as number[], mem: [] as number[] };
    const util: number[] = [];
    const power: number[] = [];
    const net: number[] = [];
    const mem: number[] = [];
    for (let i = 0; i < len; i++) {
      let u = 0;
      let p = 0;
      let n = 0;
      let m = 0;
      for (const id of ids) {
        const s = state.history[id][state.history[id].length - len + i];
        u += s.gpuUtil;
        p += s.powerKw;
        n += s.netGbps;
        m += s.memUtil;
      }
      util.push((u / ids.length) * 100);
      power.push(p);
      net.push(n / 1000);
      mem.push((m / ids.length) * 100);
    }
    return { util, power, net, mem };
  }, [state.history, rk.clusters]);

  if (!region) {
    return (
      <div className="p-7">
        <EmptyState title="Region not found" hint="It may have been removed. Return to Mission Control." />
      </div>
    );
  }

  const tierTone = region.tier === "flagship" ? "green" : region.tier === "standard" ? "cyan" : "neutral";

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-5 lg:p-7">
      <PageHeader
        breadcrumb={[{ label: "Mission Control", href: "/" }, { label: "Regions" }, { label: region.id }]}
        title={`${region.city} · ${region.name}`}
        subtitle={`${region.country} · ${region.zones.length} availability zones · ${region.powerCapacityMw} MW provisioned capacity`}
        actions={
          <>
            <Badge tone={tierTone as never}>{region.tier} region</Badge>
            <Link href="/clusters">
              <Button variant="ghost">
                <Icon name="cluster" size={15} /> All clusters
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatTile label="Clusters" value={num(rk.clusters.length)} accent="#76b900" icon={<Icon name="cluster" size={16} />} />
        <StatTile label="Total GPUs" value={compact(rk.totalGpus)} accent="#22d3ee" icon={<Icon name="chip" size={16} />} />
        <StatTile label="Utilization" value={pct(rk.utilization, 1)} accent="#a855f7" icon={<Icon name="activity" size={16} />} />
        <StatTile label="Power draw" value={`${(rk.powerKw / 1000).toFixed(2)} MW`} accent="#f59e0b" icon={<Icon name="power" size={16} />} />
        <StatTile label="Active alerts" value={num(rk.alerts)} accent={rk.alerts ? "#ef4444" : "#10b981"} icon={<Icon name="alert" size={16} />} />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <Panel fill className="xl:col-span-2" title="Regional utilization" subtitle="Aggregated across every cluster in the region">
          <AreaChart data={history.util} color="#76b900" yFormat={(v) => `${v.toFixed(0)}%`} height={220} />
        </Panel>
        <Panel fill title="Datacenter efficiency" subtitle="Regional operations envelope">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col items-center rounded-lg border border-ink-700/60 bg-ink-900/40 p-3">
              <RadialGauge value={rk.utilization} size={104} label="Utilization" />
            </div>
            <div className="flex flex-col items-center rounded-lg border border-ink-700/60 bg-ink-900/40 p-3">
              <RadialGauge
                value={region.renewablePct / 100}
                size={104}
                label="Renewable"
                color="#10b981"
                display={`${region.renewablePct}%`}
              />
            </div>
          </div>
          <div className="mt-3 space-y-1">
            <Row label="Power Usage Effectiveness"><span className="font-mono">{region.pue.toFixed(2)}</span></Row>
            <Row label="Carbon intensity"><span className="font-mono">{region.carbonIntensity} gCO₂/kWh</span></Row>
            <Row label="Capacity headroom">
              <span className="font-mono">{Math.max(0, region.powerCapacityMw - rk.powerKw / 1000).toFixed(1)} MW</span>
            </Row>
          </div>
        </Panel>
      </div>

      <Panel title={`Clusters in ${region.name}`} subtitle={`${rk.clusters.length} managed clusters`}>
        {rk.clusters.length ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {rk.clusters.map((c) => (
              <ClusterCard key={c.id} cluster={c} />
            ))}
          </div>
        ) : (
          <EmptyState title="No clusters in this region" hint="Use Provision Cluster to deploy one." />
        )}
      </Panel>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Panel fill title="Power demand" subtitle="MW across the region">
          <AreaChart data={history.power} color="#f59e0b" height={170} />
        </Panel>
        <Panel fill title="Fabric throughput" subtitle="Aggregate Tbps">
          <AreaChart data={history.net} color="#22d3ee" height={170} />
        </Panel>
      </div>

      <Panel title="Cluster utilization ranking" subtitle="Relative GPU utilization within the region">
        <HBar
          items={rk.clusters.map((c) => ({
            label: c.name,
            value: Math.round(c.utilization * 100),
            color: c.health === "healthy" ? "#76b900" : c.health === "critical" ? "#ef4444" : "#f59e0b",
            sub: `${c.kind} · ${compact(c.gpuCount)} GPUs · owner team`,
          }))}
        />
      </Panel>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-ink-700/40 py-2 text-xs last:border-0">
      <span className="text-ink-400">{label}</span>
      <span className="text-ink-200">{children}</span>
    </div>
  );
}
