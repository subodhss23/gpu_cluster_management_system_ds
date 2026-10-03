"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { GPU_BY_ID } from "@/lib/constants";
import { hashString, Rng } from "@/lib/rng";
import { advance } from "@/lib/synth/engine";
import { generateState } from "@/lib/synth/generator";
import type {
  ActivityEvent,
  Alert,
  Cluster,
  ClusterConfig,
  ClusterNode,
  ClusterSettings,
  GpuDevice,
  Job,
  JobPriority,
  ProvisionRequest,
  Quota,
  RemediationKind,
  RemediationStep,
  SimState,
} from "@/lib/types";
import { runbookForCode } from "@/lib/runbooks";
import { capture, captureClusterEvent } from "@/lib/analytics";

function blankGpu(index: number, gpuModelId: string): GpuDevice {
  const spec = GPU_BY_ID[gpuModelId];
  return {
    index,
    utilPct: 0,
    memUsedGb: 0,
    memTotalGb: spec.memoryGb,
    tempC: 32,
    powerW: 90,
    smClockMhz: 345,
    memClockMhz: 2619,
    xidErrors: 0,
    eccErrors: 0,
    throttle: "none",
    migMode: "disabled",
  };
}

export interface SimActions {
  toggleRunning: () => void;
  setSpeed: (speed: number) => void;
  regenerate: (seed?: number) => void;
  createCluster: (request: ProvisionRequest) => string;
  deleteCluster: (clusterId: string) => void;
  scaleCluster: (clusterId: string, gpuCount: number) => void;
  submitJob: (input: {
    name: string;
    userId: string;
    clusterId: string;
    partition: string;
    nodesRequested: number;
    gpusRequested: number;
    priority: JobPriority;
    framework: string;
  }) => string;
  setJobState: (jobId: string, state: Job["state"]) => void;
  setJobPriority: (jobId: string, priority: JobPriority) => void;
  acknowledgeAlert: (alertId: string) => void;
  resolveAlert: (alertId: string) => void;
  acknowledgeAllAlerts: (clusterId?: string) => void;
  drainNode: (nodeId: string) => void;
  restoreNode: (nodeId: string) => void;
  setUserStatus: (userId: string, status: "active" | "suspended") => void;
  setTeamQuota: (teamId: string, quota: Partial<Quota>) => void;
  setClusterSetting: <K extends keyof ClusterSettings>(clusterId: string, key: K, value: ClusterSettings[K]) => void;
  applyRemediationStep: (alertId: string, stepIndex: number) => void;
  autoRemediate: (alertId: string) => void;
  remediateAll: (clusterId?: string) => void;
  rebootNode: (nodeId: string) => void;
  resetNodeErrors: (nodeId: string) => void;
  resetClusterFabric: (clusterId: string) => void;
  throttleNodeClock: (nodeId: string, capMhz: number) => void;
  capNodePower: (nodeId: string, pct: number) => void;
  migrateClusterJobs: (clusterId: string) => void;
  killIdleJobs: (clusterId?: string) => void;
  createConfig: (config: Omit<ClusterConfig, "id" | "createdAt" | "updatedAt">) => string;
  updateConfig: (configId: string, patch: Partial<ClusterConfig>) => void;
  deleteConfig: (configId: string) => void;
  applyConfig: (configId: string) => void;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
  markAllNotificationsRead: () => void;
  togglePin: (clusterId: string) => void;
  setClusterNotes: (clusterId: string, notes: string) => void;
}

interface SimContextValue {
  state: SimState;
  actions: SimActions;
}

const SimContext = createContext<SimContextValue | null>(null);

