"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { GpuBadge } from "@/components/ui/domain";
import { Icon } from "@/components/ui/icons";
import { Badge, Button, KeyValue, Panel, ProgressBar } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { CLUSTER_KINDS, FABRICS, GPU_CATALOG } from "@/lib/constants";
import { compact, compactUsd, num, pct } from "@/lib/format";
import { useSim } from "@/lib/store";
import type { ClusterKind, Orchestrator, ProvisionRequest } from "@/lib/types";

const STEPS = ["Placement", "Hardware", "Network", "Review"];

export default function ProvisionPage() {
  const router = useRouter();
  const { state, actions } = useSim();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<{
    name: string;
    regionId: string;
    kind: ClusterKind;
    orchestrator: Orchestrator;
    gpuModelId: string;
    gpuCount: number;
    gpusPerNode: number;
    fabric: string;
    ownerTeamId: string;
    tags: string[];
  }>({
    name: "aurora-ii",
    regionId: state.regions[0]?.id ?? "us-west-1",
    kind: "DGX SuperPOD",
    orchestrator: "Base Command",
    gpuModelId: "b200",
    gpuCount: 256,
    gpusPerNode: 8,
    fabric: FABRICS[1],
    ownerTeamId: state.teams[0]?.id ?? "team-0",
    tags: ["production"],
  });

  const region = state.regions.find((r) => r.id === form.regionId);
  const spec = GPU_CATALOG.find((g) => g.id === form.gpuModelId)!;
  const nodeCount = Math.max(2, Math.round(form.gpuCount / form.gpusPerNode));
  const powerKw = (form.gpuCount * spec.typicalPowerW) / 1000;
  const costPerHour = form.gpuCount * spec.msrpPerGpuHour;

  const regionLoad = useMemo(() => {
    const clusters = state.clusters.filter((c) => c.regionId === form.regionId);
    const gpus = clusters.reduce((s, c) => s + c.gpuCount, 0);
    return { clusters: clusters.length, gpus };
  }, [state.clusters, form.regionId]);

  const kindDef = CLUSTER_KINDS.find((k) => k.kind === form.kind)!;

  const valid = form.name.trim().length > 1 && form.gpuCount >= 8;

  function submit() {
    if (!valid) return;
    setSubmitting(true);
    const request: ProvisionRequest = {
      name: form.name.trim(),
      regionId: form.regionId,
      zone: region?.zones[0] ?? "a",
      kind: form.kind,
      orchestrator: form.orchestrator,
      gpuModelId: form.gpuModelId,
      gpuCount: form.gpuCount,
      gpusPerNode: form.gpusPerNode,
      fabric: form.fabric,
      tags: form.tags,
      ownerTeamId: form.ownerTeamId,
    };
    const id = actions.createCluster(request);
    setTimeout(() => router.push(`/clusters/${id}`), 400);
  }

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 p-5 lg:p-7">
      <PageHeader
        title="Provision Cluster"
        subtitle="Declare a new accelerated cluster. The control plane drives bare-metal imaging, driver install and scheduler bootstrap."
      />

      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => setStep(i)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition",
                i === step ? "bg-nv-500/15 text-nv-200" : i < step ? "text-ink-300" : "text-ink-500"
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                  i < step ? "bg-nv-500 text-ink-950 dark:text-ink-950" : i === step ? "border border-nv-500 text-nv-200" : "border border-ink-600 text-ink-500"
                )}
              >
                {i < step ? "✓" : i + 1}
              </span>
              {label}
            </button>
            {i < STEPS.length - 1 && <div className={cn("h-px flex-1", i < step ? "bg-nv-500/40" : "bg-ink-700")} />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          {step === 0 && (
            <Panel title="Placement" subtitle="Choose where the cluster lands and its orchestration profile">
              <Field label="Cluster name">
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. aurora-ii"
                  className="w-full rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2 text-sm text-ink-200 outline-none focus:border-nv-500/50"
                />
              </Field>

              <p className="mb-2 mt-5 text-[11px] uppercase tracking-wider text-ink-500">Region</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {state.regions.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setForm({ ...form, regionId: r.id })}
                    className={cn(
                      "rounded-lg border p-3 text-left transition",
                      form.regionId === r.id ? "border-nv-500/60 bg-nv-500/10" : "border-ink-700 bg-ink-900/40 hover:border-ink-600"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-ink-100">{r.city}</span>
                      <Badge tone={r.tier === "flagship" ? "green" : r.tier === "standard" ? "cyan" : "neutral"}>{r.tier}</Badge>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-ink-500">{r.id} · PUE {r.pue}</p>
                    <p className="mt-1 text-[11px] text-ink-400">
                      {r.renewablePct}% renewable · {r.carbonIntensity} gCO₂/kWh
                    </p>
                  </button>
                ))}
              </div>

              <p className="mb-2 mt-5 text-[11px] uppercase tracking-wider text-ink-500">Cluster profile</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {CLUSTER_KINDS.map((k) => (
                  <button
                    key={k.kind}
                    type="button"
                    onClick={() => setForm({ ...form, kind: k.kind as ClusterKind, orchestrator: k.orchestrator })}
                    className={cn(
                      "rounded-lg border p-3 text-left transition",
                      form.kind === k.kind ? "border-nv-500/60 bg-nv-500/10" : "border-ink-700 bg-ink-900/40 hover:border-ink-600"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-ink-100">{k.kind}</span>
                      <Badge tone="neutral">{k.orchestrator}</Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-ink-500">{k.blurb}</p>
                  </button>
                ))}
              </div>
            </Panel>
          )}

          {step === 1 && (
            <Panel title="Hardware" subtitle="Select accelerator generation and capacity">
              <p className="mb-2 text-[11px] uppercase tracking-wider text-ink-500">Accelerator</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {GPU_CATALOG.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setForm({ ...form, gpuModelId: g.id, gpusPerNode: g.id === "gb200" ? 4 : 8 })}
                    className={cn(
                      "rounded-lg border p-3 text-left transition",
                      form.gpuModelId === g.id ? "border-nv-500/60 bg-nv-500/10" : "border-ink-700 bg-ink-900/40 hover:border-ink-600"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-ink-100">{g.name.replace("NVIDIA ", "")}</span>
                      <Badge tone={g.tier === "flagship" ? "violet" : g.tier === "workhorse" ? "green" : "cyan"}>{g.tier}</Badge>
                    </div>
                    <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-ink-500">
                      <span>{g.arch}</span>
                      <span>{g.memoryGb} GB HBM</span>
                      <span>{g.fp16Tflops} TFLOPS (FP16)</span>
                      <span>{g.interconnect}</span>
                    </div>
                    <p className="mt-1.5 font-mono text-[11px] text-nv-300">{compactUsd(g.msrpPerGpuHour)}/GPU/h</p>
                  </button>
                ))}
              </div>

              <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label={`Total GPUs: ${num(form.gpuCount)}`}>
                  <input
                    type="range"
                    min={8}
                    max={8192}
                    step={form.gpusPerNode}
                    value={form.gpuCount}
                    onChange={(e) => setForm({ ...form, gpuCount: Number(e.target.value) })}
                    className="w-full"
                  />
                </Field>
                <Field label="GPUs per node">
                  <div className="flex gap-2">
                    {[4, 8].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setForm({ ...form, gpusPerNode: n })}
                        className={cn(
                          "flex-1 rounded-lg border py-2 text-sm",
                          form.gpusPerNode === n ? "border-nv-500/60 bg-nv-500/10 text-nv-200" : "border-ink-700 text-ink-400"
                        )}
                      >
                        {n}×
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Mini label="Nodes" value={num(nodeCount)} />
                <Mini label="CPU cores" value={num(nodeCount * (spec.tier === "flagship" ? 192 : 128))} />
                <Mini label="System RAM" value={`${compact(nodeCount * (spec.tier === "flagship" ? 2048 : 1024))} GB`} />
                <Mini label="Power draw" value={`${powerKw.toFixed(0)} kW`} />
              </div>
            </Panel>
          )}

          {step === 2 && (
            <Panel title="Network & tenancy" subtitle="Interconnect fabric and ownership">
              <p className="mb-2 text-[11px] uppercase tracking-wider text-ink-500">Interconnect</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {FABRICS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setForm({ ...form, fabric: f })}
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-3 text-left text-sm transition",
                      form.fabric === f ? "border-nv-500/60 bg-nv-500/10 text-nv-200" : "border-ink-700 bg-ink-900/40 text-ink-300 hover:border-ink-600"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Icon name="network" size={15} />
                      {f}
                    </span>
                    {form.fabric === f && <Icon name="check" size={15} className="text-nv-400" />}
                  </button>
                ))}
              </div>

              <p className="mb-2 mt-5 text-[11px] uppercase tracking-wider text-ink-500">Owner team</p>
              <select
                value={form.ownerTeamId}
                onChange={(e) => setForm({ ...form, ownerTeamId: e.target.value })}
                className="w-full rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2 text-sm text-ink-200 outline-none"
              >
                {state.teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>

              <p className="mb-2 mt-5 text-[11px] uppercase tracking-wider text-ink-500">Tags</p>
              <div className="flex flex-wrap gap-2">
                {["production", "research", "confidential", "burst", "multi-tenant", "pilot"].map((tag) => {
                  const active = form.tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          tags: active ? form.tags.filter((t) => t !== tag) : [...form.tags, tag],
                        })
                      }
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition",
                        active ? "border-nv-500/50 bg-nv-500/10 text-nv-200" : "border-ink-700 text-ink-400 hover:border-ink-600"
                      )}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </Panel>
          )}

          {step === 3 && (
            <Panel title="Review & provision" subtitle="Confirm the specification before the control plane begins">
              <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
                <div>
                  <KeyValue label="Cluster name">{form.name}</KeyValue>
                  <KeyValue label="Profile">{form.kind}</KeyValue>
                  <KeyValue label="Orchestrator">{form.orchestrator}</KeyValue>
                  <KeyValue label="Region">{region?.city} · {form.regionId}</KeyValue>
                  <KeyValue label="Zone">{region?.zones[0]}</KeyValue>
                  <KeyValue label="Fabric">{form.fabric}</KeyValue>
                </div>
                <div>
                  <KeyValue label="Accelerator">{spec.name}</KeyValue>
                  <KeyValue label="GPU count">{num(form.gpuCount)}</KeyValue>
                  <KeyValue label="GPUs / node">{form.gpusPerNode}</KeyValue>
                  <KeyValue label="Nodes">{num(nodeCount)}</KeyValue>
                  <KeyValue label="Power">{powerKw.toFixed(0)} kW</KeyValue>
                  <KeyValue label="Owner team">{state.teams.find((t) => t.id === form.ownerTeamId)?.name}</KeyValue>
                </div>
              </div>
              <div className="mt-4 rounded-lg border border-nv-500/30 bg-nv-500/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-ink-200">Estimated run-rate</p>
                    <p className="text-[11px] text-ink-500">Based on synthetic list pricing · {compactUsd(spec.msrpPerGpuHour)}/GPU/h</p>
                  </div>
                  <p className="font-mono text-2xl font-semibold text-nv-300">{compactUsd(costPerHour)}<span className="text-sm text-ink-400">/h</span></p>
                </div>
              </div>
            </Panel>
          )}

          <div className="flex items-center justify-between">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
              <Icon name="chevron" size={14} className="rotate-180" /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button variant="primary" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
                Continue <Icon name="chevron" size={14} />
              </Button>
            ) : (
              <Button variant="primary" disabled={!valid || submitting} onClick={submit}>
                <Icon name="rocket" size={15} /> {submitting ? "Provisioning…" : "Provision cluster"}
              </Button>
            )}
          </div>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <Panel title="Live specification" subtitle="Updates as you configure">
            <div className="flex items-center justify-between">
              <GpuBadge gpuModelId={form.gpuModelId} count={form.gpuCount} />
              <Badge tone="neutral">{form.kind}</Badge>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="text-ink-400">Region capacity after deploy</span>
                <span className="font-mono text-ink-300">{compact(regionLoad.gpus + form.gpuCount)} GPUs</span>
              </div>
              <ProgressBar value={Math.min(1, (regionLoad.gpus + form.gpuCount) / 8192)} />
              <p className="mt-1 text-[10px] text-ink-500">
                {regionLoad.clusters} existing clusters in {region?.city}
              </p>
            </div>
            <div className="mt-4">
              <KeyValue label="Nodes">{num(nodeCount)}</KeyValue>
              <KeyValue label="GPUs">{num(form.gpuCount)}</KeyValue>
              <KeyValue label="HBM total">{compact(form.gpuCount * spec.memoryGb)} GB</KeyValue>
              <KeyValue label="FP16 peak">{compact(form.gpuCount * spec.fp16Tflops)} TFLOPS</KeyValue>
              <KeyValue label="Fabric">{form.fabric}</KeyValue>
              <KeyValue label="Power">{powerKw.toFixed(0)} kW</KeyValue>
              <KeyValue label="Run-rate">{compactUsd(costPerHour)}/h</KeyValue>
            </div>
            <div className="mt-4 rounded-lg border border-ink-700/60 bg-ink-900/40 p-3 text-[11px] text-ink-500">
              <p className="flex items-center gap-1.5 text-ink-300">
                <Icon name="clock" size={13} className="text-vol-teal" /> Est. provisioning time
              </p>
              <p className="mt-1">~{Math.max(4, Math.round(nodeCount * 0.6))} minutes for imaging, drivers and scheduler bootstrap.</p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-ink-500">{label}</span>
      {children}
    </label>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink-700/60 bg-ink-900/40 p-3">
      <p className="text-[10px] uppercase tracking-wider text-ink-500">{label}</p>
      <p className="mt-0.5 font-mono text-sm text-ink-100">{value}</p>
    </div>
  );
}
