"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ClusterCard } from "@/components/domain/ClusterCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { GpuBadge, HealthBadge } from "@/components/ui/domain";
import { Icon } from "@/components/ui/icons";
import { Badge, Button, EmptyState, Panel, ProgressBar } from "@/components/ui/primitives";
import { compact, compactUsd, num, pct } from "@/lib/format";
import { fleetKpis } from "@/lib/selectors";
import { useSim } from "@/lib/store";

export default function ClusterFleetPage() {
  const { state } = useSim();
  const kpis = useMemo(() => fleetKpis(state), [state]);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("all");
  const [health, setHealth] = useState("all");
  const [sort, setSort] = useState("utilization");
  const [view, setView] = useState<"grid" | "table">("grid");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    let list = state.clusters.filter((c) => {
      if (region !== "all" && c.regionId !== region) return false;
      if (health === "healthy" && c.health !== "healthy") return false;
      if (health === "warning" && c.health !== "warning" && c.health !== "critical") return false;
      if (health === "provisioning" && c.status !== "provisioning") return false;
      if (term && !`${c.name} ${c.kind} ${c.tags.join(" ")} ${c.regionId}`.toLowerCase().includes(term)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "gpus") return b.gpuCount - a.gpuCount;
      if (sort === "cost") return b.costPerHour - a.costPerHour;
      return b.utilization - a.utilization;
    });
    return list;
  }, [state.clusters, query, region, health, sort]);

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-5 lg:p-7">
      <PageHeader
        title="Cluster Fleet"
        subtitle={`Manage ${kpis.clusters} accelerated clusters across ${kpis.regions} regions. Provision, inspect and decommission capacity.`}
        actions={
          <Link href="/provision">
            <Button variant="primary">
              <Icon name="plus" size={15} /> Provision cluster
            </Button>
          </Link>
        }
      />

      <Panel padded className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2">
            <Icon name="search" size={15} className="text-ink-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter clusters by name, kind or tag…"
              className="w-full bg-transparent text-sm text-ink-200 outline-none placeholder:text-ink-500"
            />
          </div>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2 text-sm text-ink-200 outline-none"
          >
            <option value="all">All regions</option>
            {state.regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {r.id}
              </option>
            ))}
          </select>
          <select
            value={health}
            onChange={(e) => setHealth(e.target.value)}
            className="rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2 text-sm text-ink-200 outline-none"
          >
            <option value="all">All health</option>
            <option value="healthy">Healthy</option>
            <option value="warning">Degraded</option>
            <option value="provisioning">Provisioning</option>
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2 text-sm text-ink-200 outline-none"
          >
            <option value="utilization">Sort: utilization</option>
            <option value="gpus">Sort: GPU count</option>
            <option value="cost">Sort: cost / hour</option>
            <option value="name">Sort: name</option>
          </select>
          <div className="ml-auto flex items-center gap-1 rounded-lg border border-ink-700 bg-ink-900/60 p-0.5">
            <button
              type="button"
              onClick={() => setView("grid")}
              className={`rounded-md px-2 py-1 text-xs ${view === "grid" ? "bg-nv-500/20 text-nv-200" : "text-ink-400"}`}
            >
              Grid
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              className={`rounded-md px-2 py-1 text-xs ${view === "table" ? "bg-nv-500/20 text-nv-200" : "text-ink-400"}`}
            >
              Table
            </button>
          </div>
        </div>
      </Panel>

      {filtered.length === 0 ? (
        <EmptyState title="No clusters match your filters" hint="Try widening the health or region filter." />
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((c) => (
            <ClusterCard key={c.id} cluster={c} />
          ))}
        </div>
      ) : (
        <Panel padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-ink-700 text-left text-[11px] uppercase tracking-wider text-ink-500">
                  <th className="px-4 py-3 font-medium">Cluster</th>
                  <th className="px-4 py-3 font-medium">Region</th>
                  <th className="px-4 py-3 font-medium">GPUs</th>
                  <th className="px-4 py-3 font-medium">Utilization</th>
                  <th className="px-4 py-3 font-medium">Workloads</th>
                  <th className="px-4 py-3 font-medium">Cost/h</th>
                  <th className="px-4 py-3 font-medium">Health</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const jobs = state.jobs.filter((j) => j.clusterId === c.id);
                  return (
                    <tr key={c.id} className="border-b border-ink-800/60 hover:bg-ink-800/30">
                      <td className="px-4 py-3">
                        <Link href={`/clusters/${c.id}`} className="font-medium text-ink-100 hover:text-nv-200">
                          {c.name}
                        </Link>
                        <p className="text-[11px] text-ink-500">{c.kind}</p>
                      </td>
                      <td className="px-4 py-3 text-ink-300">{c.regionId}</td>
                      <td className="px-4 py-3">
                        <GpuBadge gpuModelId={c.gpuModelId} count={c.gpuCount} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24">
                            <ProgressBar value={c.utilization} />
                          </div>
                          <span className="font-mono text-xs text-ink-300">{pct(c.utilization)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-ink-300">
                        {jobs.filter((j) => j.state === "running").length} run ·{" "}
                        {jobs.filter((j) => j.state === "pending").length} queued
                      </td>
                      <td className="px-4 py-3 font-mono text-ink-300">{compactUsd(c.costPerHour)}</td>
                      <td className="px-4 py-3">
                        <HealthBadge status={c.status === "provisioning" ? "provisioning" : c.health} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-500">
        <Badge tone="neutral">{filtered.length} shown</Badge>
        <span>{num(kpis.totalGpus)} total GPUs</span>
        <span>{compact(kpis.allocatedGpus)} allocated</span>
      </div>
    </div>
  );
}
