"use client";

import { useMemo, useState } from "react";
import { AlertList } from "@/components/domain/AlertList";
import { Donut, HBar } from "@/components/charts/charts";
import { PageHeader } from "@/components/layout/PageHeader";
import { Icon } from "@/components/ui/icons";
import { Button, EmptyState, Panel, Segmented, StatTile } from "@/components/ui/primitives";
import { num } from "@/lib/format";
import { useSim } from "@/lib/store";

export default function AlertsPage() {
  const { state, actions } = useSim();
  const [filter, setFilter] = useState<"active" | "critical" | "all">("active");

  const filtered = useMemo(() => {
    let list = state.alerts;
    if (filter === "active") list = list.filter((a) => a.state === "active");
    if (filter === "critical") list = list.filter((a) => a.severity === "critical" && a.state !== "resolved");
    return [...list].sort((a, b) => {
      const sev = { critical: 0, warning: 1, info: 2 };
      return sev[a.severity] - sev[b.severity] || b.raisedAt - a.raisedAt;
    });
  }, [state.alerts, filter]);

  const bySource = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of state.alerts.filter((a) => a.state === "active")) {
      map.set(a.source, (map.get(a.source) ?? 0) + 1);
    }
    const colors = ["#ef4444", "#f59e0b", "#22d3ee", "#a855f7", "#3b82f6", "#10b981"];
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({ label, value, color: colors[i % colors.length] }));
  }, [state.alerts]);

  const byCluster = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of state.alerts.filter((a) => a.state === "active")) {
      map.set(a.clusterId, (map.get(a.clusterId) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, value]) => ({
        label: state.clusters.find((c) => c.id === id)?.name ?? id,
        value,
        color: "#f59e0b",
      }));
  }, [state.alerts, state.clusters]);

  const active = state.alerts.filter((a) => a.state === "active");

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-5 lg:p-7">
      <PageHeader
        title="Alert Center"
        subtitle="Unified event stream from DCGM, NVSM, fabric managers, the scheduler and power control."
        actions={
          <>
            <Button variant="ghost" onClick={() => actions.acknowledgeAllAlerts()}>
              <Icon name="check" size={15} /> Acknowledge all
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                actions.remediateAll();
              }}
            >
              <Icon name="rocket" size={15} /> Auto-remediate all
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Active" value={num(active.length)} accent="#f59e0b" icon={<Icon name="alert" size={16} />} />
        <StatTile label="Critical" value={num(active.filter((a) => a.severity === "critical").length)} accent="#ef4444" icon={<Icon name="alert" size={16} />} />
        <StatTile label="Warning" value={num(active.filter((a) => a.severity === "warning").length)} accent="#fb923c" icon={<Icon name="alert" size={16} />} />
        <StatTile label="Info" value={num(active.filter((a) => a.severity === "info").length)} accent="#22d3ee" icon={<Icon name="alert" size={16} />} />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <Panel title="Events by source" subtitle="Active signal composition">
          {bySource.length ? <Donut segments={bySource} centerLabel="active" centerValue={String(active.length)} size={130} /> : <p className="text-sm text-ink-500">No active signals.</p>}
        </Panel>
        <Panel className="lg:col-span-2" title="Hotspots" subtitle="Clusters with the most active alerts">
          {byCluster.length ? <HBar items={byCluster} /> : <p className="text-sm text-ink-500">All clusters nominal.</p>}
        </Panel>
      </div>

      <Panel
        title="Event stream"
        subtitle={`${filtered.length} events`}
        actions={
          <Segmented
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { label: "Active", value: "active" },
              { label: "Critical", value: "critical" },
              { label: "All", value: "all" },
            ]}
          />
        }
      >
        <AlertList alerts={filtered} showCluster />
      </Panel>
    </div>
  );
}