function applyStepEffect(
  state: SimState,
  alert: Alert,
  step: RemediationStep
): SimState {
  const node = alert.nodeId ? state.nodes.find((n) => n.id === alert.nodeId) : undefined;
  const clusterId = alert.clusterId;
  const now = Date.now();

  const setNode = (mutate: (node: ClusterNode) => ClusterNode): SimState => ({
    ...state,
    nodes: state.nodes.map((n) => (n.id === alert.nodeId ? mutate(n) : n)),
  });

  switch (step.kind) {
    case "drain-node":
      if (!alert.nodeId) return state;
      return setNode((n) => ({
        ...n,
        status: "warning",
        cpuUtilPct: 3,
        gpus: n.gpus.map((g) => ({ ...g, utilPct: 0, powerW: 90 })),
      }));
    case "reboot-node":
      if (!alert.nodeId) return state;
      return setNode((n) => ({
        ...n,
        status: "warning",
        uptimeHours: 0,
        gpus: n.gpus.map((g) => ({ ...g, utilPct: 0, powerW: 90, tempC: 32, throttle: "none", smClockMhz: 345 })),
      }));
    case "clear-xid":
      if (!alert.nodeId) return state;
      return setNode((n) => ({ ...n, status: "healthy", gpus: n.gpus.map((g) => ({ ...g, xidErrors: 0, throttle: "none" })) }));
    case "reset-ecc":
      if (!alert.nodeId) return state;
      return setNode((n) => ({ ...n, status: "healthy", gpus: n.gpus.map((g) => ({ ...g, eccErrors: 0 })) }));
    case "reset-fabric":
      return {
        ...state,
        fabrics: state.fabrics.map((f) =>
          f.clusterId === clusterId
            ? { ...f, status: "healthy", errors: 0, portsUp: f.portsTotal, latencyUs: Math.min(f.latencyUs, 1.2) }
            : f
        ),
      };
    case "throttle-clock":
      if (!alert.nodeId) return state;
      return setNode((n) => ({
        ...n,
        gpus: n.gpus.map((g) => ({ ...g, smClockMhz: Math.min(g.smClockMhz, 1600), tempC: Math.max(32, g.tempC - 6), throttle: "none" })),
      }));
    case "cap-power":
      if (!alert.nodeId) return state;
      return setNode((n) => ({
        ...n,
        status: "healthy",
        powerW: Math.round(n.powerW * 0.8),
        gpus: n.gpus.map((g) => ({ ...g, powerW: Math.round(g.powerW * 0.8), tempC: Math.max(32, g.tempC - 4), throttle: "none" })),
      }));
    case "raise-thermal-margin":
      return {
        ...state,
        racks: {
          ...state.racks,
          [clusterId]: (state.racks[clusterId] ?? []).map((r) => ({
            ...r,
            inletTempC: Math.max(17, r.inletTempC - 2),
            airflowCfm: Math.round(r.airflowCfm * 1.15),
            status: r.status === "critical" ? "warning" : "healthy",
          })),
        },
      };
    case "toggle-power-steering":
      return {
        ...state,
        settings: {
          ...state.settings,
          [clusterId]: { ...state.settings[clusterId], powerSteering: true },
        },
      };
    case "enable-preemption":
      return {
        ...state,
        settings: {
          ...state.settings,
          [clusterId]: { ...state.settings[clusterId], preemption: true },
        },
      };
    case "migrate-jobs":
    case "requeue-jobs":
      return {
        ...state,
        jobs: state.jobs.map((j) =>
          j.clusterId === clusterId && (j.state === "running" || (step.kind === "migrate-jobs" && j.state === "failed"))
            ? { ...j, state: "pending", startedAt: undefined, migrating: false }
            : j
        ),
      };
    case "scale-out":
      return {
        ...state,
        clusters: state.clusters.map((c) =>
          c.id === clusterId ? { ...c, gpuCount: Math.round(c.gpuCount * 1.15), nodeCount: Math.ceil(c.nodeCount * 1.15) } : c
        ),
      };
    case "kill-idle-jobs": {
      const targets = new Set(
        state.jobs
          .filter((j) => j.clusterId === clusterId && (j.state === "running" || j.state === "pending") && (j.progress < 0.05 || j.priority === "low"))
          .map((j) => j.id)
      );
      return {
        ...state,
        jobs: state.jobs.map((j) => (targets.has(j.id) ? { ...j, state: "cancelled", endedAt: now } : j)),
      };
    }
    case "acknowledge":
    default:
      return state;
  }
}

function applyStep(prev: SimState, alertId: string, stepIndex: number): SimState {
  const alert = prev.alerts.find((a) => a.id === alertId);
  if (!alert) return prev;
  const steps = runbookForCode(alert.code).steps;
  if (stepIndex < 0 || stepIndex >= steps.length) return prev;
  if (stepIndex < alert.remediatedSteps) return prev;

  // Apply the effect to the world, then mark the step done.
  let next: SimState = applyStepEffect(prev, alert, steps[stepIndex]);
  const remaining = alert.remediationSteps.length - (stepIndex + 1);
  const doneCount = stepIndex + 1;
  const total = Math.max(1, alert.remediationSteps.length);
  const resolved = remaining <= 0;
  next = {
    ...next,
    alerts: next.alerts.map((a) =>
      a.id === alertId
        ? {
            ...a,
            remediatedSteps: doneCount,
            state: resolved ? "resolved" : "acknowledged",
          }
        : a
    ),
    activity: [
      activity(
        "health",
        `Remediation "${steps[stepIndex].label}" applied — ${resolved ? "issue resolved" : `${Math.round((doneCount / total) * 100)}% complete`}`,
        "operator",
        resolved ? "info" : "warning",
        alert.clusterId
      ),
      ...next.activity,
    ],
  };
  return next;
}

