"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Donut } from "@/components/charts/charts";
import { PageHeader } from "@/components/layout/PageHeader";
import { Icon } from "@/components/ui/icons";
import { Badge, EmptyState, Panel, Segmented, StatTile } from "@/components/ui/primitives";
import { relTime } from "@/lib/format";
import { useSim } from "@/lib/store";
import type { ActivityEvent } from "@/lib/types";

const KIND_META: Record<ActivityEvent["kind"], { label: string; icon: string; color: string }> = {
  cluster: { label: "Cluster", icon: "cluster", color: "#22d3ee" },
  job: { label: "Job", icon: "jobs", color: "#a855f7" },
  alert: { label: "Alert", icon: "alert", color: "#f59e0b" },
  user: { label: "User", icon: "users", color: "#3b82f6" },
  provision: { label: "Provision", icon: "rocket", color: "#76b900" },
  scale: { label: "Scale", icon: "bolt", color: "#10b981" },
  fabric: { label: "Fabric", icon: "network", color: "#22d3ee" },
  health: { label: "Health", icon: "activity", color: "#f43f5e" },
};

export default function ActivityPage() {
  const { state, actions } = useSim();
  const [filter, setFilter] = useState<"all" | "job" | "scale" | "fabric" | "health" | "alert">("all");
  const [clusterFilter, setClusterFilter] = useState("all");

  const filtered = useMemo(() => {
    return state.activity
      .filter((e) => (filter === "all" ? true : e.kind === filter))
      .filter((e) => (clusterFilter === "all" ? true : e.clusterId === clusterFilter))
      .sort((a, b) => b.t - a.t);
  }, [state.activity, filter, clusterFilter]);

  const byKind = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of state.activity) map.set(e.kind, (map.get(e.kind) ?? 0) + 1);
    const colors = ["#76b900", "#22d3ee", "#a855f7", "#f59e0b", "#3b82f6", "#f43f5e", "#10b981", "#fb923c"];
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([kind, value], i) => ({
        label: KIND_META[kind as ActivityEvent["kind"]]?.label ?? kind,
        value,
        color: colors[i % colors.length],
      }));
  }, [state.activity]);

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-5 lg:p-7">
      <PageHeader
        title="Activity & Audit Log"
        subtitle="Chronological operational event stream: scheduling, autoscaling, provisioning, fabric sweeps and health transitions."
        actions={
          <button
            type="button"
            onClick={() => actions.regenerate()}
            className="rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2 text-xs text-ink-300 hover:border-ink-500"
          >
            Resample fleet
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Events" value={String(state.activity.length)} accent="#22d3ee" icon={<Icon name="activity" size={16} />} />
        <StatTile label="Job events" value={String(state.activity.filter((e) => e.kind === "job").length)} accent="#a855f7" icon={<Icon name="jobs" size={16} />} />
        <StatTile label="Health events" value={String(state.activity.filter((e) => e.kind === "health" || e.kind === "alert").length)} accent="#f59e0b" icon={<Icon name="alert" size={16} />} />
        <StatTile label="Scale events" value={String(state.activity.filter((e) => e.kind === "scale").length)} accent="#10b981" icon={<Icon name="bolt" size={16} />} />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <Panel title="Event mix" subtitle="By category">
          <Donut segments={byKind} centerLabel="events" centerValue={String(state.activity.length)} size={130} />
        </Panel>

        <Panel
          className="lg:col-span-2"
          title="Event stream"
          subtitle={`${filtered.length} events`}
          actions={
            <div className="flex items-center gap-2">
              <select
                value={clusterFilter}
                onChange={(e) => setClusterFilter(e.target.value)}
                className="rounded-lg border border-ink-700 bg-ink-900/60 px-2 py-1 text-xs text-ink-200 outline-none"
              >
                <option value="all">All clusters</option>
                {state.clusters.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <Segmented
                size="sm"
                value={filter}
                onChange={setFilter}
                options={[
                  { label: "All", value: "all" },
                  { label: "Jobs", value: "job" },
                  { label: "Scale", value: "scale" },
                  { label: "Health", value: "health" },
                ]}
              />
            </div>
          }
        >
          {filtered.length === 0 ? (
            <EmptyState title="No events" hint="Try widening the filter." />
          ) : (
            <div className="flex max-h-[560px] flex-col overflow-y-auto">
              {filtered.map((e) => {
                const meta = KIND_META[e.kind] ?? KIND_META.cluster;
                const cluster = e.clusterId ? state.clusters.find((c) => c.id === e.clusterId) : undefined;
                return (
                  <div key={e.id} className="flex items-start gap-3 border-b border-ink-800/50 py-3 last:border-0">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}>
                      <Icon name={meta.icon} size={13} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink-200">{e.message}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-500">
                        <span className="rounded bg-ink-800 px-1.5 py-0.5">{meta.label}</span>
                        <span>{e.actor}</span>
                        {cluster && (
                          <Link href={`/clusters/${cluster.id}`} className="text-nv-300 hover:underline">
                            {cluster.name}
                          </Link>
                        )}
                        <span>· {relTime(e.t)}</span>
                      </div>
                    </div>
                    {e.severity !== "info" && <Badge tone={e.severity === "warning" ? "amber" : "red"}>{e.severity}</Badge>}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
