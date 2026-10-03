"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Icon } from "@/components/ui/icons";
import { Badge, Button, EmptyState, Panel, ProgressBar, StatTile } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { DEFAULT_PARTITIONS } from "@/lib/constants";
import { dateTime } from "@/lib/format";
import { useSim } from "@/lib/store";
import type { ClusterConfig, JobPriority } from "@/lib/types";

const CUDA_VERSIONS = ["12.4", "12.5", "12.6", "12.9"];
const DRIVER_VERSIONS = ["550.54", "555.42", "560.28", "570.10"];
const MIG_PROFILES = ["1g.10gb", "2g.20gb", "3g.40gb", "7g.80gb"];

type Draft = Omit<ClusterConfig, "id" | "createdAt" | "updatedAt">;

function blankDraft(clusterId: string): Draft {
  return {
    name: "",
    clusterId,
    partition: DEFAULT_PARTITIONS[0],
    gpuClockCapMhz: 1980,
    powerCapPct: 100,
    migEnabled: false,
    migProfile: "1g.10gb",
    cudaVersion: "12.6",
    driverVersion: "560.28",
    ncclEnabled: true,
    gdrEnabled: false,
    egressLimitGb: 1000,
    priorityClass: "normal",
    preemptible: false,
    validate: true,
  };
}

