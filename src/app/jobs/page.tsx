"use client";

import { useMemo, useState } from "react";
import { AreaChart, Donut } from "@/components/charts/charts";
import { JobTable } from "@/components/domain/JobTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { Icon } from "@/components/ui/icons";
import { Badge, EmptyState, Panel, Segmented, StatTile } from "@/components/ui/primitives";
import { num } from "@/lib/format";
import { useSim } from "@/lib/store";

export default function WorkloadsPage() {
  const { state } = useSim();
  const [stateFilter, setStateFilter] = useState<"all" | "running" | "pending" | "completed" | "failed">("all");
  const [clusterFilter, setClusterFilter] = useState("all");

  const jobs = useMemo(() => {
    let list = state.jobs;
    if (stateFilter !== "all") list = list.filter((j) => j.state === stateFilter);
    if (clusterFilter !== "all") list = list.filter((j) => j.clusterId === clusterFilter);
    return [...list].sort((a, b) => {
      const rank = (j: typeof a) => (j.state === "running" ? 0 : j.state === "pending" ? 1 : 2);
      return rank(a) - rank(b) || b.submittedAt - a.submittedAt;
    });
  }, [state.jobs, stateFilter, clusterFilter]);

  const running = state.jobs.filter((j) => j.state === "running");
  const pending = state.jobs.filter((j) => j.state === "pending");
  const throughput = (state.globalHistory ?? []).map((h) => h.jobThroughput);

  const byFramework = useMemo(() => {
    const map = new Map<string, number>();
    for (const j of state.jobs.filter((j) => j.state === "running")) {
      map.set(j.framework, (map.get(j.framework) ?? 0) + 1);
    }
    const colors = ["#76b900", "#22d3ee", "#a855f7", "#f59e0b", "#3b82f6", "#f43f5e", "#10b981", "#fb923c"];
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value], i) => ({ label, value, color: colors[i % colors.length] }));
  }, [state.jobs]);

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-5 lg:p-7">
      <PageHeader
        title="Workloads"
        subtitle="Global scheduler view across every cluster — queues, allocations, priorities and lifecycle."
        actions={<Badge tone="green">{num(running.length)} running</Badge>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Running" value={num(running.length)} accent="#76b900" icon={<Icon name="play" size={16} />} sub={`${num(running.reduce((s, j) => s + j.gpusRequested, 0))} GPUs`} />
        <StatTile label="Queued" value={num(pending.length)} accent="#f59e0b" icon={<Icon name="clock" size={16} />} sub={`${num(pending.reduce((s, j) => s + j.gpusRequested, 0))} GPUs requested`} />
        <StatTile label="Completed" value={num(state.jobs.filter((j) => j.state === "completed").length)} accent="#22d3ee" icon={<Icon name="check" size={16} />} />
        <StatTile label="Failed" value={num(state.jobs.filter((j) => j.state === "failed").length)} accent="#ef4444" icon={<Icon name="alert" size={16} />} />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Scheduler throughput" subtitle="Active jobs across the fleet (5m window)">
          <AreaChart data={throughput} color="#a855f7" height={200} yFormat={(v) => v.toFixed(0)} />
        </Panel>
        <Panel title="Framework mix" subtitle="Running workloads by framework">
          {byFramework.length ? <Donut segments={byFramework} centerLabel="jobs" centerValue={String(running.length)} size={130} /> : <p className="text-sm text-ink-500">No running jobs.</p>}
        </Panel>
      </div>

      <Panel
        title="Job queue"
        subtitle={`${jobs.length} workloads`}
        padded={false}
        actions={
          <div className="flex items-center gap-2">
            <select
              value={clusterFilter}
              onChange={(e) => setClusterFilter(e.target.value)}
              className="rounded-lg border border-ink-700 bg-ink-900/60 px-2 py-1 text-xs text-ink-200 outline-none"
            >
              <option value="all">All clusters</option>
              {state.clusters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Segmented
              size="sm"
              value={stateFilter}
              onChange={setStateFilter}
              options={[
                { label: "All", value: "all" },
                { label: "Running", value: "running" },
                { label: "Queued", value: "pending" },
                { label: "Done", value: "completed" },
                { label: "Failed", value: "failed" },
              ]}
            />
          </div>
        }
      >
        <div className="p-2">
          {jobs.length ? <JobTable jobs={jobs.slice(0, 120)} showCluster /> : <EmptyState title="No workloads match" />}
        </div>
      </Panel>
    </div>
  );
}
