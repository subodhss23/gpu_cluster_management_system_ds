import {
  ALERT_TEMPLATES,
  CLUSTER_KINDS,
  DEFAULT_PARTITIONS,
  FIRST_NAMES,
  FRAMEWORKS,
  GPU_BY_ID,
  GPU_CATALOG,
  JOB_PREFIXES,
  LAST_NAMES,
  NETWORK_CLASSES,
  REGIONS,
  RESERVATION_NAMES,
  TEAM_DEFS,
  TRAINING_FRAMEWORKS,
} from "@/lib/constants";
import { Rng, hashString } from "@/lib/rng";
import { stepsFor } from "@/lib/runbooks";
import type {
  ActivityEvent,
  Alert,
  Cluster,
  ClusterKind,
  CanaryDeploy,
  CanaryState,
  ClusterConfig,
  ClusterMetering,
  FabricSwitch,
  FleetIndexRow,
  NodePool,
  PoolKind,
  PoolState,
  PxeStage,
  PxeState,
  ClusterNode,
  ClusterSettings,
  Connectivity,
  Fabric,
  Filesystem,
  GpuDevice,
  Job,
  JobPriority,
  JobState,
  MetricSample,
  NodeRole,
  PriceBook,
  Rack,
  Reservation,
  SimState,
  Team,
  TopologyBlock,
  User,
  UserRole,
} from "@/lib/types";
import { PXE_SEQUENCE, pxeMessage } from "@/lib/types";
import { clamp } from "@/lib/format";

const CLUSTER_NAMES = [
  "Helios",
  "Nexus",
  "Titan",
  "Aurora",
  "Vertex",
  "Kinetic",
  "Photon",
  "Orion",
  "Zenith",
  "Cobalt",
  "Vector",
  "Nova",
  "Pulsar",
  "Quasar",
  "Atlas",
  "Cascade",
  "Fusion",
  "Meridian",
  "Solstice",
  "Vanguard",
];

const ROLES: UserRole[] = [
  "admin",
  "researcher",
  "ml-engineer",
  "ml-engineer",
  "viewer",
  "researcher",
  "service",
];

export const DEFAULT_SETTINGS: ClusterSettings = {
  autoscaling: true,
  powerSteering: true,
  maintenanceWindow: "Sun 02:00 UTC",
  defaultPartition: "gpu-train",
  maxJobRuntimeSec: 259200,
  preemption: true,
  checkpointMinutes: 15,
  migEnabled: false,
  isolation: "namespace",
};

const FABRIC_BY_KIND: Record<ClusterKind, string[]> = {
  "DGX SuperPOD": ["NVLink 5 + InfiniBand NDR", "InfiniBand XDR 800G"],
  "DGX BasePOD": ["InfiniBand NDR 400G", "NVLink 5 + InfiniBand NDR"],
  Kubernetes: ["Ethernet 400G RoCEv2", "InfiniBand NDR 400G"],
  "Run:AI": ["Ethernet 400G RoCEv2", "InfiniBand NDR 400G"],
  Slurm: ["InfiniBand NDR 400G", "InfiniBand XDR 800G"],
  GPUStack: ["Ethernet 400G RoCEv2"],
};

function gpuCountOptions(kind: ClusterKind, tier: string): number[] {
  if (kind === "DGX SuperPOD") return [1024, 2048, 4096];
  if (kind === "DGX BasePOD") return [128, 256, 512];
  if (tier === "edge") return [16, 32, 64];
  return [64, 128, 256, 512];
}

function pickGpuId(rng: Rng, kind: ClusterKind): string {
  if (kind === "DGX SuperPOD") return rng.pick(["gb200", "b200", "h200"]);
  if (kind === "DGX BasePOD") return rng.pick(["b200", "h200", "h100"]);
  if (kind === "GPUStack") return rng.pick(["l40s", "h100", "h200"]);
  return rng.pick(["h100", "h200", "b200", "a100"]);
}

function makeGpu(
  rng: Rng,
  specId: string,
  index: number,
  util: number
): GpuDevice {
  const spec = GPU_BY_ID[specId] ?? GPU_CATALOG[0];
  const localUtil = clamp(
    util * 100 + rng.gaussian(0, 9),
    0,
    100
  );
  const memFrac = clamp(localUtil / 100 + rng.range(-0.08, 0.12), 0.02, 0.99);
  const power = clamp(
    spec.typicalPowerW * (0.35 + (localUtil / 100) * 0.65) + rng.gaussian(0, 18),
    90,
    spec.tdpW
  );
  const temp = clamp(
    38 + (localUtil / 100) * 34 + rng.gaussian(0, 3.2),
    30,
    95
  );
  const throttle: GpuDevice["throttle"] =
    temp > 88 ? "thermal" : power > spec.tdpW * 0.98 ? "power" : "none";
  return {
    index,
    utilPct: localUtil,
    memUsedGb: +(spec.memoryGb * memFrac).toFixed(1),
    memTotalGb: spec.memoryGb,
    tempC: +temp.toFixed(1),
    powerW: +power.toFixed(0),
    smClockMhz: Math.round(clamp(1980 - (temp - 60) * 8, 900, 2100)),
    memClockMhz: 2619,
    xidErrors: rng.next() < 0.04 ? rng.int(1, 3) : 0,
    eccErrors: rng.next() < 0.06 ? 1 : 0,
    throttle,
    migMode: rng.next() < 0.12 ? rng.pick(["1g.10gb", "2g.20gb", "3g.40gb"]) : "disabled",
  };
}

