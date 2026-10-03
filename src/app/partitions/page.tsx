"use client";

import Link from "next/link";
import { useMemo } from "react";
import { HBar, LineChart } from "@/components/charts/charts";
import { PageHeader } from "@/components/layout/PageHeader";
import { Icon } from "@/components/ui/icons";
import { Badge, Panel, ProgressBar, StatTile } from "@/components/ui/primitives";
import { DEFAULT_PARTITIONS } from "@/lib/constants";
import { duration, num } from "@/lib/format";
import { useSim } from "@/lib/store";

const PARTITION_META: Record<string, { qos: string; priority: string; maxNodes: number; preempt: string; tone: "green" | "cyan" | "violet" | "amber" | "red" }> = {
  "gpu-train": { qos: "high-throughput", priority: "normal", maxNodes: 128, preempt: "checkpoint", tone: "green" },
  "gpu-infer": { qos: "latency-sensitive", priority: "high", maxNodes: 32, preempt: "no", tone: "cyan" },
  "gpu-burst": { qos: "best-effort", priority: "low", maxNodes: 256, preempt: "yes", tone: "amber" },
  interactive: { qos: "interactive", priority: "high", maxNodes: 8, preempt: "no", tone: "violet" },
  preempt: { qos: "preemptible", priority: "low", maxNodes: 512, preempt: "yes", tone: "red" },
};

export default function PartitionsPage() {
  const { state } = useSim();

  const partitions = useMemo(() => {
    return DEFAULT_PARTITIONS.map((name) => {
      const jobs = state.jobs.filter((j) => j.partition === name);
      const running = jobs.filter((j) => j.state === "running");
      const pending = jobs.filter((j) => j.state === "pending");
      const gpusUsed = running.reduce((s, j) => s + j.gpusRequested, 0);
      const gpusQueued = pending.reduce((s, j) => s + j.gpusRequested, 0);
      const waitTimes = pending.map((j) => (Date.now() - j.submittedAt) / 1000);
      const avgWait = waitTimes.length ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length : 0;
      return {
        name,
        ...PARTITION_META[name],
        running: running.length,
        pending: pending.length,
        gpusUsed,
        gpusQueued,
        avgWait,
        jobs,
      };
    });
  }, [state.jobs]);

  const depthSeries = state.globalHistory.map((h) => h.jobThroughput);
  const backlogSeries = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < state.globalHistory.length; i++) {
      out.push(Math.max(0, state.globalHistory[i].jobThroughput * 1.6 + (i % 5) * 4 - 10));
    }
    return out;
  }, [state.globalHistory]);

  const totalRunning = partitions.reduce((s, p) => s + p.running, 0);
  const totalPending = partitions.reduce((s, p) => s + p.pending, 0);
  const totalGpus = partitions.reduce((s, p) => s + p.gpusUsed, 0);

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-5 lg:p-7">
      <PageHeader
        title="Scheduler Partitions"
        subtitle="Queue policy, QoS, backfill and fairness across every partition in the fleet. Inspect depth, wait time and resource pressure."
        actions={<Badge tone={totalPending > 40 ? "amber" : "green"}>{totalPending} queued</Badge>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Partitions" value={num(partitions.length)} accent="#22d3ee" icon={<Icon name="layers" size={16} />} />
        <StatTile label="Running jobs" value={num(totalRunning)} accent="#76b900" icon={<Icon name="play" size={16} />} />
        <StatTile label="Queued jobs" value={num(totalPending)} accent="#f59e0b" icon={<Icon name="clock" size={16} />} />
        <StatTile label="GPUs engaged" value={num(totalGpus)} accent="#a855f7" icon={<Icon name="chip" size={16} />} />
        <StatTile label="Preemptible queues" value={num(partitions.filter((p) => p.preempt === "yes").length)} accent="#ef4444" icon={<Icon name="alert" size={16} />} />
        <StatTile label="Fairshare" value="Enabled" accent="#10b981" icon={<Icon name="users" size={16} />} />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <Panel fill className="xl:col-span-2" title="Queue depth" subtitle="Running vs backlogged jobs (5m window)">
          <LineChart
            height={210}
            yFormat={(v) => v.toFixed(0)}
            series={[
              { name: "Running", color: "#76b900", data: depthSeries },
              { name: "Backlog", color: "#f59e0b", data: backlogSeries },
            ]}
          />
        </Panel>
        <Panel fill title="GPU pressure by partition" subtitle="Engaged GPUs across queues">
          <HBar
            items={partitions.map((p) => ({
              label: p.name,
              value: p.gpusUsed,
              color: p.gpusUsed > p.gpusQueued ? "#76b900" : "#f59e0b",
              sub: `${p.pending} queued · avg wait ${duration(p.avgWait)}`,
            }))}
            unit=" GPUs"
          />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {partitions.map((p) => {
          const total = Math.max(1, p.gpusUsed + p.gpusQueued);
          return (
            <Panel key={p.name} title={p.name} subtitle={`QoS: ${p.qos}`} actions={<Badge tone={p.tone}>priority {p.priority}</Badge>}>
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <Readout label="Running" value={num(p.running)} />
                <Readout label="Queued" value={num(p.pending)} />
                <Readout label="GPUs used" value={num(p.gpusUsed)} />
                <Readout label="GPUs requested" value={num(p.gpusQueued)} />
                <Readout label="Max nodes/job" value={num(p.maxNodes)} />
                <Readout label="Avg wait" value={p.pending ? duration(p.avgWait) : "—"} />
              </div>
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[10px] text-ink-500">
                  <span>Allocation</span>
                  <span className="font-mono">{num(p.gpusUsed)} used · {num(p.gpusQueued)} queued</span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-ink-800">
                  <div className="bg-nv-500" style={{ width: `${(p.gpusUsed / total) * 100}%` }} />
                  <div className="bg-vol-amber" style={{ width: `${(p.gpusQueued / total) * 100}%` }} />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-ink-700/50 pt-2 text-[11px]">
                <span className="text-ink-500">Preemption: <span className="text-ink-300">{p.preempt}</span></span>
                {p.jobs.length > 0 && (
                  <Link href="/jobs" className="text-nv-300 hover:underline">
                    View jobs →
                  </Link>
                )}
              </div>
            </Panel>
          );
        })}
      </div>

      <Panel title="Queue policy" subtitle="Global scheduler behavior">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {[
            { title: "Backfill", body: "Short jobs fill scheduling gaps without delaying queued work.", tone: "#76b900" },
            { title: "Fairshare", body: "Per-team historical usage weights determine priority under contention.", tone: "#22d3ee" },
            { title: "Gang scheduling", body: "Multi-node jobs are admitted atomically across topology blocks.", tone: "#a855f7" },
            { title: "Preemption", body: "Low-priority spot work is checkpointed and requeued on demand.", tone: "#f59e0b" },
          ].map((c) => (
            <div key={c.title} className="rounded-lg border border-ink-700/60 bg-ink-900/40 p-4">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: c.tone }} />
              <p className="mt-2 text-sm font-medium text-ink-100">{c.title}</p>
              <p className="mt-1 text-[11px] text-ink-500">{c.body}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink-700/50 bg-ink-900/40 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wider text-ink-500">{label}</p>
      <p className="mt-0.5 font-mono text-sm text-ink-100">{value}</p>
    </div>
  );
}