export default function ConfigsPage() {
  const { state, actions } = useSim();
  const [clusterFilter, setClusterFilter] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => blankDraft(state.clusters[0]?.id ?? ""));

  const configs = useMemo(
    () =>
      state.configs
        .filter((c) => (clusterFilter === "all" ? true : c.clusterId === clusterFilter))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [state.configs, clusterFilter]
  );

  const active = state.configs.length;
  const validating = state.configs.filter((c) => c.validate).length;
  const migCount = state.configs.filter((c) => c.migEnabled).length;
  const gdrCount = state.configs.filter((c) => c.gdrEnabled).length;

  function submitDraft() {
    if (!draft.name.trim() || !draft.clusterId) return;
    if (editingId) {
      actions.updateConfig(editingId, draft);
    } else {
      actions.createConfig(draft);
    }
    setEditingId(null);
    setCreating(false);
  }

  function beginCreate() {
    setDraft(blankDraft(clusterFilter === "all" ? state.clusters[0]?.id ?? "" : clusterFilter));
    setEditingId(null);
    setCreating(true);
  }

  function beginEdit(config: ClusterConfig) {
    const { id, createdAt, updatedAt, ...rest } = config;
    void id;
    void createdAt;
    void updatedAt;
    setDraft(rest);
    setEditingId(config.id);
    setCreating(true);
  }

  const editing = creating;

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-5 lg:p-7">
      <PageHeader
        title="Cluster Configuration Manager"
        subtitle="Create, edit, validate and apply named hardware & runtime profiles. Configs bind CUDA, driver, MIG, clock/power caps and scheduler policy to a cluster."
        actions={
          <>
            <select
              value={clusterFilter}
              onChange={(e) => setClusterFilter(e.target.value)}
              className="rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2 text-sm text-ink-200 outline-none"
            >
              <option value="all">All clusters</option>
              {state.clusters.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <Button variant="primary" onClick={beginCreate}>
              <Icon name="plus" size={15} /> New config
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Configs" value={String(active)} accent="#76b900" icon={<Icon name="settings" size={16} />} />
        <StatTile label="Validated" value={String(validating)} accent="#22d3ee" icon={<Icon name="check" size={16} />} />
        <StatTile label="MIG profiles" value={String(migCount)} accent="#a855f7" icon={<Icon name="layers" size={16} />} />
        <StatTile label="GPUDirect Storage" value={String(gdrCount)} accent="#f59e0b" icon={<Icon name="storage" size={16} />} />
      </div>

      {editing && (
        <Panel
          title={editingId ? "Edit configuration" : "New configuration"}
          subtitle="Define the profile; validate then save"
          actions={
            <Button size="sm" variant="ghost" onClick={() => { setCreating(false); setEditingId(null); }}>
              <Icon name="close" size={14} /> Cancel
            </Button>
          }
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Config name">
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. helios-throughput-prod"
                className="w-full rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2 text-sm text-ink-200 outline-none focus:border-nv-500/50"
              />
            </Field>
            <Field label="Cluster">
              <select
                value={draft.clusterId}
                onChange={(e) => setDraft({ ...draft, clusterId: e.target.value })}
                className="w-full rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2 text-sm text-ink-200 outline-none"
              >
                {state.clusters.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Default partition">
              <select
                value={draft.partition}
                onChange={(e) => setDraft({ ...draft, partition: e.target.value })}
                className="w-full rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2 text-sm text-ink-200 outline-none"
              >
                {DEFAULT_PARTITIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </Field>

            <Field label="CUDA version">
              <select value={draft.cudaVersion} onChange={(e) => setDraft({ ...draft, cudaVersion: e.target.value })} className="w-full rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2 text-sm text-ink-200 outline-none">
                {CUDA_VERSIONS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="Driver version">
              <select value={draft.driverVersion} onChange={(e) => setDraft({ ...draft, driverVersion: e.target.value })} className="w-full rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2 text-sm text-ink-200 outline-none">
                {DRIVER_VERSIONS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="Priority class">
              <select value={draft.priorityClass} onChange={(e) => setDraft({ ...draft, priorityClass: e.target.value as JobPriority })} className="w-full rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2 text-sm text-ink-200 outline-none">
                {(["low", "normal", "high", "urgent"] as JobPriority[]).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>

            <Field label={`GPU clock cap: ${draft.gpuClockCapMhz} MHz`}>
              <input type="range" min={900} max={2100} step={30} value={draft.gpuClockCapMhz} onChange={(e) => setDraft({ ...draft, gpuClockCapMhz: Number(e.target.value) })} className="w-full" />
            </Field>
            <Field label={`Power cap: ${draft.powerCapPct}%`}>
              <input type="range" min={50} max={100} step={5} value={draft.powerCapPct} onChange={(e) => setDraft({ ...draft, powerCapPct: Number(e.target.value) })} className="w-full" />
            </Field>
            <Field label={`Egress limit: ${draft.egressLimitGb} GB`}>
              <input type="range" min={100} max={10000} step={100} value={draft.egressLimitGb} onChange={(e) => setDraft({ ...draft, egressLimitGb: Number(e.target.value) })} className="w-full" />
            </Field>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <ToggleField label="Enable MIG" value={draft.migEnabled} onChange={(v) => setDraft({ ...draft, migEnabled: v })} />
            <ToggleField label="NCCL" value={draft.ncclEnabled} onChange={(v) => setDraft({ ...draft, ncclEnabled: v })} />
            <ToggleField label="GPUDirect Storage" value={draft.gdrEnabled} onChange={(v) => setDraft({ ...draft, gdrEnabled: v })} />
            <ToggleField label="Preemptible" value={draft.preemptible} onChange={(v) => setDraft({ ...draft, preemptible: v })} />
          </div>

          {draft.migEnabled && (
            <div className="mt-4">
              <Field label="MIG profile">
                <div className="flex flex-wrap gap-2">
                  {MIG_PROFILES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setDraft({ ...draft, migProfile: p })}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-mono",
                        draft.migProfile === p ? "border-nv-500/60 bg-nv-500/10 text-nv-200" : "border-ink-700 text-ink-400"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink-700/50 pt-3">
            <label className="flex items-center gap-2 text-xs text-ink-400">
              <input type="checkbox" checked={draft.validate} onChange={(e) => setDraft({ ...draft, validate: e.target.checked })} className="accent-nv-500" />
              Validate config against cluster hardware before applying
            </label>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setDraft({ ...blankDraft(draft.clusterId) })}>
                Reset
              </Button>
              <Button variant="primary" onClick={submitDraft} disabled={!draft.name.trim()}>
                <Icon name="check" size={14} /> {editingId ? "Save changes" : "Create config"}
              </Button>
            </div>
          </div>
        </Panel>
      )}

      {configs.length === 0 ? (
        <EmptyState title="No configuration profiles" hint="Create one to bind hardware & runtime settings to a cluster." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {configs.map((config) => {
            const cluster = state.clusters.find((c) => c.id === config.clusterId);
            return (
              <div key={config.id} className="flex flex-col rounded-xl border border-ink-700/80 bg-ink-850/70 p-4 shadow-panel">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-semibold text-ink-100">{config.name}</p>
                    <p className="mt-0.5 truncate text-[11px] text-ink-500">
                      {cluster ? (
                        <Link href={`/clusters/${config.clusterId}/settings`} className="text-nv-300 hover:underline">
                          {cluster.name}
                        </Link>
                      ) : (
                        "—"
                      )}{" "}
                      · {config.partition}
                    </p>
                  </div>
                  <Badge tone={config.validate ? "green" : "amber"}>{config.validate ? "validated" : "unvalidated"}</Badge>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-ink-400">
                  <span>CUDA <span className="float-right font-mono text-ink-200">{config.cudaVersion}</span></span>
                  <span>Driver <span className="float-right font-mono text-ink-200">{config.driverVersion}</span></span>
                  <span>Clock cap <span className="float-right font-mono text-ink-200">{config.gpuClockCapMhz} MHz</span></span>
                  <span>Power cap <span className="float-right font-mono text-ink-200">{config.powerCapPct}%</span></span>
                  <span>Priority <span className="float-right font-mono text-ink-200">{config.priorityClass}</span></span>
                  <span>Egress <span className="float-right font-mono text-ink-200">{config.egressLimitGb} GB</span></span>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {config.migEnabled && <Badge tone="violet">MIG {config.migProfile}</Badge>}
                  {config.ncclEnabled && <Badge tone="cyan">NCCL</Badge>}
                  {config.gdrEnabled && <Badge tone="blue">GDR</Badge>}
                  {config.preemptible && <Badge tone="amber">preemptible</Badge>}
                </div>

                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[10px] text-ink-500">
                    <span>Power envelope</span>
                    <span className="font-mono">{config.powerCapPct}%</span>
                  </div>
                  <ProgressBar value={config.powerCapPct / 100} color="#f59e0b" />
                </div>

                <p className="mt-2 text-[10px] text-ink-600">updated {dateTime(config.updatedAt)}</p>

                <div className="mt-3 flex items-center gap-2 border-t border-ink-700/50 pt-3">
                  <Button size="sm" variant="primary" onClick={() => actions.applyConfig(config.id)}>
                    <Icon name="rocket" size={13} /> Apply
                  </Button>
                  <Button size="sm" variant="default" onClick={() => beginEdit(config)}>
                    <Icon name="settings" size={13} /> Edit
                  </Button>
                  <Button size="sm" variant="danger" className="ml-auto" onClick={() => actions.deleteConfig(config.id)}>
                    <Icon name="trash" size={13} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
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

function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        "flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition",
        value ? "border-nv-500/50 bg-nv-500/10 text-nv-200" : "border-ink-700 bg-ink-900/40 text-ink-400"
      )}
    >
      {label}
      <span className={cn("relative inline-flex h-4 w-7 items-center rounded-full transition-colors", value ? "bg-nv-500" : "bg-ink-600")}>
        <span className={cn("inline-block h-3 w-3 transform rounded-full bg-white transition-transform", value ? "translate-x-[13px]" : "translate-x-[3px]")} />
      </span>
    </button>
  );
}