function makeNode(
  rng: Rng,
  cluster: Cluster,
  rack: number,
  slot: number,
  role: NodeRole,
  index: number
): ClusterNode {
  const short = cluster.name.slice(0, 3).toLowerCase();
  const hostname =
    role === "gpu-worker"
      ? `${short}-gpu-${String(rack).padStart(2, "0")}${String(slot).padStart(2, "0")}`
      : `${short}-${role}-${String(index).padStart(2, "0")}`;

  const gpuCount = role === "gpu-worker" ? cluster.gpusPerNode : 0;
  const utilBase = role === "gpu-worker" ? cluster.utilization : rng.range(0.05, 0.35);
  const gpus: GpuDevice[] = [];
  for (let i = 0; i < gpuCount; i++) {
    gpus.push(makeGpu(rng, cluster.gpuModelId, i, utilBase));
  }

  const nodeStatusRoll = rng.next();
  const status =
    cluster.status === "provisioning"
      ? "provisioning"
      : nodeStatusRoll < 0.015
        ? "critical"
        : nodeStatusRoll < 0.07
          ? "warning"
          : "healthy";

  const memTotal = cluster.memGbPerNode;
  const memUsedFrac = role === "gpu-worker" ? clamp(utilBase + rng.range(-0.1, 0.15), 0.05, 0.95) : rng.range(0.1, 0.4);
  const spec = GPU_BY_ID[cluster.gpuModelId] ?? GPU_CATALOG[0];
  const powerW =
    gpus.length > 0
      ? gpus.reduce((sum, g) => sum + g.powerW, 0) + rng.range(280, 420)
      : rng.range(180, 320);

  return {
    id: `${cluster.id}-${hostname}`,
    hostname,
    clusterId: cluster.id,
    rack: `R${String(rack).padStart(2, "0")}`,
    slot,
    role,
    gpuModelId: gpus.length ? cluster.gpuModelId : undefined,
    gpus,
    cpuCores: cluster.cpuCoresPerNode,
    cpuUtilPct: clamp((utilBase + rng.range(-0.08, 0.12)) * 100, 3, 98),
    memTotalGb: memTotal,
    memUsedGb: +(memTotal * memUsedFrac).toFixed(0),
    nvmeUsedTb: +(cluster.localNvmeTbPerNode * rng.range(0.2, 0.9)).toFixed(2),
    nvmeTotalTb: cluster.localNvmeTbPerNode,
    netTxGbps: +(gpus.length ? utilBase * spec.hbmBandwidthGbps * 0.0009 : rng.range(1, 20)).toFixed(1),
    netRxGbps: +(gpus.length ? utilBase * spec.hbmBandwidthGbps * 0.0011 : rng.range(1, 24)).toFixed(1),
    status,
    uptimeHours: Math.round(rng.range(6, 2400)),
    powerW: +powerW.toFixed(0),
  };
}

function makeCluster(
  rng: Rng,
  regionId: string,
  zone: string,
  tier: string,
  usedNames: Set<string>,
  index: number
): Cluster {
  let name = rng.pick(CLUSTER_NAMES);
  let guard = 0;
  while (usedNames.has(name) && guard++ < 40) name = rng.pick(CLUSTER_NAMES);
  if (usedNames.has(name)) name = `${name}-${index}`;
  usedNames.add(name);

  const kindDef = rng.pick(CLUSTER_KINDS);
  const kind = kindDef.kind as ClusterKind;
  const gpuModelId = pickGpuId(rng, kind);
  const spec = GPU_BY_ID[gpuModelId];
  const gpuCount = rng.pick(gpuCountOptions(kind, tier));
  const gpusPerNode = spec.id === "gb200" ? 4 : rng.next() < 0.15 ? 4 : 8;
  const nodeCount = Math.max(2, Math.round(gpuCount / gpusPerNode));
  const cpuCoresPerNode = spec.tier === "flagship" ? rng.pick([128, 192]) : rng.pick([64, 96, 128]);
  const memGbPerNode = spec.tier === "flagship" ? rng.pick([1024, 2048]) : rng.pick([512, 768, 1024]);
  const localNvmeTbPerNode = spec.tier === "inference" ? rng.pick([3.84, 7.68]) : rng.pick([7.68, 15.36]);

  const statusRoll = rng.next();
  const status: Cluster["status"] =
    statusRoll < 0.08
      ? "provisioning"
      : statusRoll < 0.16
        ? "degraded"
        : "ready";
  const health: Cluster["health"] =
    status === "provisioning"
      ? "provisioning"
      : status === "degraded"
        ? rng.pick(["warning" as const, "critical" as const])
        : "healthy";

  const utilization = clamp(
    rng.range(0.42, 0.97) * (status === "ready" ? 1 : 0.4),
    0.05,
    0.99
  );
  const powerKw = +((gpuCount * spec.typicalPowerW) / 1000 + nodeCount * 0.35).toFixed(1);
  const costPerHour = +(gpuCount * spec.msrpPerGpuHour + nodeCount * 0.12).toFixed(2);

  return {
    id: `cl-${name.toLowerCase()}-${hashString(name + regionId).toString(36).slice(0, 4)}`,
    name,
    regionId,
    zone,
    kind,
    orchestrator: kindDef.orchestrator,
    gpuModelId,
    gpuCount,
    nodeCount,
    gpusPerNode,
    cpuCoresPerNode,
    memGbPerNode,
    localNvmeTbPerNode,
    fabric: rng.pick(FABRIC_BY_KIND[kind]),
    powerKw,
    status,
    health,
    utilization,
    memUtilization: clamp(utilization + rng.range(-0.12, 0.1), 0.05, 0.99),
    createdAt: Date.now() - rng.int(5, 720) * 86400000,
    provisionProgress: status === "provisioning" ? rng.int(8, 92) : 100,
    tags: rng.pickMany(
      ["production", "research", "confidential", "burst", "multi-tenant", "reserved", "pilot"],
      rng.int(1, 3)
    ),
    sla: rng.pick([99.0, 99.5, 99.9, 99.95]),
    ownerTeamId: "",
    costPerHour,
    pinned: rng.next() < 0.25,
    notes: "",
  };
}