function applyConfigToState(prev: SimState, configId: string): SimState {
  const config = prev.configs.find((c) => c.id === configId);
  if (!config) return prev;
  const settings = prev.settings[config.clusterId];
  const cluster = prev.clusters.find((c) => c.id === config.clusterId);
  return {
    ...prev,
    settings: settings
      ? {
          ...prev.settings,
          [config.clusterId]: {
            ...settings,
            migEnabled: config.migEnabled,
            preemption: config.preemptible,
            defaultPartition: config.partition,
          },
        }
      : prev.settings,
    configs: prev.configs.map((c) => (c.id === configId ? { ...c, updatedAt: Date.now() } : c)),
    activity: cluster
      ? [activity("cluster", `Config "${config.name}" applied to ${cluster.name}`, "operator", "info", config.clusterId), ...prev.activity]
      : prev.activity,
  };
}

function activity(
  kind: ActivityEvent["kind"],
  message: string,
  actor: string,
  severity: ActivityEvent["severity"] = "info",
  clusterId?: string
): ActivityEvent {
  return {
    id: `ev-${hashString(message + Math.random()).toString(36)}`,
    t: Date.now(),
    kind,
    severity,
    actor,
    message,
    clusterId,
  };
}

function BootScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-ink-950 bg-grid-fade">
      <div className="relative">
        <span className="absolute inset-0 animate-pulseRing rounded-2xl bg-nv-500/30" />
        <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-nv-500/40 bg-nv-500/10">
          <svg viewBox="0 0 24 24" className="h-8 w-8 text-nv-300" fill="currentColor">
            <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 3.2 5.5 3v6L12 17.4l-5.5-3.2v-6l5.5-3Z" />
            <circle cx="12" cy="12" r="2.4" />
          </svg>
        </span>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold tracking-tight text-ink-100">AetherGrid control plane</p>
        <p className="mt-1 text-xs text-ink-500">Discovering regions, clusters and accelerators…</p>
      </div>
      <div className="h-1 w-56 overflow-hidden rounded-full bg-ink-800">
        <div className="h-full w-1/2 animate-sweep rounded-full bg-gradient-to-r from-transparent via-nv-500 to-transparent" />
      </div>
    </div>
  );
}

