import {
  ALERT_TEMPLATES,
  DEFAULT_PARTITIONS,
  FRAMEWORKS,
  GPU_BY_ID,
  JOB_PREFIXES,
} from "@/lib/constants";
import { clamp } from "@/lib/format";
import { Rng, hashString } from "@/lib/rng";
import { stepsFor } from "@/lib/runbooks";
import { PXE_SEQUENCE, pxeMessage } from "@/lib/types";
import type {
  ActivityEvent,
  Alert,
  CanaryState,
  Cluster,
  ClusterMetering,
  ClusterNode,
  ClusterSettings,
  FabricSwitch,
  GpuDevice,
  Job,
  MetricSample,
  Notification,
  PxeState,
  Rack,
  SimState,
} from "@/lib/types";

function walk(current: number, target: number, volatility: number, rng: Rng): number {
  return current + (target - current) * 0.1 + rng.gaussian(0, volatility);
}

function mev(
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

function sampleFromCluster(
  cluster: Cluster,
  storage: { iops: number; gbps: number },
  rng: Rng,
  t: number
): MetricSample {
  return {
    t,
    gpuUtil: cluster.utilization,
    memUtil: cluster.memUtilization,
    powerKw: cluster.powerKw * (0.55 + cluster.utilization * 0.45),
    netGbps: cluster.gpuCount * 3.4 * (0.3 + cluster.utilization * 0.7) * rng.range(0.96, 1.04),
    tempC: 40 + cluster.utilization * 32 + rng.range(-1.5, 1.5),
    jobThroughput: rng.range(1, 45),
    storageIops: storage.iops,
    storageGbps: storage.gbps,
  };
}

function updateGpu(
  g: GpuDevice,
  clusterUtil: number,
  specPower: number,
  specClock: number,
  rng: Rng
): GpuDevice {
  // --- Realistic accelerator physics -------------------------------------
  // 1) Workload demand drives SM activity.
  const utilTarget = clamp(clusterUtil * 100 + rng.gaussian(0, 6), 0, 100);
  const util = clamp(walk(g.utilPct, utilTarget, 5, rng), 0, 100);

  // 2) HBM footprint follows high-bandwidth work.
  const memFracTarget = clamp(util / 100 + rng.range(-0.1, 0.12), 0.02, 0.99);
  const memUsed = clamp(
    walk(g.memUsedGb, g.memTotalGb * memFracTarget, g.memTotalGb * 0.02, rng),
    0.5,
    g.memTotalGb
  );

  // 3) Boost clock is bounded by the thermal state of the previous tick,
  //    matching real boost behaviour: hot silicon = lower clocks.
  const boostCeiling = specClock > 0 ? specClock : 1980;
  const thermalDerate = clamp((g.tempC - 70) * 12, 0, 420);
  const targetClock = boostCeiling - thermalDerate;

  // 4) Power = dynamic component (clock^2 scaled by utilisation) + static
  //    leakage that grows with temperature. This couples clock <-> power.
  const dynamicPower = specPower * 0.72 * (util / 100) * Math.pow(targetClock / boostCeiling, 2);
  const leakagePower = specPower * (0.08 + (g.tempC - 30) * 0.0018);
  let power = clamp(walk(g.powerW, dynamicPower + leakagePower, 9, rng), 70, specPower * 1.03);

  // 5) Temperature follows power with a thermal time constant (large mass,
  //    slow response) plus rack inlet influence from the node's environment.
  const tempTarget = 30 + power * (55 / Math.max(1, specPower));
  const temp = clamp(walk(g.tempC, tempTarget, 0.9, rng), 28, 99);

  // 6) Throttling is asserted by whichever budget is exceeded first; clocks
  //    are then clamped to a safe value.
  const powerLimited = power > specPower * 0.995;
  const thermalLimited = temp > 88;
  const throttle: GpuDevice["throttle"] =
    thermalLimited ? "thermal" : powerLimited ? "power" : "none";

  let smClock = targetClock;
  if (thermalLimited) smClock = Math.min(smClock, boostCeiling * 0.55);
  if (powerLimited) smClock = Math.min(smClock, boostCeiling * 0.82);
  smClock = clamp(smClock, 210, boostCeiling);

  // 7) If throttled, the power the GPU actually consumes is pulled down too.
  if (thermalLimited || powerLimited) {
    power = clamp(power * 0.96, 70, specPower);
  }

  // HBM clock is largely independent of SM throttling.
  const memClock = throttle === "thermal" && temp > 93 ? 1215 : 2619;

  return {
    ...g,
    utilPct: util,
    memUsedGb: +memUsed.toFixed(1),
    tempC: +temp.toFixed(1),
    powerW: +power.toFixed(0),
    smClockMhz: Math.round(smClock),
    memClockMhz: memClock,
    throttle,
    xidErrors: g.xidErrors + (rng.next() < 0.0004 ? 1 : 0),
    eccErrors: g.eccErrors + (rng.next() < 0.0008 ? 1 : 0),
  };
}

function updateNode(
  node: ClusterNode,
  cluster: Cluster,
  settings: ClusterSettings | undefined,
  now: number,
  rng: Rng
): ClusterNode {
  const spec = GPU_BY_ID[cluster.gpuModelId];

  // Offline nodes recover occasionally; warning/critical recover more slowly.
  if (node.status === "offline") {
    if (rng.next() < 0.06) {
      return { ...node, status: "warning", gpus: node.gpus.map((g) => ({ ...g, utilPct: 4, powerW: 90 })) };
    }
    return node;
  }

  if (cluster.status === "provisioning" || settings?.powerSteering === false) {
    // still animate telemetry
  }

  const gpus = node.gpus.map((g) => updateGpu(g, cluster.utilization, spec.tdpW, spec.boostClockMhz, rng));
  const cpuUtil = clamp(walk(node.cpuUtilPct, cluster.utilization * 100 + rng.range(-6, 8), 4, rng), 2, 99);
  const memUsed = clamp(
    walk(node.memUsedGb, node.memTotalGb * (cluster.memUtilization + rng.range(-0.05, 0.05)), node.memTotalGb * 0.03, rng),
    512,
    node.memTotalGb
  );
  let powerW = gpus.length
    ? gpus.reduce((s, g) => s + g.powerW, 0) + rng.range(280, 420)
    : node.powerW + rng.gaussian(0, 6);

  // Power steering: shed load if rack budget is exceeded.
  if (settings?.powerSteering) {
    powerW = Math.min(powerW, spec.tdpW * cluster.gpusPerNode * 0.98 + 420);
  }

  // Failure model: healthy nodes rarely go critical/warning; degraded nodes recover.
  const roll = rng.next();
  let status: ClusterNode["status"];
  if (cluster.status === "provisioning") {
    status = "provisioning";
  } else if (roll < 0.0016) {
    status = "critical";
  } else if (roll < 0.01) {
    status = "warning";
  } else if (node.status === "critical" || node.status === "warning") {
    status = rng.next() < 0.07 ? "healthy" : node.status;
  } else {
    status = "healthy";
  }

  return {
    ...node,
    gpus,
    cpuUtilPct: cpuUtil,
    memUsedGb: +memUsed.toFixed(0),
    netTxGbps: +(gpus.length ? cluster.utilization * spec.hbmBandwidthGbps * 0.0009 * rng.range(0.85, 1.15) : rng.range(1, 20)).toFixed(1),
    netRxGbps: +(gpus.length ? cluster.utilization * spec.hbmBandwidthGbps * 0.0011 * rng.range(0.85, 1.15) : rng.range(1, 20)).toFixed(1),
    status,
    uptimeHours: +(node.uptimeHours + 1 / 3600).toFixed(3),
    powerW: +powerW.toFixed(0),
  };
}

function advanceJob(job: Job, cluster: Cluster | undefined, now: number, rng: Rng): Job {
  const dt = 5;
  if (job.migrating) {
    // resume after a short migration window
    if (rng.next() < 0.5) {
      return { ...job, migrating: false };
    }
    return job;
  }
  if (job.state === "running") {
    const runtime = job.runtimeSec + dt;
    const progress = clamp(runtime / job.requestedRuntimeSec, 0, 1);
    if (progress >= 1) {
      return { ...job, runtimeSec: job.requestedRuntimeSec, progress: 1, state: "completed", endedAt: now, exitCode: 0 };
    }
    if (rng.next() < 0.00035) {
      return { ...job, runtimeSec: runtime, state: "failed", endedAt: now, exitCode: rng.pick([1, 2, 134, 137]) };
    }
    return { ...job, runtimeSec: runtime, progress };
  }
  if (job.state === "paused") return job;
  if (job.state === "pending" && cluster && cluster.utilization < 0.93) {
    if (rng.next() < 0.02) {
      return { ...job, state: "running", startedAt: now, runtimeSec: 0, progress: 0 };
    }
  }
  return job;
}

function maybeNewJob(state: SimState, rng: Rng, now: number): Job | null {
  const cluster = rng.pick(state.clusters.filter((c) => c.status === "ready"));
  if (!cluster) return null;
  const user = rng.pick(state.users);
  const nodesRequested = rng.int(1, Math.max(1, Math.min(cluster.nodeCount, 16)));
  const requestedRuntimeSec = rng.pick([3600, 7200, 14400, 86400]);
  const pending = rng.next() < 0.35;
  const framework = rng.pick(FRAMEWORKS);
  const networkBound = framework === "vLLM" || framework === "Triton Inference" || framework === "SGLang";
  return {
    id: `job-${hashString(`${now}-${rng.int(0, 1e9)}`).toString(36)}`,
    name: `${rng.pick(JOB_PREFIXES)}-${rng.pick(["v1", "v2", "prod", "exp"])}-${rng.int(100, 999)}`,
    userId: user.id,
    teamId: user.teamId,
    clusterId: cluster.id,
    partition: networkBound ? "gpu-infer" : rng.pick(DEFAULT_PARTITIONS),
    nodesRequested,
    gpusRequested: nodesRequested * cluster.gpusPerNode,
    cpuRequested: nodesRequested * cluster.cpuCoresPerNode,
    memRequestedGb: nodesRequested * Math.round(cluster.memGbPerNode * 0.6),
    priority: rng.pick(["low", "normal", "high", "urgent"]),
    state: pending ? "pending" : "running",
    submittedAt: now,
    startedAt: pending ? undefined : now,
    runtimeSec: 0,
    requestedRuntimeSec,
    progress: 0,
    framework,
    networkClass: networkBound ? rng.pick(["roce", "ethernet"]) : rng.pick(["infiniband", "roce"]),
    preemptible: rng.next() < 0.3,
    gang: nodesRequested > 1 && !networkBound,
    checkpointable: !networkBound,
    migrating: false,
  };
}

function maybeAlert(state: SimState, rng: Rng, now: number): Alert | null {
  const cluster = rng.pick(state.clusters.filter((c) => c.kind));
  if (!cluster) return null;
  const template = rng.pick(ALERT_TEMPLATES);
  const clusterNodes = state.nodes.filter((n) => n.clusterId === cluster.id && n.role === "gpu-worker");
  const node = clusterNodes.length ? rng.pick(clusterNodes) : undefined;
  return {
    id: `alert-${hashString(`${now}-${template.code}-${rng.int(0, 1e9)}`).toString(36)}`,
    clusterId: cluster.id,
    nodeId: node?.id,
    gpuIndex: node && node.gpus.length ? rng.int(0, node.gpus.length - 1) : undefined,
    severity: template.severity,
    source: template.source,
    code: template.code,
    title: template.title,
    detail: template.detail,
    metric: template.metric,
    value: template.metric ? +rng.range(1, 100).toFixed(1) : undefined,
    raisedAt: now,
    state: "active",
    remediationSteps: stepsFor(template.code),
    remediatedSteps: 0,
  };
}

export function advance(prev: SimState, rng: Rng): SimState {
  const now = Date.now();
  const tick = prev.tick + 1;
  const extraActivity: ActivityEvent[] = [];
  const extraAlerts: Alert[] = [];

  const clusters: Cluster[] = prev.clusters.map((cluster) => {
    const settings = prev.settings[cluster.id];
    if (cluster.status === "provisioning") {
      const progress = clamp(cluster.provisionProgress + rng.range(1.5, 5), 0, 100);
      if (progress >= 100) {
        extraActivity.push(mev("provision", `${cluster.name} finished provisioning and joined the fleet`, "system", "info", cluster.id));
        return { ...cluster, provisionProgress: 100, status: "ready", health: "healthy" };
      }
      return { ...cluster, provisionProgress: +progress.toFixed(1), health: "provisioning" };
    }
    if (cluster.status === "deleting") return cluster;

    const target = clamp(
      cluster.utilization + rng.gaussian(0, 0.045),
      cluster.status === "degraded" ? 0.05 : 0.28,
      0.99
    );
    let utilization = clamp(walk(cluster.utilization, target, 0.012, rng), 0.02, 0.99);

    // Autoscaling nudges utilization back toward the 70-85% green band.
    if (settings?.autoscaling) {
      utilization = clamp(utilization + (0.78 - utilization) * 0.006 + rng.gaussian(0, 0.006), 0.03, 0.985);
    }

    const memUtilization = clamp(
      walk(cluster.memUtilization, clamp(target + rng.range(-0.08, 0.08), 0.05, 0.99), 0.012, rng),
      0.02,
      0.99
    );

    // Occasional degradation / recovery transitions.
    let status = cluster.status;
    let health = cluster.health;
    if (cluster.status === "ready" && rng.next() < 0.004) {
      status = "degraded";
      health = rng.pick(["warning", "critical"]);
      extraActivity.push(mev("alert", `${cluster.name} entered a degraded state`, "dcgm", "warning", cluster.id));
    } else if (cluster.status === "degraded" && rng.next() < 0.02) {
      status = "ready";
      health = "healthy";
      extraActivity.push(mev("cluster", `${cluster.name} recovered to ready`, "system", "info", cluster.id));
    }

    return { ...cluster, utilization, memUtilization, status, health };
  });

  const clusterById = new Map(clusters.map((c) => [c.id, c]));

  const nodes: ClusterNode[] = prev.nodes.map((node) => {
    const cluster = clusterById.get(node.clusterId);
    if (!cluster || cluster.status === "deleting") return node;
    return updateNode(node, cluster, prev.settings[node.clusterId], now, rng);
  });

  // Job lifecycle
  let jobs: Job[] = prev.jobs.map((job) => advanceJob(job, clusterById.get(job.clusterId), now, rng));

  // Node-failure driven requeue/migration: nodes that just became critical impact jobs.
  const failingNodes = new Set(
    nodes.filter((n) => n.status === "critical").map((n) => n.clusterId)
  );
  if (failingNodes.size) {
    jobs = jobs.map((job) => {
      if (job.state !== "running" || !failingNodes.has(job.clusterId)) return job;
      if (rng.next() > 0.08) return job;
      if (job.checkpointable && rng.next() < 0.7) {
        extraActivity.push(mev("job", `${job.name} paused on node fault and will requeue after checkpoint`, "scheduler", "warning", job.clusterId));
        return { ...job, migrating: true };
      }
      extraActivity.push(mev("job", `${job.name} failed on node fault`, "scheduler", "warning", job.clusterId));
      return { ...job, state: "failed", endedAt: now, exitCode: 137 };
    });
  }

  // Preemption of low-priority work on hot clusters
  for (const cluster of clusters) {
    const settings = prev.settings[cluster.id];
    if (!settings?.preemption || cluster.utilization < 0.97) continue;
    const candidate = jobs.find(
      (j) => j.clusterId === cluster.id && j.state === "running" && j.preemptible && j.priority === "low"
    );
    if (candidate && rng.next() < 0.15) {
      jobs = jobs.map((j) => (j.id === candidate.id ? { ...j, state: "held" } : j));
      extraActivity.push(mev("job", `${candidate.name} preempted to admit higher-priority work`, "scheduler", "warning", cluster.id));
    }
  }

  jobs = jobs.filter((j) => j.state !== "completed" || now - (j.endedAt ?? now) < 3600_000);
  if (jobs.length < 320 && rng.next() < 0.28) {
    const job = maybeNewJob(prev, rng, now);
    if (job) jobs = [job, ...jobs];
  }

  let alerts = prev.alerts;
  if (rng.next() < 0.06) {
    const alert = maybeAlert(prev, rng, now);
    if (alert) alerts = [alert, ...alerts].slice(0, 400);
  }

  // Storage: derive aggregate IOPS/throughput from utilization and roll usage.
  const storageByCluster: Record<string, { iops: number; gbps: number }> = {};
  const filesystems = prev.filesystems.map((fs) => {
    const cluster = clusterById.get(fs.clusterId);
    if (!cluster) return fs;
    const iops = Math.round(clamp(fs.iops + rng.gaussian(0, 12000), 20_000, 1_800_000));
    const read = +clamp(fs.readGbps + rng.gaussian(0, 12), 5, 1200).toFixed(0);
    const write = +clamp(fs.writeGbps + rng.gaussian(0, 10), 5, 1000).toFixed(0);
    const agg = storageByCluster[fs.clusterId] ?? { iops: 0, gbps: 0 };
    agg.iops += iops;
    agg.gbps += read + write;
    storageByCluster[fs.clusterId] = agg;
    return {
      ...fs,
      readGbps: read,
      writeGbps: write,
      usedTb: +clamp(fs.usedTb + rng.gaussian(0, 4) * cluster.utilization, 0, fs.capacityTb * 0.99).toFixed(0),
      iops,
    };
  });
  for (const id of Object.keys(clusterById)) {
    if (!storageByCluster[id]) storageByCluster[id] = { iops: 0, gbps: 0 };
  }

  const fabrics = prev.fabrics.map((f) => ({
    ...f,
    latencyUs: +clamp(f.latencyUs + rng.gaussian(0, 0.08), 0.08, 9).toFixed(2),
    errors: f.errors + (rng.next() < 0.004 ? 1 : 0),
    portsUp: Math.round(
      clamp(f.portsUp + (rng.next() < 0.03 ? (rng.bool() ? 1 : -1) : 0), f.portsTotal * 0.9, f.portsTotal)
    ),
  }));

  // Racks: derive inlet temperature and power from member nodes.
  const racks: Record<string, Rack[]> = { ...prev.racks };
  for (const cluster of clusters) {
    const clusterRacks = prev.racks[cluster.id];
    if (!clusterRacks) continue;
    racks[cluster.id] = clusterRacks.map((rack) => {
      const members = rack.nodeIds
        .map((id) => nodes.find((n) => n.id === id))
        .filter((n): n is ClusterNode => Boolean(n));
      const drawKw = members.reduce((s, n) => s + n.powerW, 0) / 1000;
      const load = clamp(drawKw / Math.max(1, rack.powerCapacityKw), 0, 1.2);
      return {
        ...rack,
        inletTempC: +clamp(rack.inletTempC + (load > 1 ? 0.2 : rng.gaussian(0, 0.1)), 17, 33).toFixed(1),
        coolantTempC: +clamp(rack.coolantTempC + (load - 0.7) * 0.08 + rng.gaussian(0, 0.15), 24, 52).toFixed(1),
        airflowCfm: Math.round(clamp(rack.airflowCfm + rng.gaussian(0, 60), 2400, 9200)),
        status: members.some((n) => n.status === "critical")
          ? "critical"
          : members.some((n) => n.status === "warning") || load > 1
            ? "warning"
            : "healthy",
      };
    });
  }

  // Update cluster metering snapshot.
  const metering: Record<string, ClusterMetering> = { ...prev.metering };
  for (const cluster of clusters) {
    const clusterFs = filesystems.filter((f) => f.clusterId === cluster.id);
    const m = metering[cluster.id] ?? {
      gpuHours24h: 0,
      storageTb: 0,
      egressGb24h: 0,
      reservedGpus: 0,
      spotGpus: 0,
    };
    metering[cluster.id] = {
      ...m,
      gpuHours24h: +(m.gpuHours24h + (cluster.gpuCount * cluster.utilization) / 720).toFixed(2),
      storageTb: +clusterFs.reduce((s, f) => s + f.usedTb, 0).toFixed(0),
      egressGb24h: +(m.egressGb24h + cluster.utilization * rng.range(2, 12)).toFixed(1),
    };
  }

  const history = { ...prev.history };
  for (const cluster of clusters) {
    const arr = history[cluster.id] ? [...history[cluster.id]] : [];
    const store = storageByCluster[cluster.id] ?? { iops: 0, gbps: 0 };
    arr.push(sampleFromCluster(cluster, store, rng, now));
    if (arr.length > 60) arr.shift();
    history[cluster.id] = arr;
  }

  const globalSample: MetricSample = {
    t: now,
    gpuUtil:
      clusters.reduce((s, c) => s + c.utilization * c.gpuCount, 0) /
      Math.max(1, clusters.reduce((s, c) => s + c.gpuCount, 0)),
    memUtil: clusters.reduce((s, c) => s + c.memUtilization, 0) / Math.max(1, clusters.length),
    powerKw: clusters.reduce((s, c) => s + c.powerKw * (0.55 + c.utilization * 0.45), 0),
    netGbps: clusters.reduce((s, c) => s + c.gpuCount * 3.4 * (0.3 + c.utilization * 0.7), 0),
    tempC: 42 + (clusters.reduce((s, c) => s + c.utilization, 0) / Math.max(1, clusters.length)) * 30,
    jobThroughput: jobs.filter((j) => j.state === "running").length,
    storageIops:
      Object.values(storageByCluster).reduce((s, x) => s + x.iops, 0) / Math.max(1, clusters.length),
    storageGbps: Object.values(storageByCluster).reduce((s, x) => s + x.gbps, 0),
  };
  const globalHistory = [...prev.globalHistory, globalSample].slice(-60);

  let activity = prev.activity;
  if (rng.next() < 0.12) {
    const cluster = rng.pick(clusters);
    const user = rng.pick(prev.users);
    const kindRoll = rng.next();
    const kind: ActivityEvent["kind"] =
      kindRoll < 0.3 ? "job" : kindRoll < 0.55 ? "scale" : kindRoll < 0.8 ? "fabric" : "health";
    const messages: Record<string, string> = {
      job: `${user.name} submitted a new workload to ${cluster.name}`,
      scale: `${cluster.name} autoscaler adjusted capacity toward target utilization`,
      fabric: `Fabric telemetry refreshed for ${cluster.name}`,
      health: `${cluster.name} health sweep completed`,
    };
    activity = [
      mev(kind, messages[kind], rng.pick(["scheduler", "dcgm", "autoscaler", "system"]), "info", cluster.id),
      ...prev.activity,
    ].slice(0, 60);
  }
  if (extraActivity.length) {
    activity = [...extraActivity, ...activity].slice(0, 80);
  }

  if (extraAlerts.length) {
    alerts = [...extraAlerts, ...alerts].slice(0, 400);
  }

  // Notifications: surface newly-raised, high-signal events as toasts.
  const newNotifications: Notification[] = [];
  if (prev.tick > 0 && extraAlerts.length) {
    for (const a of extraAlerts.slice(0, 3)) {
      newNotifications.push({
        id: `ntf-${a.id}`,
        t: now,
        severity: a.severity,
        title: a.title,
        message: `${a.code} · ${a.source}`,
        source: a.source,
        clusterId: a.clusterId,
        alertId: a.id,
        read: false,
      });
    }
  }
  if (prev.tick > 0 && extraActivity.length) {
    for (const e of extraActivity) {
      if (e.kind === "provision" || e.kind === "job") {
        newNotifications.push({
          id: `ntf-${e.id}`,
          t: e.t,
          severity: e.severity,
          title: e.kind === "provision" ? "Provisioning update" : "Scheduler event",
          message: e.message,
          source: e.actor,
          clusterId: e.clusterId,
          read: false,
        });
      }
    }
  }
  const notifications = newNotifications.length
    ? [...newNotifications, ...prev.notifications].slice(0, 40)
    : prev.notifications;

  // --- PXE provisioning state machine ------------------------------------
  const pxe: Record<string, PxeState> = { ...prev.pxe };
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  for (const id of Object.keys(pxe)) {
    const state = pxe[id];
    const node = nodesById.get(id);
    if (!node) continue;

    if (state.stage === "healthy") {
      // Occasionally a node re-provisions (maintenance / firmware).
      if (rng.next() < 0.0008) {
        pxe[id] = {
          ...state,
          stage: "queued",
          progress: 0,
          startedAt: now,
          updatedAt: now,
          attempts: state.attempts + 1,
          logs: [{ t: now, stage: "queued", message: pxeMessage("queued") }],
        };
      }
      continue;
    }

    if (state.stage === "failed") {
      if (rng.next() < 0.08) {
        pxe[id] = { ...state, stage: "queued", progress: 0, updatedAt: now, lastError: undefined };
      }
      continue;
    }

    // Advance the stage progressively.
    const step = rng.range(6, 22);
    let progress = state.progress + step;
    let stage: PxeState["stage"] = state.stage;
    let lastError: string | undefined = state.lastError;
    const logs = [...state.logs];
    if (progress >= 100) {
      const idx = PXE_SEQUENCE.indexOf(stage);
      const nextStage = PXE_SEQUENCE[Math.min(idx + 1, PXE_SEQUENCE.length - 1)];
      stage = nextStage;
      progress = nextStage === "healthy" ? 100 : 0;
      logs.push({ t: now, stage: nextStage, message: pxeMessage(nextStage) });
      // small failure chance during imaging/drivers
      if ((nextStage === "image" || nextStage === "drivers") && rng.next() < 0.03) {
        stage = "failed";
        progress = 100;
        lastError = rng.pick(["netboot timeout", "image checksum mismatch", "driver DKMS build failed"]);
        logs.push({ t: now, stage: "failed", message: `Provisioning failed: ${lastError}` });
      }
    }
    pxe[id] = {
      ...state,
      stage,
      progress: +clamp(progress, 0, 100).toFixed(0),
      updatedAt: now,
      lastError,
      logs: logs.slice(-20),
    };
  }

  // --- InfiniBand / fabric switch telemetry ------------------------------
  const switches: Record<string, FabricSwitch[]> = { ...prev.switches };
  for (const cluster of clusters) {
    const list = switches[cluster.id];
    if (!list) continue;
    switches[cluster.id] = list.map((sw) => {
      const util = clamp(sw.utilPct + (cluster.utilization * 100 - sw.utilPct) * 0.08 + rng.gaussian(0, 2), 5, 99);
      const portsUp = Math.round(
        clamp(sw.portsUp + (rng.next() < 0.02 ? (rng.bool() ? 1 : -1) : 0), sw.portsTotal * 0.85, sw.portsTotal)
      );
      const errors = sw.errors + (rng.next() < 0.005 ? 1 : 0);
      return {
        ...sw,
        utilPct: +util.toFixed(0),
        portsUp,
        errors,
        status: portsUp < sw.portsTotal * 0.9 || errors > 20 ? "warning" : "healthy",
      };
    });
  }

  // --- Spot / preempt pools ---------------------------------------------
  const pools = prev.pools.map((pool) => {
    const cluster = clusterById.get(pool.clusterId);
    if (!cluster) return pool;
    const util = clamp(pool.utilization + (cluster.utilization - pool.utilization) * 0.1 + rng.gaussian(0, 0.03), 0.1, 0.99);
    const evictions = pool.kind === "spot" || pool.kind === "preempt"
      ? rng.next() < 0.12
        ? +rng.range(0.5, 6).toFixed(2)
        : clamp(pool.evictionRate + rng.gaussian(0, 0.15), 0, 12)
      : 0;
    const currentDiscount = +clamp(
      pool.baselineDiscount + (util - 0.7) * 0.1 * (pool.kind === "reserved" ? 0.2 : 1) + (evictions / 100),
      pool.baselineDiscount * 0.8,
      pool.kind === "reserved" ? 0.35 : 0.9
    ).toFixed(2);
    let state = pool.state;
    if (state === "active" && cluster.status === "degraded" && rng.next() < 0.03) state = "draining";
    else if (state === "draining" && rng.next() < 0.05) state = "active";
    return { ...pool, utilization: +util.toFixed(2), evictionRate: evictions, currentDiscount, state };
  });

  // --- Canary deploys ----------------------------------------------------
  const canaries = prev.canaries.map((c) => {
    const cluster = clusterById.get(c.clusterId);
    if (!cluster) return c;
    if (c.state === "promoted" || c.state === "aborted" || c.state === "failed") return c;
    if (c.state === "paused") {
      if (rng.next() < 0.05) return { ...c, state: "rolling", updatedAt: now };
      return c;
    }
    // rolling
    const batches = c.batches.map((b) => ({ ...b }));
    const cur = batches[c.currentBatch];
    let state: CanaryState = c.state;
    let currentBatch = c.currentBatch;
    let updatedAt = now;
    if (cur) {
      cur.state = "rolling";
      if (rng.next() < 0.25) {
        cur.state = "done";
        const gatesOk = c.rolloutGates.every((g) => g.passed) && rng.next() < 0.96;
        if (!gatesOk) {
          state = "failed";
          cur.state = "failed";
        } else if (currentBatch + 1 >= batches.length) {
          state = "promoted";
          currentBatch = batches.length;
        } else {
          currentBatch += 1;
        }
      }
    }
    return { ...c, batches, state, currentBatch, updatedAt };
  });

  return {
    ...prev,
    tick,
    clusters,
    nodes,
    jobs,
    alerts,
    filesystems,
    fabrics,
    racks,
    metering,
    notifications,
    pxe,
    switches,
    pools,
    canaries,
    history,
    globalHistory,
    activity,
  };
}