function makeUsers(rng: Rng, teams: Team[]): User[] {
  const users: User[] = [];
  const count = 56;
  for (let i = 0; i < count; i++) {
    const first = rng.pick(FIRST_NAMES);
    const last = rng.pick(LAST_NAMES);
    const team = rng.pick(teams);
    const role = rng.pick(ROLES);
    const name = `${first} ${last}`;
    users.push({
      id: `u-${i}-${hashString(name).toString(36).slice(0, 3)}`,
      name,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@aethergrid.ai`,
      teamId: team.id,
      role,
      status: rng.next() < 0.05 ? "suspended" : "active",
      gpuHours30d: +rng.range(12, 2400).toFixed(1),
      cost30d: 0,
      initials: `${first[0]}${last[0]}`.toUpperCase(),
      hue: rng.int(0, 359),
    });
  }
  return users;
}

function makeFilesystems(rng: Rng, cluster: Cluster): Filesystem[] {
  const totalGpu = cluster.gpuCount;
  const defs: { name: string; type: Filesystem["type"] }[] = [
    { name: `${cluster.name.toLowerCase()}-lustre-scratch`, type: "Lustre" },
    { name: `${cluster.name.toLowerCase()}-weka-home`, type: "GPFS" },
    { name: `${cluster.name.toLowerCase()}-dataset-store`, type: "S3 Object" },
  ];
  if (rng.next() < 0.4) {
    defs.push({ name: `${cluster.name.toLowerCase()}-nvmeof-cache`, type: "NVMe-oF" });
  }
  return defs.map((d, i) => {
    const capacity = +rng.range(0.4, 8) * (totalGpu / 64 + 1) * 100;
    const used = capacity * rng.range(0.35, 0.92);
    const status: Filesystem["status"] =
      rng.next() < 0.05 ? "warning" : "healthy";
    return {
      id: `${cluster.id}-fs-${i}`,
      clusterId: cluster.id,
      name: d.name,
      type: d.type,
      capacityTb: +capacity.toFixed(0),
      usedTb: +used.toFixed(0),
      readGbps: +rng.range(20, 480).toFixed(0),
      writeGbps: +rng.range(15, 360).toFixed(0),
      iops: Math.round(rng.range(80_000, 1_400_000)),
      status,
    };
  });
}

function makeFabrics(rng: Rng, cluster: Cluster): Fabric[] {
  const gpu = cluster.gpuCount;
  const isIB = cluster.fabric.includes("InfiniBand");
  const fabrics: Fabric[] = [
    {
      id: `${cluster.id}-fab-compute`,
      clusterId: cluster.id,
      kind: isIB ? "InfiniBand" : "Ethernet",
      portsTotal: Math.round(gpu * 1.5),
      portsUp: Math.round(gpu * 1.5 * rng.range(0.96, 0.999)),
      bwTbps: +rng.range(60, 1200).toFixed(0),
      errors: rng.next() < 0.2 ? rng.int(1, 24) : 0,
      latencyUs: +rng.range(0.6, 4.2).toFixed(2),
      status: "healthy",
    },
  ];
  if (cluster.fabric.includes("NVLink")) {
    fabrics.push({
      id: `${cluster.id}-fab-nvlink`,
      clusterId: cluster.id,
      kind: "NVLink",
      portsTotal: Math.round(gpu * 0.5),
      portsUp: Math.round(gpu * 0.5 * rng.range(0.97, 1)),
      bwTbps: +rng.range(400, 1800).toFixed(0),
      errors: 0,
      latencyUs: +rng.range(0.1, 0.9).toFixed(2),
      status: "healthy",
    });
  }
  return fabrics;
}

function makeJobs(
  rng: Rng,
  clusters: Cluster[],
  users: User[],
  now: number
): Job[] {
  const jobs: Job[] = [];
  let counter = 1000;
  for (const cluster of clusters) {
    const count = rng.int(6, 18);
    for (let i = 0; i < count; i++) {
      const user = rng.pick(users);
      const stateRoll = rng.next();
      const state: JobState =
        stateRoll < 0.44
          ? "running"
          : stateRoll < 0.66
            ? "pending"
            : stateRoll < 0.9
              ? "completed"
              : stateRoll < 0.95
                ? "failed"
                : rng.pick(["cancelled", "paused", "held"]);
      const nodesRequested = Math.max(1, Math.round(rng.int(1, Math.min(cluster.nodeCount, 24))));
      const gpusRequested = nodesRequested * cluster.gpusPerNode;
      const requestedRuntimeSec = rng.pick([1800, 3600, 7200, 14400, 86400, 259200]);
      const startedAt = state === "running" || state === "completed" || state === "failed"
        ? now - rng.int(120, requestedRuntimeSec)
        : undefined;
      const runtimeSec =
        state === "running"
          ? Math.min(requestedRuntimeSec, now - (startedAt ?? now))
          : state === "completed"
            ? requestedRuntimeSec
            : startedAt
              ? now - startedAt
              : 0;
      const priority: JobPriority = rng.pick(["low", "normal", "normal", "high", "urgent"]);
      const framework = rng.pick(FRAMEWORKS);
      const networkBound = framework === "vLLM" || framework === "Triton Inference" || framework === "SGLang";
      jobs.push({
        id: `job-${counter++}`,
        name: `${rng.pick(JOB_PREFIXES)}-${rng.pick(["v1", "v2", "v3", "exp", "prod"])}-${rng.int(100, 999)}`,
        userId: user.id,
        teamId: user.teamId,
        clusterId: cluster.id,
        partition: networkBound ? "gpu-infer" : rng.pick(DEFAULT_PARTITIONS),
        nodesRequested,
        gpusRequested,
        cpuRequested: nodesRequested * cluster.cpuCoresPerNode,
        memRequestedGb: nodesRequested * Math.round(cluster.memGbPerNode * 0.6),
        priority,
        state,
        submittedAt: now - rng.int(300, 604800),
        startedAt,
        endedAt: state === "completed" || state === "failed" ? now - rng.int(60, 20000) : undefined,
        runtimeSec,
        requestedRuntimeSec,
        progress:
          state === "running"
            ? clamp(runtimeSec / requestedRuntimeSec, 0, 1)
            : state === "completed"
              ? 1
              : 0,
        exitCode: state === "failed" ? rng.pick([1, 2, 134, 137]) : state === "completed" ? 0 : undefined,
        framework,
        networkClass: networkBound ? rng.pick(["roce", "ethernet", "infiniband"]) : rng.pick(["infiniband", "roce"]),
        preemptible: rng.next() < 0.3,
        gang: nodesRequested > 1 && !networkBound,
        checkpointable: rng.pick(TRAINING_FRAMEWORKS).includes(framework),
        migrating: false,
      });
    }
  }
  return jobs;
}

function makeAlerts(
  rng: Rng,
  clusters: Cluster[],
  nodes: ClusterNode[],
  now: number
): Alert[] {
  const alerts: Alert[] = [];
  for (const cluster of clusters) {
    const clusterNodes = nodes.filter((n) => n.clusterId === cluster.id);
    const count = cluster.status === "ready" ? rng.int(0, 4) : rng.int(3, 7);
    for (let i = 0; i < count; i++) {
      const template = rng.pick(ALERT_TEMPLATES);
      const node = rng.next() < 0.75 ? rng.pick(clusterNodes) : undefined;
      const gpuIndex =
        node && node.gpus.length && template.metric ? rng.int(0, node.gpus.length - 1) : undefined;
      alerts.push({
        id: `${cluster.id}-alert-${i}-${hashString(template.code + i + cluster.id).toString(36)}`,
        clusterId: cluster.id,
        nodeId: node?.id,
        gpuIndex,
        severity: template.severity,
        source: template.source,
        code: template.code,
        title: template.title,
        detail: template.detail,
        metric: template.metric,
        value: template.metric ? +rng.range(1, 100).toFixed(1) : undefined,
        raisedAt: now - rng.int(60, 172800),
        state: rng.next() < 0.25 ? "acknowledged" : "active",
        remediationSteps: stepsFor(template.code),
        remediatedSteps: 0,
      });
    }
  }
  return alerts.sort((a, b) => b.raisedAt - a.raisedAt);
}

function makeHistory(rng: Rng, clusters: Cluster[], now: number): Record<string, MetricSample[]> {
  const history: Record<string, MetricSample[]> = {};
  const SAMPLES = 60;
  for (const cluster of clusters) {
    const samples: MetricSample[] = [];
    let u = cluster.utilization;
    for (let i = SAMPLES - 1; i >= 0; i--) {
      u = clamp(u + rng.gaussian(0, 0.03), 0.03, 0.99);
      samples.push({
        t: now - i * 5000,
        gpuUtil: u,
        memUtil: clamp(u + rng.range(-0.1, 0.1), 0.05, 0.99),
        powerKw: cluster.powerKw * (0.55 + u * 0.45),
        netGbps: cluster.gpuCount * 3.4 * (0.3 + u * 0.7),
        tempC: 42 + u * 30 + rng.range(-2, 2),
        jobThroughput: rng.range(2, 40),
        storageIops: Math.round(rng.range(80_000, 1_400_000) * (0.4 + u * 0.6)),
        storageGbps: rng.range(40, 420) * (0.4 + u * 0.6),
      });
    }
    history[cluster.id] = samples;
  }
  return history;
}

function makeGlobalHistory(history: Record<string, MetricSample[]>): MetricSample[] {
  const ids = Object.keys(history);
  if (ids.length === 0) return [];
  const len = history[ids[0]].length;
  const out: MetricSample[] = [];
  for (let i = 0; i < len; i++) {
    let gpu = 0;
    let mem = 0;
    let power = 0;
    let net = 0;
    let temp = 0;
    let jobs = 0;
    let iops = 0;
    let sgb = 0;
    for (const id of ids) {
      const s = history[id][i];
      gpu += s.gpuUtil;
      mem += s.memUtil;
      power += s.powerKw;
      net += s.netGbps;
      temp += s.tempC;
      jobs += s.jobThroughput;
      iops += s.storageIops;
      sgb += s.storageGbps;
    }
    out.push({
      t: history[ids[0]][i].t,
      gpuUtil: gpu / ids.length,
      memUtil: mem / ids.length,
      powerKw: power,
      netGbps: net,
      tempC: temp / ids.length,
      jobThroughput: jobs,
      storageIops: Math.round(iops / ids.length),
      storageGbps: sgb,
    });
  }
  return out;
}

function makeActivity(rng: Rng, clusters: Cluster[], users: User[], now: number): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const kinds: ActivityEvent["kind"][] = ["cluster", "job", "alert", "user", "provision", "scale", "fabric"];
  for (let i = 0; i < 24; i++) {
    const kind = rng.pick(kinds);
    const cluster = rng.pick(clusters);
    const user = rng.pick(users);
    let message = "";
    let severity: ActivityEvent["severity"] = "info";
    switch (kind) {
      case "cluster":
        message = `${cluster.name} health check passed across ${cluster.nodeCount} nodes`;
        break;
      case "job":
        message = `${user.name} submitted ${rng.pick(JOB_PREFIXES)} job to ${cluster.name}`;
        break;
      case "alert":
        message = `Alert raised on ${cluster.name}: ${rng.pick(ALERT_TEMPLATES).title}`;
        severity = "warning";
        break;
      case "user":
        message = `${user.name} granted ${rng.pick(["researcher", "ml-engineer", "viewer"])} role`;
        break;
      case "provision":
        message = `Provisioning started for new cluster in ${cluster.regionId}`;
        severity = "info";
        break;
      case "scale":
        message = `${cluster.name} auto-scaled to ${cluster.nodeCount} nodes`;
        break;
      case "fabric":
        message = `Fabric health sweep completed on ${cluster.name}`;
        break;
    }
    events.push({
      id: `ev-${i}-${hashString(message + i).toString(36)}`,
      t: now - rng.int(30, 86400),
      kind,
      severity,
      actor: rng.pick(["scheduler", "dcgm", "autoscaler", user.name, "system"]),
      message,
      clusterId: cluster.id,
    });
  }
  return events.sort((a, b) => b.t - a.t);
}

function makeRacks(rng: Rng, cluster: Cluster, nodes: ClusterNode[]): Rack[] {
  const gpuNodes = nodes.filter((n) => n.clusterId === cluster.id && n.role === "gpu-worker");
  const byRack = new Map<string, ClusterNode[]>();
  for (const n of gpuNodes) {
    const list = byRack.get(n.rack) ?? [];
    list.push(n);
    byRack.set(n.rack, list);
  }
  return Array.from(byRack.entries()).map(([name, rackNodes]) => {
    const powerDraw = rackNodes.reduce((s, n) => s + n.powerW, 0) / 1000;
    const coolant = rng.range(28, 42);
    return {
      id: `${cluster.id}-${name}`,
      clusterId: cluster.id,
      name,
      powerCapacityKw: Math.max(40, Math.round(powerDraw * rng.range(1.15, 1.45))),
      inletTempC: +rng.range(18, 27).toFixed(1),
      coolantTempC: +coolant.toFixed(1),
      airflowCfm: Math.round(rng.range(3200, 8200)),
      status: rackNodes.some((n) => n.status === "critical") ? "critical" : rackNodes.some((n) => n.status === "warning") ? "warning" : "healthy",
      nodeIds: rackNodes.map((n) => n.id),
    };
  });
}

function makeTopology(rng: Rng, cluster: Cluster, nodes: ClusterNode[]): TopologyBlock[] {
  const gpuNodes = nodes.filter((n) => n.clusterId === cluster.id && n.role === "gpu-worker");
  const blockSize = cluster.kind === "DGX SuperPOD" || cluster.kind === "DGX BasePOD" ? 18 : 24;
  const connectivity: Connectivity = cluster.fabric.includes("NVLink")
    ? "nvlink-domain"
    : cluster.fabric.includes("InfiniBand")
      ? "infiniband-island"
      : "ethernet-pod";
  const blocks: TopologyBlock[] = [];
  const count = Math.max(1, Math.ceil(gpuNodes.length / blockSize));
  for (let i = 0; i < count; i++) {
    const nodeIds = gpuNodes.slice(i * blockSize, (i + 1) * blockSize).map((n) => n.id);
    blocks.push({
      id: `${cluster.id}-block-${i}`,
      clusterId: cluster.id,
      name: `Block ${String.fromCharCode(65 + i)}`,
      connectivity,
      nodeIds,
      oversubscription: +rng.range(1, cluster.gpuCount > 512 ? 2.5 : 1.6).toFixed(2),
      bandwidthTbps: +rng.range(40, 480).toFixed(0),
    });
  }
  return blocks;
}

function makeConfig(rng: Rng, cluster: Cluster, index: number, now: number): ClusterConfig {
  const presets = ["baseline", "throughput", "efficiency", "debug"];
  const name = `${cluster.name.toLowerCase()}-${rng.pick(presets)}-${index}`;
  return {
    id: `cfg-${hashString(name + index).toString(36)}`,
    name,
    clusterId: cluster.id,
    partition: rng.pick(DEFAULT_PARTITIONS),
    gpuClockCapMhz: rng.pick([1980, 1800, 1600, 1410]),
    powerCapPct: rng.pick([100, 90, 80, 70]),
    migEnabled: rng.next() < 0.35,
    migProfile: rng.pick(["1g.10gb", "2g.20gb", "3g.40gb", "7g.80gb"]),
    cudaVersion: rng.pick(["12.4", "12.5", "12.6", "12.9"]),
    driverVersion: rng.pick(["550.54", "555.42", "560.28", "570.10"]),
    ncclEnabled: rng.next() < 0.8,
    gdrEnabled: rng.next() < 0.5,
    egressLimitGb: rng.pick([500, 1000, 5000]),
    priorityClass: rng.pick(["low", "normal", "high", "urgent"]),
    preemptible: rng.next() < 0.4,
    validate: rng.next() < 0.6,
    createdAt: now - rng.int(1, 90) * 86400000,
    updatedAt: now - rng.int(0, 20) * 86400000,
  };
}

function makeReservations(rng: Rng, clusters: Cluster[], teams: Team[], now: number): Reservation[] {
  const out: Reservation[] = [];
  for (const cluster of clusters) {
    const count = rng.int(0, 2);
    for (let i = 0; i < count; i++) {
      const startAt = now - rng.int(0, 3) * 86400000 + rng.int(-6, 48) * 3600000;
      out.push({
        id: `${cluster.id}-rsv-${i}`,
        clusterId: cluster.id,
        teamId: rng.pick(teams).id,
        name: rng.pick(RESERVATION_NAMES),
        gpuCount: Math.max(8, Math.round(cluster.gpuCount * rng.range(0.05, 0.22))),
        startAt,
        endAt: startAt + rng.int(6, 72) * 3600000,
      });
    }
  }
  return out;
}

function makeMetering(rng: Rng, cluster: Cluster, filesystems: Filesystem[]): ClusterMetering {
  return {
    gpuHours24h: +(cluster.gpuCount * 24 * rng.range(0.45, 0.95)).toFixed(0),
    storageTb: +filesystems.filter((f) => f.clusterId === cluster.id).reduce((s, f) => s + f.usedTb, 0).toFixed(0),
    egressGb24h: +(cluster.gpuCount * rng.range(20, 220)).toFixed(0),
    reservedGpus: Math.round(cluster.gpuCount * rng.range(0.1, 0.35)),
    spotGpus: Math.round(cluster.gpuCount * rng.range(0.05, 0.3)),
  };
}

function makePxe(rng: Rng, node: ClusterNode, now: number): PxeState {
  const clusterProvisioning = false;
  const stage: PxeStage = node.status === "provisioning" ? rng.pick(["dhcp", "tftp", "image", "drivers"]) : "healthy";
  const idx = PXE_SEQUENCE.indexOf(stage);
  const progress = clusterProvisioning ? rng.range(10, 90) : stage === "healthy" ? 100 : rng.range(10, 90);
  const logs = PXE_SEQUENCE.slice(0, Math.max(1, idx + 1)).map((s, i) => ({
    t: now - (idx - i) * 4000,
    stage: s,
    message: pxeMessage(s),
  }));
  return {
    nodeId: node.id,
    clusterId: node.clusterId,
    stage,
    progress: +progress.toFixed(0),
    startedAt: now - rng.int(60, 86400),
    updatedAt: now,
    attempts: rng.next() < 0.1 ? rng.int(2, 3) : 1,
    lastError: node.status === "critical" ? "netboot timeout" : undefined,
    logs,
  };
}

function makeSwitches(rng: Rng, cluster: Cluster): FabricSwitch[] {
  const switches: FabricSwitch[] = [];
  const planes = cluster.gpuCount >= 1024 ? 4 : cluster.gpuCount >= 256 ? 2 : 1;
  const leaves = Math.max(2, Math.ceil(cluster.nodeCount / 16));
  const spines = Math.max(2, Math.ceil(leaves / 4));
  const isIB = cluster.fabric.includes("InfiniBand");
  const kindTier = isIB ? "InfiniBand" : "Ethernet";
  void kindTier;

  for (let p = 0; p < planes; p++) {
    for (let r = 0; r < (isIB ? 2 : 1); r++) {
      for (let i = 0; i < leaves; i++) {
        const portsTotal = 64;
        const portsUp = Math.round(portsTotal * rng.range(0.9, 1));
        switches.push({
          id: `${cluster.id}-leaf-p${p}-r${r}-${i}`,
          clusterId: cluster.id,
          tier: "leaf",
          plane: p,
          rail: isIB ? r : undefined,
          name: `leaf-${String.fromCharCode(65 + p)}${r}${String(i + 1).padStart(2, "0")}`,
          portsTotal,
          portsUp,
          downlinks: Math.round(portsUp * 0.75),
          uplinks: Math.round(portsUp * 0.25),
          utilPct: +rng.range(35, 92).toFixed(0),
          errors: rng.next() < 0.15 ? rng.int(1, 20) : 0,
          status: rng.next() < 0.06 ? "warning" : "healthy",
        });
      }
    }
    for (let i = 0; i < spines; i++) {
      const portsTotal = 128;
      const portsUp = Math.round(portsTotal * rng.range(0.92, 1));
      switches.push({
        id: `${cluster.id}-spine-p${p}-${i}`,
        clusterId: cluster.id,
        tier: "spine",
        plane: p,
        name: `spine-${String.fromCharCode(65 + p)}${String(i + 1).padStart(2, "0")}`,
        portsTotal,
        portsUp,
        downlinks: Math.round(portsUp * 0.85),
        uplinks: Math.round(portsUp * 0.15),
        utilPct: +rng.range(30, 80).toFixed(0),
        errors: rng.next() < 0.1 ? rng.int(1, 12) : 0,
        status: "healthy",
      });
    }
  }
  if (cluster.gpuCount >= 2048) {
    for (let i = 0; i < 2; i++) {
      switches.push({
        id: `${cluster.id}-super-${i}`,
        clusterId: cluster.id,
        tier: "super-spine",
        plane: 0,
        name: `super-spine-${String(i + 1).padStart(2, "0")}`,
        portsTotal: 256,
        portsUp: 256,
        downlinks: 200,
        uplinks: 56,
        utilPct: +rng.range(25, 70).toFixed(0),
        errors: 0,
        status: "healthy",
      });
    }
  }
  return switches;
}

function makePools(rng: Rng, cluster: Cluster, teams: Team[]): NodePool[] {
  const defs: { kind: PoolKind; name: string }[] = [
    { kind: "reserved", name: "reserved-base" },
    { kind: "spot", name: "spot-opportunistic" },
    { kind: "preempt", name: "preempt-burst" },
  ];
  return defs.map((d, i) => {
    const share = d.kind === "reserved" ? rng.range(0.5, 0.7) : d.kind === "spot" ? rng.range(0.15, 0.3) : rng.range(0.1, 0.2);
    const gpuCount = Math.max(8, Math.round(cluster.gpuCount * share));
    return {
      id: `${cluster.id}-pool-${i}`,
      clusterId: cluster.id,
      name: `${cluster.name.toLowerCase()}-${d.name}`,
      kind: d.kind,
      state: "active" as PoolState,
      nodeCount: Math.max(1, Math.round(cluster.nodeCount * share)),
      gpuCount,
      baselineDiscount: d.kind === "reserved" ? 0.35 : d.kind === "spot" ? 0.62 : 0.55,
      currentDiscount: +(d.kind === "reserved" ? 0.35 : rng.range(0.4, 0.75)).toFixed(2),
      utilization: +rng.range(0.3, 0.98).toFixed(2),
      evictionRate: +(d.kind === "spot" ? rng.range(0.5, 4) : d.kind === "preempt" ? rng.range(1, 6) : 0).toFixed(2),
      teams: rng.pickMany(teams.map((t) => t.id), rng.int(1, Math.min(4, teams.length))),
    };
  });
}

function makeCanary(rng: Rng, cluster: Cluster, config: ClusterConfig, now: number): CanaryDeploy {
  const batchCount = 4;
  const canaryPct = 0.1;
  const currentBatch = rng.int(0, batchCount - 1);
  const stateRoll = rng.next();
  const state: CanaryState = stateRoll < 0.45 ? "rolling" : stateRoll < 0.65 ? "pending" : stateRoll < 0.85 ? "promoted" : "aborted";
  const batches = Array.from({ length: batchCount }, (_, i) => {
    const pct = i === 0 ? 0.1 : i === 1 ? 0.25 : i === 2 ? 0.5 : 0.15;
    const batchState: "waiting" | "rolling" | "done" | "failed" =
      state === "promoted" ? "done" : i < currentBatch ? "done" : i === currentBatch && state === "rolling" ? "rolling" : "waiting";
    return { name: `batch-${i + 1}`, nodeCount: Math.max(1, Math.round(cluster.nodeCount * pct)), pct, state: batchState };
  });
  return {
    id: `${cluster.id}-canary-${config.id.slice(-4)}`,
    clusterId: cluster.id,
    configId: config.id,
    name: `${config.name}-rollout`,
    version: `v${rng.int(1, 5)}.${rng.int(0, 9)}.${rng.int(0, 9)}`,
    state,
    batches,
    currentBatch: state === "promoted" ? batchCount : currentBatch,
    canaryPct,
    errorBudgetPct: +rng.range(0.05, 0.5).toFixed(2),
    startedAt: now - rng.int(600, 86400),
    updatedAt: now - rng.int(0, 600),
    rolloutGates: [
      { name: "DCGM health", passed: rng.next() < 0.9 },
      { name: "ECC clean", passed: rng.next() < 0.95 },
      { name: "Fabric up", passed: rng.next() < 0.92 },
      { name: "Job success rate", passed: rng.next() < 0.85 },
    ],
  };
}

function makeFleetIndex(rng: Rng, clusters: Cluster[], nodes: ClusterNode[]): Record<string, FleetIndexRow[]> {
  const index: Record<string, FleetIndexRow[]> = {};
  const HARD_CAP = 1200; // per-materialised-cluster synthetic rows (keeps total bounded)
  for (const cluster of clusters) {
    const rows: FleetIndexRow[] = [];
    const clusterNodes = nodes.filter((n) => n.clusterId === cluster.id && n.role === "gpu-worker");
    // materialized rows from real nodes
    for (const n of clusterNodes) {
      const avgUtil = n.gpus.length ? n.gpus.reduce((s, g) => s + g.utilPct, 0) / n.gpus.length / 100 : 0;
      const maxTemp = n.gpus.length ? Math.max(...n.gpus.map((g) => g.tempC)) : 0;
      rows.push({
        id: n.id,
        clusterId: cluster.id,
        clusterName: cluster.name,
        hostname: n.hostname,
        regionId: cluster.regionId,
        rack: n.rack,
        slot: n.slot,
        gpuModelId: cluster.gpuModelId,
        gpuCount: n.gpus.length,
        utilization: +avgUtil.toFixed(3),
        tempC: +maxTemp.toFixed(0),
        powerW: n.powerW,
        status: n.status,
        pxeStage: n.status === "provisioning" ? "image" : "healthy",
        poolKind: rng.pick(["reserved", "spot", "preempt"] as PoolKind[]),
        materialized: true,
      });
    }
    // synthetic tail rows represent the rest of the fleet for the virtual table
    const target = Math.min(cluster.nodeCount, HARD_CAP);
    for (let i = rows.length; i < target; i++) {
      const rack = Math.floor(i / 8) + 1;
      rows.push({
        id: `${cluster.id}-virt-${i}`,
        clusterId: cluster.id,
        clusterName: cluster.name,
        hostname: `${cluster.name.slice(0, 3).toLowerCase()}-gpu-${String(rack).padStart(2, "0")}${String((i % 8) + 1).padStart(2, "0")}`,
        regionId: cluster.regionId,
        rack: `R${String(rack).padStart(2, "0")}`,
        slot: (i % 8) + 1,
        gpuModelId: cluster.gpuModelId,
        gpuCount: cluster.gpusPerNode,
        utilization: +rng.range(0, 1).toFixed(3),
        tempC: +rng.range(38, 88).toFixed(0),
        powerW: Math.round(GPU_BY_ID[cluster.gpuModelId].typicalPowerW * cluster.gpusPerNode * rng.range(0.4, 1)),
        status: rng.next() < 0.02 ? "warning" : rng.next() < 0.005 ? "critical" : "healthy",
        pxeStage: rng.next() < 0.01 ? rng.pick(["dhcp", "tftp", "image", "drivers", "dcgm"]) : "healthy",
        poolKind: rng.pick(["reserved", "spot", "preempt"] as PoolKind[]),
        materialized: false,
      });
    }
    index[cluster.id] = rows;
  }
  return index;
}

export function generateState(seed: number): SimState {
  const rng = new Rng(seed);
  const now = Date.now();

  const teams: Team[] = TEAM_DEFS.map((t, i) => ({
    id: `team-${i}`,
    name: t.name,
    color: t.color,
    quota: {
      gpuLimit: rng.pick([64, 128, 256, 512]),
      cpuLimit: rng.pick([2048, 4096, 8192]),
      memLimitGb: rng.pick([8192, 16384, 32768]),
      storageLimitTb: rng.pick([500, 1000, 2500]),
      costLimitUsd: rng.pick([250_000, 500_000, 1_000_000]),
    },
    gpuHours30d: 0,
    cost30d: 0,
  }));

  const users = makeUsers(rng, teams);

  const clusters: Cluster[] = [];
  const usedNames = new Set<string>();
  let ci = 0;
  for (const region of REGIONS) {
    const clusterCount =
      region.tier === "flagship" ? rng.int(2, 3) : region.tier === "standard" ? rng.int(1, 3) : rng.int(1, 2);
    for (let k = 0; k < clusterCount; k++) {
      const zone = rng.pick(region.zones);
      const cluster = makeCluster(rng, region.id, zone, region.tier, usedNames, ci++);
      cluster.ownerTeamId = rng.pick(teams).id;
      clusters.push(cluster);
    }
  }

  const nodes: ClusterNode[] = [];
  const MAX_VISIBLE_GPU_NODES = 28;
  for (const cluster of clusters) {
    const gpuNodeCount = Math.min(cluster.nodeCount, MAX_VISIBLE_GPU_NODES);
    const racks = Math.max(1, Math.ceil(gpuNodeCount / 8));
    let slot = 1;
    for (let i = 0; i < gpuNodeCount; i++) {
      const rack = Math.floor(i / 8) + 1;
      nodes.push(makeNode(rng, cluster, rack, ((i % 8) + 1), "gpu-worker", i));
    }
    const infra: NodeRole[] = ["head", "login", "storage", "management"];
    for (let i = 0; i < infra.length; i++) {
      nodes.push(makeNode(rng, cluster, racks + 1, i + 1, infra[i], i));
    }
  }

  const jobs = makeJobs(rng, clusters, users, now);
  const alerts = makeAlerts(rng, clusters, nodes, now);
  const filesystems = clusters.flatMap((c) => makeFilesystems(rng, c));
  const fabrics = clusters.flatMap((c) => makeFabrics(rng, c));
  const history = makeHistory(rng, clusters, now);
  const globalHistory = makeGlobalHistory(history);
  const activity = makeActivity(rng, clusters, users, now);

  const racks: Record<string, Rack[]> = {};
  const topology: Record<string, TopologyBlock[]> = {};
  const settings: Record<string, ClusterSettings> = {};
  const metering: Record<string, ClusterMetering> = {};
  for (const cluster of clusters) {
    racks[cluster.id] = makeRacks(rng, cluster, nodes);
    topology[cluster.id] = makeTopology(rng, cluster, nodes);
    settings[cluster.id] = {
      ...DEFAULT_SETTINGS,
      autoscaling: rng.next() < 0.6,
      powerSteering: rng.next() < 0.5,
      migEnabled: rng.next() < 0.3,
      isolation: rng.pick(["namespace", "vlan", "physical"]),
      defaultPartition: rng.pick(DEFAULT_PARTITIONS),
      preemption: rng.next() < 0.7,
    };
    metering[cluster.id] = makeMetering(rng, cluster, filesystems);
  }
  const reservations = makeReservations(rng, clusters, teams, now);
  const configs: ClusterConfig[] = [];
  let cfgCounter = 1;
  for (const cluster of clusters) {
    const count = rng.int(0, 3);
    for (let i = 0; i < count; i++) {
      configs.push(makeConfig(rng, cluster, cfgCounter++, now));
    }
  }

  // New: PXE state, fabric switches, pools, canaries, virtual fleet index.
  const pxe: Record<string, PxeState> = {};
  for (const node of nodes) {
    pxe[node.id] = makePxe(rng, node, now);
  }
  const switches: Record<string, FabricSwitch[]> = {};
  const pools: NodePool[] = [];
  const canaries: CanaryDeploy[] = [];
  for (const cluster of clusters) {
    switches[cluster.id] = makeSwitches(rng, cluster);
    pools.push(...makePools(rng, cluster, teams));
    for (const config of configs.filter((c) => c.clusterId === cluster.id)) {
      if (rng.next() < 0.6) canaries.push(makeCanary(rng, cluster, config, now));
    }
  }
  const fleetIndex = makeFleetIndex(rng, clusters, nodes);
  const priceBook: PriceBook = {
    computePerGpuHour: 3.4,
    storagePerTbMonth: 42,
    egressPerGb: 0.09,
    reservedDiscount: 0.35,
    spotDiscount: 0.62,
  };

  for (const user of users) {
    user.cost30d = +(user.gpuHours30d * (GPU_BY_ID[rng.pick(GPU_CATALOG).id].msrpPerGpuHour * 0.8)).toFixed(0);
  }
  for (const team of teams) {
    team.gpuHours30d = users
      .filter((u) => u.teamId === team.id)
      .reduce((s, u) => s + u.gpuHours30d, 0);
    team.cost30d = users
      .filter((u) => u.teamId === team.id)
      .reduce((s, u) => s + u.cost30d, 0);
  }

  return {
    tick: 0,
    running: true,
    speed: 1,
    seed,
    generatedAt: now,
    regions: REGIONS,
    gpuCatalog: GPU_CATALOG,
    clusters,
    nodes,
    jobs,
    users,
    teams,
    alerts,
    filesystems,
    fabrics,
    racks,
    topology,
    settings,
    reservations,
    priceBook,
    metering,
    configs,
    notifications: [],
    pxe,
    switches,
    pools,
    canaries,
    fleetIndex,
    history,
    globalHistory,
    activity,
  };
}
