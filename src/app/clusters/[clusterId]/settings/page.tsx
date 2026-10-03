"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { GpuBadge, HealthBadge } from "@/components/ui/domain";
import { Icon } from "@/components/ui/icons";
import { Badge, Button, EmptyState, KeyValue, Panel } from "@/components/ui/primitives";
import { GPU_BY_ID } from "@/lib/constants";
import { compactUsd, dateTime, duration, num } from "@/lib/format";
import { teamById } from "@/lib/selectors";
import { useSim } from "@/lib/store";

export default function ClusterSettingsPage() {
  const params = useParams<{ clusterId: string }>();
  const clusterId = params.clusterId;
  const router = useRouter();
  const { state, actions } = useSim();
  const cluster = state.clusters.find((c) => c.id === clusterId);
  const [confirm, setConfirm] = useState("");
  const [scale, setScale] = useState(cluster?.gpuCount ?? 128);

  if (!cluster) return <EmptyState title="Cluster not found" />;
  const spec = GPU_BY_ID[cluster.gpuModelId];
  const team = teamById(state, cluster.ownerTeamId);
  const settings = state.settings[clusterId];

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <Panel
          title="Configuration profiles"
          subtitle="Named hardware & runtime configs bound to this cluster"
          actions={
            <Link href="/configs" className="text-xs text-nv-300 hover:underline">
              Config Manager →
            </Link>
          }
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {state.configs.filter((c) => c.clusterId === clusterId).length === 0 && (
              <p className="text-xs text-ink-500">No configs bound to this cluster yet.</p>
            )}
            {state.configs
              .filter((c) => c.clusterId === clusterId)
              .map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-ink-700/60 bg-ink-900/40 p-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[11px] text-ink-200">{c.name}</p>
                    <p className="text-[10px] text-ink-500">
                      CUDA {c.cudaVersion} · driver {c.driverVersion} · {c.migEnabled ? `MIG ${c.migProfile}` : "MIG off"}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => actions.applyConfig(c.id)}>
                    Apply
                  </Button>
                </div>
              ))}
          </div>
        </Panel>

        <Panel title="Lifecycle" subtitle="Cluster identity and provisioning state">
          <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
            <div>
              <KeyValue label="Cluster ID"><span className="font-mono">{cluster.id}</span></KeyValue>
              <KeyValue label="Name">{cluster.name}</KeyValue>
              <KeyValue label="Kind">{cluster.kind}</KeyValue>
              <KeyValue label="Orchestrator">{cluster.orchestrator}</KeyValue>
              <KeyValue label="Status"><HealthBadge status={cluster.status === "provisioning" ? "provisioning" : cluster.health} /></KeyValue>
              <KeyValue label="Region">{cluster.regionId} · {cluster.zone}</KeyValue>
            </div>
            <div>
              <KeyValue label="Created">{dateTime(cluster.createdAt)}</KeyValue>
              <KeyValue label="SLA">{cluster.sla}%</KeyValue>
              <KeyValue label="Owner team">
                {team ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: team.color }} />
                    {team.name}
                  </span>
                ) : "—"}
              </KeyValue>
              <KeyValue label="Tags">
                <span className="flex flex-wrap justify-end gap-1">
                  {cluster.tags.map((t) => (
                    <Badge key={t} tone="neutral">{t}</Badge>
                  ))}
                </span>
              </KeyValue>
              <KeyValue label="Fabric">{cluster.fabric}</KeyValue>
            </div>
          </div>
        </Panel>

        <Panel title="Capacity scaling" subtitle="Resize the cluster; the scheduler reconciles node membership automatically">
          <div className="flex flex-wrap items-center gap-4">
            <GpuBadge gpuModelId={cluster.gpuModelId} count={cluster.gpuCount} />
            <span className="text-xs text-ink-500">→</span>
            <GpuBadge gpuModelId={cluster.gpuModelId} count={scale} />
            <span className="text-xs text-ink-500">
              {Math.round(scale / cluster.gpusPerNode)} nodes · {compactUsd(scale * (spec?.msrpPerGpuHour ?? 3))}/h
            </span>
          </div>
          <input
            type="range"
            min={cluster.gpusPerNode * 2}
            max={8192}
            step={cluster.gpusPerNode}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="mt-4 w-full"
          />
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-ink-500">
              Current: {num(cluster.gpuCount)} GPUs across {num(cluster.nodeCount)} nodes
            </p>
            <Button
              variant="primary"
              disabled={scale === cluster.gpuCount}
              onClick={() => actions.scaleCluster(clusterId, scale)}
            >
              <Icon name="bolt" size={14} /> Apply resize
            </Button>
          </div>
        </Panel>

        <Panel title="Hardware configuration" subtitle="Per-node resource envelope">
          <div className="grid grid-cols-2 gap-x-8 md:grid-cols-3">
            <KeyValue label="GPU model">{spec?.name}</KeyValue>
            <KeyValue label="GPUs / node">{cluster.gpusPerNode}</KeyValue>
            <KeyValue label="CPU cores / node">{cluster.cpuCoresPerNode}</KeyValue>
            <KeyValue label="System memory / node">{cluster.memGbPerNode} GB</KeyValue>
            <KeyValue label="Local NVMe / node">{cluster.localNvmeTbPerNode} TB</KeyValue>
            <KeyValue label="HBM / GPU">{spec?.memoryGb} GB</KeyValue>
          </div>
        </Panel>

        <Panel title="Danger zone" subtitle="Irreversible operations" className="border-vol-red/30">
          <p className="text-sm text-ink-400">
            Decommissioning removes the cluster, its nodes, workloads and telemetry from the control plane. This action
            cannot be undone.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={`Type "${cluster.name}" to confirm`}
              className="flex-1 rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2 text-sm text-ink-200 outline-none focus:border-vol-red/50"
            />
            <Button
              variant="danger"
              disabled={confirm.trim().toLowerCase() !== cluster.name.toLowerCase()}
              onClick={() => {
                actions.deleteCluster(clusterId);
                router.push("/clusters");
              }}
            >
              <Icon name="trash" size={15} /> Delete cluster
            </Button>
          </div>
        </Panel>
      </div>

      <div className="flex flex-col gap-6">
        <Panel title="Billing profile" subtitle="Chargeback configuration">
          <KeyValue label="Rate">{compactUsd(cluster.costPerHour)} / hour</KeyValue>
          <KeyValue label="Daily">{compactUsd(cluster.costPerHour * 24)}</KeyValue>
          <KeyValue label="Monthly (30d)">{compactUsd(cluster.costPerHour * 24 * 30)}</KeyValue>
          <KeyValue label="Cost center">{team?.name ?? "—"}</KeyValue>
        </Panel>
        <Panel title="Control plane" subtitle="Live orchestration switches">
          <ToggleRow
            label="Autoscaling"
            hint="Reconcile capacity toward the 70–85% utilization band"
            value={settings?.autoscaling ?? false}
            onChange={(v) => actions.setClusterSetting(clusterId, "autoscaling", v)}
          />
          <ToggleRow
            label="Power steering"
            hint="Shed GPU load when rack power budgets are exceeded"
            value={settings?.powerSteering ?? false}
            onChange={(v) => actions.setClusterSetting(clusterId, "powerSteering", v)}
          />
          <ToggleRow
            label="Preemption"
            hint="Allow low-priority spot work to be checkpointed and requeued"
            value={settings?.preemption ?? false}
            onChange={(v) => actions.setClusterSetting(clusterId, "preemption", v)}
          />
          <ToggleRow
            label="MIG partitioning"
            hint="Enable Multi-Instance GPU fractional slicing"
            value={settings?.migEnabled ?? false}
            onChange={(v) => actions.setClusterSetting(clusterId, "migEnabled", v)}
          />
          <div className="mt-3">
            <p className="mb-1 text-[11px] uppercase tracking-wider text-ink-500">Tenant isolation</p>
            <select
              value={settings?.isolation ?? "namespace"}
              onChange={(e) => actions.setClusterSetting(clusterId, "isolation", e.target.value as "namespace" | "vlan" | "physical")}
              className="w-full rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2 text-sm text-ink-200 outline-none"
            >
              <option value="namespace">Namespace isolation</option>
              <option value="vlan">VLAN segmentation</option>
              <option value="physical">Physical isolation</option>
            </select>
          </div>
        </Panel>

        <Panel title="Resilience" subtitle="Failure and maintenance policy">
          <KeyValue label="Node drain">Graceful with job requeue</KeyValue>
          <KeyValue label="Checkpointing">Every {settings?.checkpointMinutes ?? 15} min to Lustre</KeyValue>
          <KeyValue label="Auto-recovery">{settings?.autoscaling ? "Enabled" : "Manual"}</KeyValue>
          <KeyValue label="Maintenance window">{settings?.maintenanceWindow ?? "—"}</KeyValue>
          <KeyValue label="Max job runtime">{duration(settings?.maxJobRuntimeSec ?? 259200)}</KeyValue>
          <KeyValue label="Default partition">{settings?.defaultPartition ?? "—"}</KeyValue>
          <KeyValue label="Spare capacity">5% reserved</KeyValue>
        </Panel>
        <Panel title="Maintenance windows" subtitle="Scheduled operations">
          <div className="flex flex-col gap-2 text-xs text-ink-400">
            <div className="flex items-center justify-between rounded-lg border border-ink-700/60 bg-ink-900/40 p-2.5">
              <span>Driver / CUDA stack upgrade</span>
              <Badge tone="cyan">Sun 02:00</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-ink-700/60 bg-ink-900/40 p-2.5">
              <span>Fabric firmware sweep</span>
              <Badge tone="neutral">Monthly</Badge>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between gap-3 border-b border-ink-700/40 py-2.5 text-left last:border-0"
    >
      <span className="min-w-0">
        <span className="block text-xs font-medium text-ink-200">{label}</span>
        <span className="block text-[11px] text-ink-500">{hint}</span>
      </span>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${value ? "bg-nv-500" : "bg-ink-600"}`}
      >
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${value ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
      </span>
    </button>
  );
}
