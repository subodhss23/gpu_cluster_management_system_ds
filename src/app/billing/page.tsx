"use client";

import { useMemo } from "react";
import { AreaChart, Donut, HBar } from "@/components/charts/charts";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, Panel, ProgressBar, StatTile } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icons";
import { GPU_BY_ID } from "@/lib/constants";
import { compact, compactUsd, dateTime, num, pct, usd } from "@/lib/format";
import { useSim } from "@/lib/store";

export default function BillingPage() {
  const { state } = useSim();

  const hourly = state.clusters.reduce((s, c) => s + c.costPerHour, 0);
  const gpuHours30d = state.teams.reduce((s, t) => s + t.gpuHours30d, 0);
  const spend30d = state.teams.reduce((s, t) => s + t.cost30d, 0);
  const budget = state.teams.reduce((s, t) => s + t.quota.costLimitUsd, 0);

  const costSeries = state.globalHistory.map((h) => hourly * (0.5 + h.gpuUtil * 0.5));

  const byCluster = useMemo(
    () =>
      [...state.clusters]
        .sort((a, b) => b.costPerHour - a.costPerHour)
        .slice(0, 10)
        .map((c) => ({
          label: c.name,
          value: Math.round(c.costPerHour * 24 * 30),
          color: c.health === "healthy" ? "#76b900" : "#f59e0b",
          sub: `${compact(c.gpuCount)} GPUs · ${compactUsd(c.costPerHour)}/h`,
        })),
    [state.clusters]
  );

  const byTeam = useMemo(
    () =>
      [...state.teams]
        .sort((a, b) => b.cost30d - a.cost30d)
        .map((t) => ({
          label: t.name,
          value: Math.round(t.cost30d),
          color: t.color,
          sub: `${pct(t.cost30d / Math.max(1, t.quota.costLimitUsd))} of budget`,
        })),
    [state.teams]
  );

  const byArch = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of state.clusters) {
      const cost = c.costPerHour * 24 * 30;
      map.set(c.gpuModelId, (map.get(c.gpuModelId) ?? 0) + cost);
    }
    const colors = ["#76b900", "#22d3ee", "#a855f7", "#f59e0b", "#3b82f6", "#f43f5e"];
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id, value], i) => ({
        label: GPU_BY_ID[id]?.name.replace("NVIDIA ", "") ?? id,
        value: Math.round(value),
        color: colors[i % colors.length],
      }));
  }, [state.clusters]);

  const idleCost = hourly * 24 * 30 * (1 - state.clusters.reduce((s, c) => s + c.utilization, 0) / Math.max(1, state.clusters.length));

  const totalReserved = state.metering ? Object.values(state.metering).reduce((s, m) => s + m.reservedGpus, 0) : 0;
  const totalSpot = state.metering ? Object.values(state.metering).reduce((s, m) => s + m.spotGpus, 0) : 0;
  const storageTb = state.metering ? Object.values(state.metering).reduce((s, m) => s + m.storageTb, 0) : 0;
  const egressGb = state.metering ? Object.values(state.metering).reduce((s, m) => s + m.egressGb24h, 0) : 0;
  const storageCost = storageTb * state.priceBook.storagePerTbMonth;
  const egressCost = egressGb * state.priceBook.egressPerGb * 30;

  const activeReservations = useMemo(
    () =>
      state.reservations
        .filter((r) => r.endAt > Date.now() - 3600000)
        .sort((a, b) => a.startAt - b.startAt),
    [state.reservations]
  );

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-5 lg:p-7">
      <PageHeader
        title="Cost & Billing"
        subtitle="Showback and chargeback across clusters, teams and accelerator generations. All figures are synthetic."
        actions={<Badge tone="green">{usd(budget)} monthly budget</Badge>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Burn rate" value={`${compactUsd(hourly)}/h`} accent="#10b981" icon={<Icon name="dollar" size={16} />} />
        <StatTile label="Daily" value={compactUsd(hourly * 24)} accent="#22d3ee" icon={<Icon name="clock" size={16} />} />
        <StatTile label="Monthly (run-rate)" value={compactUsd(hourly * 24 * 30)} accent="#a855f7" icon={<Icon name="activity" size={16} />} />
        <StatTile label="Spend (30d)" value={usd(spend30d)} accent="#f59e0b" icon={<Icon name="dollar" size={16} />} sub={pct(spend30d / Math.max(1, budget)) + " of budget"} />
        <StatTile label="GPU-hours (30d)" value={compact(gpuHours30d)} accent="#76b900" icon={<Icon name="chip" size={16} />} />
        <StatTile label="Idle capacity cost" value={compactUsd(idleCost)} accent="#ef4444" icon={<Icon name="alert" size={16} />} sub="recoverable via right-sizing" />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <Panel fill className="xl:col-span-2" title="Cost rate trend" subtitle="Instantaneous hourly run-rate (5m window)">
          <AreaChart data={costSeries} color="#10b981" height={210} yFormat={(v) => compactUsd(v)} />
        </Panel>
        <Panel fill title="Cost by architecture" subtitle="Monthly run-rate">
          <Donut segments={byArch} centerLabel="/ month" centerValue={compactUsd(hourly * 24 * 30)} size={140} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Panel fill title="Top clusters by cost" subtitle="Monthly run-rate">
          <HBar items={byCluster} />
        </Panel>
        <Panel fill title="Cost by team" subtitle="30-day chargeback">
          <HBar items={byTeam} />
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Reserved GPUs" value={compact(totalReserved)} accent="#3b82f6" icon={<Icon name="chip" size={16} />} sub={`${state.priceBook ? pct(state.priceBook.reservedDiscount) : "35%"} discount`} />
        <StatTile label="Spot GPUs" value={compact(totalSpot)} accent="#f59e0b" icon={<Icon name="bolt" size={16} />} sub={`${state.priceBook ? pct(state.priceBook.spotDiscount) : "62%"} discount`} />
        <StatTile label="Storage" value={`${compact(storageTb)} TB`} accent="#22d3ee" icon={<Icon name="storage" size={16} />} sub={`${usd(storageCost)}/mo`} />
        <StatTile label="Egress (30d)" value={`${compact(egressGb * 30)} GB`} accent="#a855f7" icon={<Icon name="download" size={16} />} sub={`${usd(egressCost)}`} />
      </div>

      <Panel title="Capacity reservations" subtitle="Team holds on capacity with guaranteed access windows" padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-ink-700 text-left text-[11px] uppercase tracking-wider text-ink-500">
                <th className="px-4 py-2.5 font-medium">Reservation</th>
                <th className="px-4 py-2.5 font-medium">Cluster</th>
                <th className="px-4 py-2.5 font-medium">Team</th>
                <th className="px-4 py-2.5 font-medium">GPUs</th>
                <th className="px-4 py-2.5 font-medium">Window</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {activeReservations.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-ink-500">No active reservations.</td></tr>
              )}
              {activeReservations.map((r) => {
                const active = r.startAt <= Date.now() && r.endAt > Date.now();
                const team = state.teams.find((t) => t.id === r.teamId);
                return (
                  <tr key={r.id} className="border-b border-ink-800/60">
                    <td className="px-4 py-2.5 text-ink-200">{r.name}</td>
                    <td className="px-4 py-2.5 text-xs text-ink-300">{state.clusters.find((c) => c.id === r.clusterId)?.name ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {team && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-ink-300">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: team.color }} />
                          {team.name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-ink-300">{num(r.gpuCount)}</td>
                    <td className="px-4 py-2.5 text-[11px] text-ink-400">{dateTime(r.startAt)} → {dateTime(r.endAt)}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={active ? "green" : r.endAt < Date.now() ? "neutral" : "cyan"}>
                        {active ? "active" : r.endAt < Date.now() ? "expired" : "scheduled"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Team chargeback" subtitle="Budget consumption and efficiency" padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-ink-700 text-left text-[11px] uppercase tracking-wider text-ink-500">
                <th className="px-4 py-2.5 font-medium">Team</th>
                <th className="px-4 py-2.5 font-medium">GPU-hours</th>
                <th className="px-4 py-2.5 font-medium">Active GPUs</th>
                <th className="px-4 py-2.5 font-medium">Spend (30d)</th>
                <th className="px-4 py-2.5 font-medium">Budget</th>
                <th className="px-4 py-2.5 font-medium">Utilization</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {[...state.teams]
                .sort((a, b) => b.cost30d - a.cost30d)
                .map((t) => {
                  const ratio = t.cost30d / Math.max(1, t.quota.costLimitUsd);
                  const activeGpus = state.jobs
                    .filter((j) => j.teamId === t.id && (j.state === "running" || j.state === "pending"))
                    .reduce((s, j) => s + j.gpusRequested, 0);
                  return (
                    <tr key={t.id} className="border-b border-ink-800/60 hover:bg-ink-800/30">
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-2 text-ink-200">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                          {t.name}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-ink-300">{compact(t.gpuHours30d)}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-ink-300">{activeGpus}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-ink-300">{usd(t.cost30d)}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-ink-400">{usd(t.quota.costLimitUsd)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-24"><ProgressBar value={ratio} color={ratio > 1 ? "#ef4444" : "#10b981"} /></div>
                          <span className="font-mono text-[11px] text-ink-400">{pct(ratio)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={ratio > 1 ? "red" : ratio > 0.8 ? "amber" : "green"}>
                          {ratio > 1 ? "over budget" : ratio > 0.8 ? "at risk" : "on track"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
