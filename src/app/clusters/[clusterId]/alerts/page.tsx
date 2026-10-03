"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertList } from "@/components/domain/AlertList";
import { Icon } from "@/components/ui/icons";
import { Button, EmptyState, Panel, Segmented, StatTile } from "@/components/ui/primitives";
import { num } from "@/lib/format";
import { useSim } from "@/lib/store";

export default function ClusterAlertsPage() {
  const params = useParams<{ clusterId: string }>();
  const clusterId = params.clusterId;
  const { state, actions } = useSim();
  const cluster = state.clusters.find((c) => c.id === clusterId);
  const alerts = useMemo(
    () => state.alerts.filter((a) => a.clusterId === clusterId),
    [state.alerts, clusterId]
  );
  const [filter, setFilter] = useState<"all" | "active" | "acknowledged" | "resolved">("active");

  const filtered = useMemo(
    () =>
      (filter === "all" ? alerts : alerts.filter((a) => a.state === filter)).sort((a, b) => b.raisedAt - a.raisedAt),
    [alerts, filter]
  );

  if (!cluster) return <EmptyState title="Cluster not found" />;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Active" value={num(alerts.filter((a) => a.state === "active").length)} accent="#f59e0b" icon={<Icon name="alert" size={16} />} />
        <StatTile label="Critical" value={num(alerts.filter((a) => a.severity === "critical" && a.state !== "resolved").length)} accent="#ef4444" icon={<Icon name="alert" size={16} />} />
        <StatTile label="Acknowledged" value={num(alerts.filter((a) => a.state === "acknowledged").length)} accent="#22d3ee" icon={<Icon name="check" size={16} />} />
        <StatTile label="Resolved" value={num(alerts.filter((a) => a.state === "resolved").length)} accent="#10b981" icon={<Icon name="check" size={16} />} />
      </div>

      <Panel
        title="DCGM & infrastructure events"
        subtitle={`Health monitoring for ${cluster.name}`}
        actions={
          <div className="flex items-center gap-2">
            <Segmented
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { label: "Active", value: "active" },
                { label: "Acked", value: "acknowledged" },
                { label: "Resolved", value: "resolved" },
                { label: "All", value: "all" },
              ]}
            />
            <Button size="sm" variant="ghost" onClick={() => actions.acknowledgeAllAlerts(clusterId)}>
              Ack all
            </Button>
            <Button size="sm" variant="primary" onClick={() => actions.remediateAll(clusterId)}>
              <Icon name="rocket" size={13} /> Fix all
            </Button>
          </div>
        }
      >
        <AlertList alerts={filtered} />
      </Panel>
    </div>
  );
}
