"use client";

import Link from "next/link";
import { JobStateBadge } from "@/components/ui/domain";
import { Icon } from "@/components/ui/icons";
import { Badge, Button, EmptyState, ProgressBar } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { duration, pct } from "@/lib/format";
import { useSim } from "@/lib/store";
import type { Job } from "@/lib/types";

const priorityTone: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f59e0b",
  normal: "#22d3ee",
  low: "#64748b",
};

export function JobTable({
  jobs,
  showCluster = false,
  emptyHint,
}: {
  jobs: Job[];
  showCluster?: boolean;
  emptyHint?: string;
}) {
  const { state, actions } = useSim();

  if (jobs.length === 0) {
    return <EmptyState title="No workloads" hint={emptyHint} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-sm">
        <thead>
          <tr className="border-b border-ink-700 text-left text-[11px] uppercase tracking-wider text-ink-500">
            <th className="px-3 py-2.5 font-medium">Job</th>
            <th className="px-3 py-2.5 font-medium">User</th>
            {showCluster && <th className="px-3 py-2.5 font-medium">Cluster</th>}
            <th className="px-3 py-2.5 font-medium">Resources</th>
            <th className="px-3 py-2.5 font-medium">Queue</th>
            <th className="px-3 py-2.5 font-medium">Priority</th>
            <th className="px-3 py-2.5 font-medium">Progress</th>
            <th className="px-3 py-2.5 font-medium">State</th>
            <th className="px-3 py-2.5 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const user = state.users.find((u) => u.id === job.userId);
            const cluster = state.clusters.find((c) => c.id === job.clusterId);
            const team = state.teams.find((t) => t.id === job.teamId);
            return (
              <tr key={job.id} className="border-b border-ink-800/60 hover:bg-ink-800/30">
                <td className="px-3 py-2.5">
                  <p className="font-medium text-ink-200">{job.name}</p>
                  <p className="text-[11px] text-ink-500">
                    {job.framework} · {job.id}
                  </p>
                </td>
                <td className="px-3 py-2.5">
                  <p className="text-xs text-ink-300">{user?.name ?? "—"}</p>
                  {team && (
                    <p className="flex items-center gap-1.5 text-[11px] text-ink-500">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: team.color }} />
                      {team.name}
                    </p>
                  )}
                </td>
                {showCluster && (
                  <td className="px-3 py-2.5">
                    {cluster ? (
                      <Link href={`/clusters/${cluster.id}`} className="text-xs text-nv-300 hover:underline">
                        {cluster.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                <td className="px-3 py-2.5">
                  <p className="font-mono text-xs text-ink-300">{job.gpusRequested} GPUs</p>
                  <p className="text-[11px] text-ink-500">
                    {job.nodesRequested} nodes · {job.cpuRequested} cores
                  </p>
                </td>
                <td className="px-3 py-2.5">
                  <Badge tone="neutral">{job.partition}</Badge>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {job.gang && <span className="rounded bg-ink-800 px-1.5 py-0.5 text-[9px] uppercase text-ink-400" title="Gang scheduled">gang</span>}
                    {job.preemptible && <span className="rounded bg-vol-amber/15 px-1.5 py-0.5 text-[9px] uppercase text-vol-amber" title="Preemptible">spot</span>}
                    {job.networkClass === "infiniband" && <span className="rounded bg-vol-teal/15 px-1.5 py-0.5 text-[9px] uppercase text-vol-teal" title="InfiniBand">IB</span>}
                    {job.networkClass === "roce" && <span className="rounded bg-vol-blue/15 px-1.5 py-0.5 text-[9px] uppercase text-vol-blue" title="RoCEv2">RoCE</span>}
                    {job.migrating && <span className="rounded bg-vol-violet/15 px-1.5 py-0.5 text-[9px] uppercase text-vol-violet" title="Checkpointing / migrating">migr</span>}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase"
                    style={{ backgroundColor: `${priorityTone[job.priority]}22`, color: priorityTone[job.priority] }}
                  >
                    {job.priority}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  {job.state === "running" ? (
                    <div className="flex items-center gap-2">
                      <div className="w-20">
                        <ProgressBar value={job.progress} />
                      </div>
                      <span className="font-mono text-[11px] text-ink-400">{pct(job.progress)}</span>
                    </div>
                  ) : job.state === "pending" ? (
                    <span className="text-[11px] text-ink-500">waiting {duration(job.runtimeSec)}</span>
                  ) : (
                    <span className="text-[11px] text-ink-500">{duration(job.runtimeSec)}</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <JobStateBadge state={job.state} />
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    {(job.state === "running" || job.state === "pending") && (
                      <button
                        type="button"
                        title="Pause / hold"
                        onClick={() => actions.setJobState(job.id, job.state === "paused" ? "running" : "paused")}
                        className={cn(
                          "rounded-md border border-ink-600 p-1.5 text-ink-300 transition hover:border-vol-violet/50 hover:text-vol-violet"
                        )}
                      >
                        <Icon name="pause" size={13} />
                      </button>
                    )}
                    {job.state !== "completed" && job.state !== "cancelled" && (
                      <button
                        type="button"
                        title="Cancel job"
                        onClick={() => actions.setJobState(job.id, "cancelled")}
                        className="rounded-md border border-ink-600 p-1.5 text-ink-300 transition hover:border-vol-red/50 hover:text-vol-red"
                      >
                        <Icon name="close" size={13} />
                      </button>
                    )}
                    {job.state === "pending" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Boost priority"
                        onClick={() => actions.setJobPriority(job.id, "urgent")}
                      >
                        <Icon name="bolt" size={13} />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