export function SimProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SimState | null>(null);
  const rngRef = useRef<Rng | null>(null);
  const seedRef = useRef(20260402);

  useEffect(() => {
    const next = generateState(seedRef.current);
    try {
      const savedSpeed = Number(localStorage.getItem("aethergrid-speed"));
      if (savedSpeed > 0) next.speed = savedSpeed;
    } catch {
      /* ignore */
    }
    rngRef.current = new Rng(seedRef.current ^ 0x9e3779b9);
    setState(next);
  }, []);

  const running = state?.running ?? false;
  const speed = state?.speed ?? 1;

  useEffect(() => {
    if (!running || speed <= 0) return;
    const interval = window.setInterval(() => {
      setState((prev) => {
        if (!prev || !prev.running || !rngRef.current) return prev;
        return advance(prev, rngRef.current);
      });
    }, 1600 / speed);
    return () => window.clearInterval(interval);
  }, [running, speed]);

  const toggleRunning = useCallback(() => {
    setState((prev) => (prev ? { ...prev, running: !prev.running } : prev));
  }, []);

  const setSpeed = useCallback((nextSpeed: number) => {
    try {
      localStorage.setItem("aethergrid-speed", String(nextSpeed));
    } catch {
      /* ignore */
    }
    capture("simulation_speed_changed", { speed: nextSpeed });
    setState((prev) => (prev ? { ...prev, speed: nextSpeed, running: nextSpeed > 0 ? true : prev.running } : prev));
  }, []);

  const regenerate = useCallback((seed?: number) => {
    const nextSeed = seed ?? Math.floor(Math.random() * 1_000_000_000);
    seedRef.current = nextSeed;
    rngRef.current = new Rng(nextSeed ^ 0x9e3779b9);
    setState(generateState(nextSeed));
    capture("fleet_regenerated", { seed: nextSeed });
  }, []);

  const createCluster = useCallback((request: ProvisionRequest) => {
    const id = `cl-${request.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${hashString(
      request.name + Date.now()
    )
      .toString(36)
      .slice(0, 4)}`;
    setState((prev) => {
      if (!prev) return prev;
      const spec = GPU_BY_ID[request.gpuModelId];
      const nodeCount = Math.max(2, Math.round(request.gpuCount / request.gpusPerNode));
      const cluster: Cluster = {
        id,
        name: request.name,
        regionId: request.regionId,
        zone: request.zone,
        kind: request.kind,
        orchestrator: request.orchestrator,
        gpuModelId: request.gpuModelId,
        gpuCount: request.gpuCount,
        nodeCount,
        gpusPerNode: request.gpusPerNode,
        cpuCoresPerNode: spec.tier === "flagship" ? 192 : 128,
        memGbPerNode: spec.tier === "flagship" ? 2048 : 1024,
        localNvmeTbPerNode: 15.36,
        fabric: request.fabric,
        powerKw: +((request.gpuCount * spec.typicalPowerW) / 1000).toFixed(1),
        status: "provisioning",
        health: "provisioning",
        utilization: 0.02,
        memUtilization: 0.02,
        createdAt: Date.now(),
        provisionProgress: 4,
        tags: request.tags.length ? request.tags : ["new"],
        sla: 99.9,
        ownerTeamId: request.ownerTeamId,
        costPerHour: +(request.gpuCount * spec.msrpPerGpuHour).toFixed(2),
        pinned: false,
        notes: "",
      };
      const visible = Math.min(nodeCount, 28);
      const nodes: ClusterNode[] = [];
      for (let i = 0; i < visible; i++) {
        const hostname = `${request.name.slice(0, 3).toLowerCase()}-gpu-${String(Math.floor(i / 8) + 1).padStart(2, "0")}${String((i % 8) + 1).padStart(2, "0")}`;
        const gpus = Array.from({ length: request.gpusPerNode }, (_, g) => blankGpu(g, request.gpuModelId));
        nodes.push({
          id: `${id}-${hostname}`,
          hostname,
          clusterId: id,
          rack: `R${String(Math.floor(i / 8) + 1).padStart(2, "0")}`,
          slot: (i % 8) + 1,
          role: "gpu-worker",
          gpuModelId: request.gpuModelId,
          gpus,
          cpuCores: cluster.cpuCoresPerNode,
          cpuUtilPct: 2,
          memTotalGb: cluster.memGbPerNode,
          memUsedGb: 512,
          nvmeUsedTb: 0.4,
          nvmeTotalTb: cluster.localNvmeTbPerNode,
          netTxGbps: 0,
          netRxGbps: 0,
          status: "provisioning",
          uptimeHours: 0,
          powerW: 180,
        });
      }
      return {
        ...prev,
        clusters: [cluster, ...prev.clusters],
        nodes: [...nodes, ...prev.nodes],
        filesystems: [
          ...prev.filesystems,
          {
            id: `${id}-fs-0`,
            clusterId: id,
            name: `${request.name.toLowerCase()}-lustre-scratch`,
            type: "Lustre",
            capacityTb: 1200,
            usedTb: 0,
            readGbps: 0,
            writeGbps: 0,
            iops: 0,
            status: "healthy",
          },
        ],
        fabrics: [
          ...prev.fabrics,
          {
            id: `${id}-fab-compute`,
            clusterId: id,
            kind: "InfiniBand",
            portsTotal: Math.round(request.gpuCount * 1.5),
            portsUp: 0,
            bwTbps: 0,
            errors: 0,
            latencyUs: 0,
            status: "healthy",
          },
        ],
        history: { ...prev.history, [id]: [] },
        racks: {
          ...prev.racks,
          [id]: [
            {
              id: `${id}-R01`,
              clusterId: id,
              name: "R01",
              powerCapacityKw: Math.max(40, Math.round((request.gpuCount * spec.typicalPowerW) / 1000 / Math.max(1, Math.ceil(visible / 8))) * 1.3),
              inletTempC: 22,
              coolantTempC: 32,
              airflowCfm: 5000,
              status: "provisioning",
              nodeIds: nodes.map((n) => n.id),
            },
          ],
        },
        topology: {
          ...prev.topology,
          [id]: [
            {
              id: `${id}-block-0`,
              clusterId: id,
              name: "Block A",
              connectivity: request.fabric.includes("NVLink")
                ? "nvlink-domain"
                : request.fabric.includes("InfiniBand")
                  ? "infiniband-island"
                  : "ethernet-pod",
              nodeIds: nodes.map((n) => n.id),
              oversubscription: 1.5,
              bandwidthTbps: 120,
            },
          ],
        },
        settings: {
          ...prev.settings,
          [id]: {
            autoscaling: true,
            powerSteering: true,
            maintenanceWindow: "Sun 02:00 UTC",
            defaultPartition: "gpu-train",
            maxJobRuntimeSec: 259200,
            preemption: true,
            checkpointMinutes: 15,
            migEnabled: false,
            isolation: "namespace",
          },
        },
        metering: {
          ...prev.metering,
          [id]: { gpuHours24h: 0, storageTb: 0, egressGb24h: 0, reservedGpus: 0, spotGpus: 0 },
        },
        activity: [
          activity("provision", `Provisioning started for ${request.name} in ${request.regionId}`, "system", "info", id),
          ...prev.activity,
        ],
      };
    });
    capture("cluster_provisioned", {
      cluster_id: id,
      cluster_name: request.name,
      cluster_kind: request.kind,
      orchestrator: request.orchestrator,
      region_id: request.regionId,
      gpu_model: request.gpuModelId,
      gpu_count: request.gpuCount,
      gpus_per_node: request.gpusPerNode,
      fabric: request.fabric,
      owner_team: request.ownerTeamId,
    });
    return id;
  }, []);

  const deleteCluster = useCallback((clusterId: string) => {
    setState((prev) => {
      if (!prev) return prev;
      const cluster = prev.clusters.find((c) => c.id === clusterId);
      const history = { ...prev.history };
      delete history[clusterId];
      const racks = { ...prev.racks };
      delete racks[clusterId];
      const topology = { ...prev.topology };
      delete topology[clusterId];
      const settings = { ...prev.settings };
      delete settings[clusterId];
      const metering = { ...prev.metering };
      delete metering[clusterId];
      return {
        ...prev,
        clusters: prev.clusters.filter((c) => c.id !== clusterId),
        nodes: prev.nodes.filter((n) => n.clusterId !== clusterId),
        jobs: prev.jobs.filter((j) => j.clusterId !== clusterId),
        alerts: prev.alerts.filter((a) => a.clusterId !== clusterId),
        filesystems: prev.filesystems.filter((f) => f.clusterId !== clusterId),
        fabrics: prev.fabrics.filter((f) => f.clusterId !== clusterId),
        reservations: prev.reservations.filter((r) => r.clusterId !== clusterId),
        racks,
        topology,
        settings,
        metering,
        history,
        activity: cluster
          ? [activity("cluster", `Cluster ${cluster.name} decommissioned`, "admin", "warning", clusterId), ...prev.activity]
          : prev.activity,
      };
    });
    capture("cluster_decommissioned", { cluster_id: clusterId });
  }, []);

  const scaleCluster = useCallback((clusterId: string, gpuCount: number) => {
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        clusters: prev.clusters.map((c) =>
          c.id === clusterId
            ? {
                ...c,
                gpuCount,
                nodeCount: Math.max(2, Math.round(gpuCount / c.gpusPerNode)),
                powerKw: +((gpuCount * (GPU_BY_ID[c.gpuModelId]?.typicalPowerW ?? 500)) / 1000).toFixed(1),
                costPerHour: +(gpuCount * (GPU_BY_ID[c.gpuModelId]?.msrpPerGpuHour ?? 3)).toFixed(2),
              }
            : c
        ),
        activity: [
          activity("scale", `Cluster ${prev.clusters.find((c) => c.id === clusterId)?.name} resized to ${gpuCount} GPUs`, "autoscaler", "info", clusterId),
          ...prev.activity,
        ],
      };
    });
  }, []);

  const submitJob = useCallback<SimActions["submitJob"]>((input) => {
    const id = `job-${hashString(input.name + Date.now()).toString(36)}`;
    setState((prev) => {
      if (!prev) return prev;
      const job: Job = {
        id,
        name: input.name,
        userId: input.userId,
        teamId: prev.users.find((u) => u.id === input.userId)?.teamId ?? "team-0",
        clusterId: input.clusterId,
        partition: input.partition,
        nodesRequested: input.nodesRequested,
        gpusRequested: input.gpusRequested,
        cpuRequested: input.nodesRequested * 128,
        memRequestedGb: input.nodesRequested * 640,
        priority: input.priority,
        state: "pending",
        submittedAt: Date.now(),
        runtimeSec: 0,
        requestedRuntimeSec: 7200,
        progress: 0,
        framework: input.framework,
        networkClass: input.framework === "vLLM" || input.framework === "Triton Inference" || input.framework === "SGLang" ? "roce" : "infiniband",
        preemptible: input.priority === "low",
        gang: input.nodesRequested > 1,
        checkpointable: true,
        migrating: false,
      };
      return {
        ...prev,
        jobs: [job, ...prev.jobs],
        activity: [
          activity("job", `${input.name} submitted to ${prev.clusters.find((c) => c.id === input.clusterId)?.name ?? input.clusterId}`, prev.users.find((u) => u.id === input.userId)?.name ?? "user", "info", input.clusterId),
          ...prev.activity,
        ],
      };
    });
    captureClusterEvent(
      "job_submitted",
      { id: input.clusterId, name: input.clusterId, regionId: undefined },
      {
        job_name: input.name,
        partition: input.partition,
        framework: input.framework,
        nodes_requested: input.nodesRequested,
        gpus_requested: input.gpusRequested,
        priority: input.priority,
      }
    );
    return id;
  }, []);

  const setJobState = useCallback((jobId: string, next: Job["state"]) => {
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        jobs: prev.jobs.map((j) =>
          j.id === jobId
            ? {
                ...j,
                state: next,
                endedAt: ["completed", "failed", "cancelled"].includes(next) ? Date.now() : j.endedAt,
                startedAt: next === "running" && !j.startedAt ? Date.now() : j.startedAt,
              }
            : j
        ),
      };
    });
  }, []);

  const setJobPriority = useCallback((jobId: string, priority: JobPriority) => {
    setState((prev) =>
      prev ? { ...prev, jobs: prev.jobs.map((j) => (j.id === jobId ? { ...j, priority } : j)) } : prev
    );
  }, []);

  const acknowledgeAlert = useCallback((alertId: string) => {
    setState((prev) =>
      prev
        ? { ...prev, alerts: prev.alerts.map((a) => (a.id === alertId ? { ...a, state: "acknowledged" } : a)) }
        : prev
    );
  }, []);

  const resolveAlert = useCallback((alertId: string) => {
    setState((prev) =>
      prev
        ? { ...prev, alerts: prev.alerts.map((a) => (a.id === alertId ? { ...a, state: "resolved" } : a)) }
        : prev
    );
  }, []);

  const acknowledgeAllAlerts = useCallback((clusterId?: string) => {
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        alerts: prev.alerts.map((a) =>
          (!clusterId || a.clusterId === clusterId) && a.state === "active"
            ? { ...a, state: "acknowledged" }
            : a
        ),
      };
    });
  }, []);

  const drainNode = useCallback((nodeId: string) => {
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, status: "warning", cpuUtilPct: 3, gpus: n.gpus.map((g) => ({ ...g, utilPct: 0, powerW: 90 })) }
            : n
        ),
      };
    });
  }, []);

  const restoreNode = useCallback((nodeId: string) => {
    setState((prev) =>
      prev ? { ...prev, nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, status: "healthy" } : n)) } : prev
    );
  }, []);

  const setUserStatus = useCallback((userId: string, status: "active" | "suspended") => {
    setState((prev) =>
      prev ? { ...prev, users: prev.users.map((u) => (u.id === userId ? { ...u, status } : u)) } : prev
    );
  }, []);

  const setTeamQuota = useCallback((teamId: string, quota: Partial<Quota>) => {
    setState((prev) =>
      prev
        ? {
            ...prev,
            teams: prev.teams.map((t) => (t.id === teamId ? { ...t, quota: { ...t.quota, ...quota } } : t)),
          }
        : prev
    );
  }, []);

  const setClusterSetting = useCallback(
    <K extends keyof ClusterSettings>(clusterId: string, key: K, value: ClusterSettings[K]) => {
      setState((prev) => {
        if (!prev) return prev;
        const current = prev.settings[clusterId];
        if (!current) return prev;
        return {
          ...prev,
          settings: { ...prev.settings, [clusterId]: { ...current, [key]: value } },
        };
      });
    },
    []
  );

  const applyRemediationStep = useCallback((alertId: string, stepIndex: number) => {
    setState((prev) => (prev ? applyStep(prev, alertId, stepIndex) : prev));
    capture("remediation_step_applied", { alert_id: alertId, step_index: stepIndex });
  }, []);

  const autoRemediate = useCallback((alertId: string) => {
    setState((prev) => {
      if (!prev) return prev;
      const alert = prev.alerts.find((a) => a.id === alertId);
      if (!alert) return prev;
      const steps = runbookForCode(alert.code).steps;
      let next: SimState = prev;
      for (let i = alert.remediatedSteps; i < steps.length; i++) {
        next = applyStep(next, alertId, i);
      }
      return next;
    });
    capture("remediation_auto_applied", { alert_id: alertId });
  }, []);

  const remediateAll = useCallback((clusterId?: string) => {
    setState((prev) => {
      if (!prev) return prev;
      let next: SimState = prev;
      for (const alert of prev.alerts) {
        if (alert.state === "resolved") continue;
        if (clusterId && alert.clusterId !== clusterId) continue;
        const steps = runbookForCode(alert.code).steps;
        for (let i = alert.remediatedSteps; i < steps.length; i++) {
          next = applyStep(next, alert.id, i);
        }
      }
      return next;
    });
    capture("remediation_bulk_applied", { cluster_id: clusterId ?? "all" });
  }, []);

  const rebootNode = useCallback((nodeId: string) => {
    setState((prev) => {
      if (!prev) return prev;
      const node = prev.nodes.find((n) => n.id === nodeId);
      return {
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                status: "warning",
                uptimeHours: 0,
                gpus: n.gpus.map((g) => ({ ...g, utilPct: 0, powerW: 90, tempC: 32, throttle: "none" })),
              }
            : n
        ),
        activity: node
          ? [activity("health", `Node ${node.hostname} power-cycled; reinitializing devices`, "operator", "warning", node.clusterId), ...prev.activity]
          : prev.activity,
      };
    });
  }, []);

  const resetNodeErrors = useCallback((nodeId: string) => {
    setState((prev) => {
      if (!prev) return prev;
      const node = prev.nodes.find((n) => n.id === nodeId);
      return {
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, status: "healthy", gpus: n.gpus.map((g) => ({ ...g, xidErrors: 0, eccErrors: 0, throttle: "none" })) }
            : n
        ),
        activity: node
          ? [activity("health", `Error counters cleared on ${node.hostname}`, "operator", "info", node.clusterId), ...prev.activity]
          : prev.activity,
      };
    });
  }, []);

  const resetClusterFabric = useCallback((clusterId: string) => {
    setState((prev) => {
      if (!prev) return prev;
      const cluster = prev.clusters.find((c) => c.id === clusterId);
      return {
        ...prev,
        fabrics: prev.fabrics.map((f) =>
          f.clusterId === clusterId
            ? { ...f, status: "healthy", errors: 0, portsUp: f.portsTotal, latencyUs: Math.min(f.latencyUs, 1.2) }
            : f
        ),
        activity: cluster
          ? [activity("fabric", `Fabric ports reset and retrained on ${cluster.name}`, "operator", "info", clusterId), ...prev.activity]
          : prev.activity,
      };
    });
  }, []);

  const throttleNodeClock = useCallback((nodeId: string, capMhz: number) => {
    setState((prev) => {
      if (!prev) return prev;
      const node = prev.nodes.find((n) => n.id === nodeId);
      return {
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                gpus: n.gpus.map((g) => ({
                  ...g,
                  smClockMhz: Math.min(g.smClockMhz, capMhz),
                  tempC: Math.max(32, g.tempC - 6),
                  throttle: "none",
                })),
              }
            : n
        ),
        activity: node
          ? [activity("health", `Clock ceiling applied on ${node.hostname} (${capMhz} MHz)`, "operator", "info", node.clusterId), ...prev.activity]
          : prev.activity,
      };
    });
  }, []);

  const capNodePower = useCallback((nodeId: string, pct: number) => {
    setState((prev) => {
      if (!prev) return prev;
      const node = prev.nodes.find((n) => n.id === nodeId);
      return {
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                powerW: Math.round(n.powerW * (pct / 100)),
                status: "healthy",
                gpus: n.gpus.map((g) => ({
                  ...g,
                  powerW: Math.round(g.powerW * (pct / 100)),
                  tempC: Math.max(32, g.tempC - 4),
                  throttle: "none",
                })),
              }
            : n
        ),
        activity: node
          ? [activity("health", `Power cap ${pct}% applied on ${node.hostname}`, "operator", "info", node.clusterId), ...prev.activity]
          : prev.activity,
      };
    });
  }, []);

  const migrateClusterJobs = useCallback((clusterId: string) => {
    setState((prev) => {
      if (!prev) return prev;
      const cluster = prev.clusters.find((c) => c.id === clusterId);
      const running = prev.jobs.filter((j) => j.clusterId === clusterId && j.state === "running");
      return {
        ...prev,
        jobs: prev.jobs.map((j) =>
          j.clusterId === clusterId && j.state === "running"
            ? { ...j, state: "pending", startedAt: undefined, migrating: false }
            : j
        ),
        activity: cluster
          ? [activity("job", `${running.length} jobs migrated off ${cluster.name}`, "operator", "warning", clusterId), ...prev.activity]
          : prev.activity,
      };
    });
  }, []);

  const killIdleJobs = useCallback((clusterId?: string) => {
    setState((prev) => {
      if (!prev) return prev;
      const targets = prev.jobs.filter(
        (j) =>
          (j.state === "running" || j.state === "pending") &&
          (clusterId ? j.clusterId === clusterId : true) &&
          (j.progress < 0.05 || j.priority === "low")
      );
      if (targets.length === 0) return prev;
      const ids = new Set(targets.map((j) => j.id));
      return {
        ...prev,
        jobs: prev.jobs.map((j) => (ids.has(j.id) ? { ...j, state: "cancelled", endedAt: Date.now() } : j)),
        activity: [
          activity("job", `${targets.length} idle / low-priority jobs reclaimed`, "operator", "warning", clusterId),
          ...prev.activity,
        ],
      };
    });
  }, []);

  const createConfig = useCallback<SimActions["createConfig"]>((config) => {
    const id = `cfg-${hashString(config.name + Date.now()).toString(36)}`;
    setState((prev) => {
      if (!prev) return prev;
      const now = Date.now();
      const next: ClusterConfig = { ...config, id, createdAt: now, updatedAt: now };
      return {
        ...prev,
        configs: [next, ...prev.configs],
        activity: [activity("cluster", `Config "${config.name}" created`, "operator", "info", config.clusterId), ...prev.activity],
      };
    });
    capture("config_created", {
      config_id: id,
      cluster_id: config.clusterId,
      partition: config.partition,
      mig_enabled: config.migEnabled,
      cuda_version: config.cudaVersion,
      driver_version: config.driverVersion,
    });
    return id;
  }, []);

  const updateConfig = useCallback((configId: string, patch: Partial<ClusterConfig>) => {
    setState((prev) => {
      if (!prev) return prev;
      const existing = prev.configs.find((c) => c.id === configId);
      return {
        ...prev,
        configs: prev.configs.map((c) =>
          c.id === configId ? { ...c, ...patch, updatedAt: Date.now() } : c
        ),
        activity: existing
          ? [activity("cluster", `Config "${existing.name}" updated`, "operator", "info", existing.clusterId), ...prev.activity]
          : prev.activity,
      };
    });
  }, []);

  const deleteConfig = useCallback((configId: string) => {
    setState((prev) => {
      if (!prev) return prev;
      const existing = prev.configs.find((c) => c.id === configId);
      return {
        ...prev,
        configs: prev.configs.filter((c) => c.id !== configId),
        activity: existing
          ? [activity("cluster", `Config "${existing.name}" deleted`, "operator", "warning", existing.clusterId), ...prev.activity]
          : prev.activity,
      };
    });
  }, []);

  const applyConfig = useCallback((configId: string) => {
    setState((prev) => (prev ? applyConfigToState(prev, configId) : prev));
    capture("config_applied", { config_id: configId });
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setState((prev) =>
      prev ? { ...prev, notifications: prev.notifications.filter((n) => n.id !== id) } : prev
    );
  }, []);

  const clearNotifications = useCallback(() => {
    setState((prev) => (prev ? { ...prev, notifications: [] } : prev));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setState((prev) =>
      prev ? { ...prev, notifications: prev.notifications.map((n) => ({ ...n, read: true })) } : prev
    );
  }, []);

  const togglePin = useCallback((clusterId: string) => {
    setState((prev) =>
      prev
        ? {
            ...prev,
            clusters: prev.clusters.map((c) => (c.id === clusterId ? { ...c, pinned: !c.pinned } : c)),
          }
        : prev
    );
  }, []);

  const setClusterNotes = useCallback((clusterId: string, notes: string) => {
    setState((prev) =>
      prev ? { ...prev, clusters: prev.clusters.map((c) => (c.id === clusterId ? { ...c, notes } : c)) } : prev
    );
  }, []);

  const actions = useMemo<SimActions>(
    () => ({
      toggleRunning,
      setSpeed,
      regenerate,
      createCluster,
      deleteCluster,
      scaleCluster,
      submitJob,
      setJobState,
      setJobPriority,
      acknowledgeAlert,
      resolveAlert,
      acknowledgeAllAlerts,
      drainNode,
      restoreNode,
      setUserStatus,
      setTeamQuota,
      setClusterSetting,
      applyRemediationStep,
      autoRemediate,
      remediateAll,
      rebootNode,
      resetNodeErrors,
      resetClusterFabric,
      throttleNodeClock,
      capNodePower,
      migrateClusterJobs,
      killIdleJobs,
      createConfig,
      updateConfig,
      deleteConfig,
      applyConfig,
      dismissNotification,
      clearNotifications,
      markAllNotificationsRead,
      togglePin,
      setClusterNotes,
    }),
    [
      toggleRunning,
      setSpeed,
      regenerate,
      createCluster,
      deleteCluster,
      scaleCluster,
      submitJob,
      setJobState,
      setJobPriority,
      acknowledgeAlert,
      resolveAlert,
      acknowledgeAllAlerts,
      drainNode,
      restoreNode,
      setUserStatus,
      setTeamQuota,
      setClusterSetting,
      applyRemediationStep,
      autoRemediate,
      remediateAll,
      rebootNode,
      resetNodeErrors,
      resetClusterFabric,
      throttleNodeClock,
      capNodePower,
      migrateClusterJobs,
      killIdleJobs,
      createConfig,
      updateConfig,
      deleteConfig,
      applyConfig,
      dismissNotification,
      clearNotifications,
      markAllNotificationsRead,
      togglePin,
      setClusterNotes,
    ]
  );

  const value = useMemo(() => (state ? { state, actions } : null), [state, actions]);

  if (!value) return <BootScreen />;

  return <SimContext.Provider value={value}>{children}</SimContext.Provider>;
}

export function useSim(): SimContextValue {
  const ctx = useContext(SimContext);
  if (!ctx) throw new Error("useSim must be used within SimProvider");
  return ctx;
}
