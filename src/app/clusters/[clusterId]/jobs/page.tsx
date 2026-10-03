"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { JobTable } from "@/components/domain/JobTable";
import { Icon } from "@/components/ui/icons";
import { Badge, Button, EmptyState, Panel, Segmented, StatTile } from "@/components/ui/primitives";
import { DEFAULT_PARTITIONS, FRAMEWORKS } from "@/lib/constants";
import { num, pct } from "@/lib/format";
import { useSim } from "@/lib/store";

export default function ClusterJobsPage() {
  const params = useParams<{ clusterId: string }>();
  const clusterId = params.clusterId;
  const { state, actions } = useSim();
  const cluster = state.clusters.find((c) => c.id === clusterId);
  const jobs = useMemo(() => state.jobs.filter((j) => j.clusterId === clusterId), [state.jobs, clusterId]);
  const [filter, setFilter] = useState<"all" | "running" | "pending" | "completed" | "failed">("all");
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    name: "llm-finetune-exp-001",
    userId: "",
    partition: DEFAULT_PARTITIONS[0],
    nodesRequested: 2,
    priority: "normal" as const,
    framework: FRAMEWORKS[0],
  });

  const partitions = useMemo(() => {
    return DEFAULT_PARTITIONS.map((p) => {
      const pJobs = jobs.filter((j) => j.partition === p);
      return {
        name: p,
        running: pJobs.filter((j) => j.state === "running").length,
        pending: pJobs.filter((j) => j.state === "pending").length,
        gpus: pJobs.filter((j) => j.state === "running").reduce((s, j) => s + j.gpusRequested, 0),
      };
    });
  }, [jobs]);

  const filtered = useMemo(() => {
    const list = filter === "all" ? jobs : jobs.filter((j) => j.state === filter);
    return [...list].sort((a, b) => {
      const rank = (j: typeof a) => (j.state === "running" ? 0 : j.state === "pending" ? 1 : 2);
      return rank(a) - rank(b) || b.submittedAt - a.submittedAt;
    });
  }, [jobs, filter]);

  if (!cluster) return <EmptyState title="Cluster not found" />;
  if (!form.userId && state.users.length) form.userId = state.users[0].id;

  const running = jobs.filter((j) => j.state === "running");
  const pending = jobs.filter((j) => j.state === "pending");

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Running" value={num(running.length)} accent="#76b900" icon={<Icon name="play" size={16} />} sub={`${num(running.reduce((s, j) => s + j.gpusRequested, 0))} GPUs engaged`} />
        <StatTile label="Queued" value={num(pending.length)} accent="#f59e0b" icon={<Icon name="clock" size={16} />} sub={`${num(pending.reduce((s, j) => s + j.gpusRequested, 0))} GPUs requested`} />
        <StatTile label="Completed (24h)" value={num(jobs.filter((j) => j.state === "completed").length)} accent="#22d3ee" icon={<Icon name="check" size={16} />} />
        <StatTile label="Failed" value={num(jobs.filter((j) => j.state === "failed").length)} accent="#ef4444" icon={<Icon name="alert" size={16} />} />
      </div>

      <Panel
        title="Scheduler queues"
        subtitle={`${cluster.orchestrator} partitions · backfill and fairness enabled`}
        actions={
          <Button size="sm" variant="primary" onClick={() => setShowForm((v) => !v)}>
            <Icon name="plus" size={14} /> Submit job
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {partitions.map((p) => {
            const total = Math.max(1, p.running + p.pending);
            return (
              <div key={p.name} className="rounded-lg border border-ink-700/70 bg-ink-900/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-ink-200">{p.name}</span>
                  <Badge tone="neutral">{p.gpus} GPUs</Badge>
                </div>
                <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-ink-800">
                  <div className="bg-nv-500" style={{ width: `${(p.running / total) * 100}%` }} />
                  <div className="bg-vol-amber" style={{ width: `${(p.pending / total) * 100}%` }} />
                </div>
                <div className="mt-1.5 flex justify-between text-[10px] text-ink-500">
                  <span>{p.running} running</span>
                  <span>{p.pending} queued</span>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {showForm && (
        <Panel title="Submit workload" subtitle="Allocate nodes and GPUs from this cluster's free capacity">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Job name">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2 text-sm text-ink-200 outline-none focus:border-nv-500/50"
              />
            </Field>
            <Field label="Submitting user">
              <select
                value={form.userId}
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
                className="w-full rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2 text-sm text-ink-200 outline-none"
              >
                {state.users.slice(0, 24).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Framework">
              <select
                value={form.framework}
                onChange={(e) => setForm({ ...form, framework: e.target.value })}
                className="w-full rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2 text-sm text-ink-200 outline-none"
              >
                {FRAMEWORKS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Partition">
              <select
                value={form.partition}
                onChange={(e) => setForm({ ...form, partition: e.target.value })}
                className="w-full rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2 text-sm text-ink-200 outline-none"
              >
                {DEFAULT_PARTITIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`Nodes: ${form.nodesRequested}`}>
              <input
                type="range"
                min={1}
                max={Math.min(24, cluster.nodeCount)}
                value={form.nodesRequested}
                onChange={(e) => setForm({ ...form, nodesRequested: Number(e.target.value) })}
                className="w-full"
              />
            </Field>
            <Field label="Priority">
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as typeof form.priority })}
                className="w-full rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2 text-sm text-ink-200 outline-none"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </Field>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-ink-500">
              Requesting <span className="font-mono text-ink-300">{form.nodesRequested * cluster.gpusPerNode} GPUs</span> ·
              free capacity {pct(1 - cluster.utilization)}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  actions.submitJob({
                    name: form.name,
                    userId: form.userId,
                    clusterId,
                    partition: form.partition,
                    nodesRequested: form.nodesRequested,
                    gpusRequested: form.nodesRequested * cluster.gpusPerNode,
                    priority: form.priority,
                    framework: form.framework,
                  });
                  setShowForm(false);
                }}
              >
                <Icon name="rocket" size={14} /> Launch
              </Button>
            </div>
          </div>
        </Panel>
      )}

      <Panel
        title="Workloads"
        subtitle={`${filtered.length} jobs`}
        padded={false}
        actions={
          <Segmented
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { label: "All", value: "all" },
              { label: "Running", value: "running" },
              { label: "Queued", value: "pending" },
              { label: "Done", value: "completed" },
              { label: "Failed", value: "failed" },
            ]}
          />
        }
      >
        <div className="p-2">
          <JobTable jobs={filtered} emptyHint="Submit a workload to see it appear in the queue." />
        </div>
      </Panel>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wider text-ink-500">{label}</span>
      {children}
    </label>
  );
}
