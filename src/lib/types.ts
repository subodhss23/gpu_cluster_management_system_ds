export type HealthStatus =
  | "healthy"
  | "warning"
  | "critical"
  | "offline"
  | "provisioning";

export type ProvisionState =
  | "ready"
  | "provisioning"
  | "deleting"
  | "degraded"
  | "offline";

export interface GpuSpec {
  id: string;
  name: string;
  arch: string;
  memoryGb: number;
  tdpW: number;
  typicalPowerW: number;
  fp16Tflops: number;
  hbmBandwidthGbps: number;
  boostClockMhz: number;
  interconnect: string;
  nvlinkGbps: number;
  msrpPerGpuHour: number;
  launched: number;
  tier: "flagship" | "workhorse" | "inference" | "edge";
}

export interface Region {
  id: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  zones: string[];
  tier: "flagship" | "standard" | "edge";
  powerCapacityMw: number;
  pue: number;
  carbonIntensity: number;
  renewablePct: number;
}

export type ClusterKind =
  | "DGX SuperPOD"
  | "DGX BasePOD"
  | "Kubernetes"
  | "Slurm"
  | "Run:AI"
  | "GPUStack";

export type Orchestrator =
  | "Base Command"
  | "Slurm"
  | "Kubernetes"
  | "Run:AI"
  | "GPUStack";

export interface Cluster {
  id: string;
  name: string;
  regionId: string;
  zone: string;
  kind: ClusterKind;
  orchestrator: Orchestrator;
  gpuModelId: string;
  gpuCount: number;
  nodeCount: number;
  gpusPerNode: number;
  cpuCoresPerNode: number;
  memGbPerNode: number;
  localNvmeTbPerNode: number;
  fabric: string;
  powerKw: number;
  status: ProvisionState;
  health: HealthStatus;
  utilization: number;
  memUtilization: number;
  createdAt: number;
  provisionProgress: number;
  tags: string[];
  sla: number;
  ownerTeamId: string;
  costPerHour: number;
  pinned: boolean;
  notes: string;
}

export interface GpuDevice {
  index: number;
  utilPct: number;
  memUsedGb: number;
  memTotalGb: number;
  tempC: number;
  powerW: number;
  smClockMhz: number;
  memClockMhz: number;
  xidErrors: number;
  eccErrors: number;
  throttle: "none" | "thermal" | "power" | "hw";
  migMode: string;
}

export type NodeRole =
  | "gpu-worker"
  | "head"
  | "login"
  | "storage"
  | "management";

export interface ClusterNode {
  id: string;
  hostname: string;
  clusterId: string;
  rack: string;
  slot: number;
  role: NodeRole;
  gpuModelId?: string;
  gpus: GpuDevice[];
  cpuCores: number;
  cpuUtilPct: number;
  memTotalGb: number;
  memUsedGb: number;
  nvmeUsedTb: number;
  nvmeTotalTb: number;
  netTxGbps: number;
  netRxGbps: number;
  status: HealthStatus;
  uptimeHours: number;
  powerW: number;
}

export type JobState =
  | "running"
  | "pending"
  | "completed"
  | "failed"
  | "cancelled"
  | "paused"
  | "held";

export type JobPriority = "low" | "normal" | "high" | "urgent";

export interface Job {
  id: string;
  name: string;
  userId: string;
  teamId: string;
  clusterId: string;
  partition: string;
  nodesRequested: number;
  gpusRequested: number;
  cpuRequested: number;
  memRequestedGb: number;
  priority: JobPriority;
  state: JobState;
  submittedAt: number;
  startedAt?: number;
  endedAt?: number;
  runtimeSec: number;
  requestedRuntimeSec: number;
  progress: number;
  exitCode?: number;
  framework: string;
  networkClass: "infiniband" | "roce" | "ethernet";
  preemptible: boolean;
  gang: boolean;
  checkpointable: boolean;
  migrating: boolean;
}

export type UserRole =
  | "admin"
  | "researcher"
  | "ml-engineer"
  | "viewer"
  | "service";

export interface User {
  id: string;
  name: string;
  email: string;
  teamId: string;
  role: UserRole;
  status: "active" | "suspended";
  gpuHours30d: number;
  cost30d: number;
  initials: string;
  hue: number;
}

export interface Quota {
  gpuLimit: number;
  cpuLimit: number;
  memLimitGb: number;
  storageLimitTb: number;
  costLimitUsd: number;
}

export interface Team {
  id: string;
  name: string;
  color: string;
  quota: Quota;
  gpuHours30d: number;
  cost30d: number;
}

export type AlertSeverity = "critical" | "warning" | "info";

export interface Alert {
  id: string;
  clusterId: string;
  nodeId?: string;
  gpuIndex?: number;
  severity: AlertSeverity;
  source: "DCGM" | "NVSM" | "Slurm" | "Fabric" | "Scheduler" | "Power";
  code: string;
  title: string;
  detail: string;
  metric?: string;
  value?: number;
  raisedAt: number;
  state: "active" | "acknowledged" | "resolved";
  remediationSteps: string[];
  remediatedSteps: number;
}

export type RemediationKind =
  | "drain-node"
  | "reboot-node"
  | "clear-xid"
  | "reset-ecc"
  | "reset-fabric"
  | "throttle-clock"
  | "cap-power"
  | "migrate-jobs"
  | "requeue-jobs"
  | "scale-out"
  | "enable-preemption"
  | "kill-idle-jobs"
  | "acknowledge"
  | "toggle-power-steering"
  | "raise-thermal-margin";

export interface RemediationStep {
  id: string;
  label: string;
  detail: string;
  kind: RemediationKind;
  effect: string;
  requiresNode?: boolean;
}

export interface Runbook {
  code: string;
  title: string;
  summary: string;
  rootCause: string;
  steps: RemediationStep[];
}

export interface ClusterConfig {
  id: string;
  name: string;
  clusterId: string;
  partition: string;
  gpuClockCapMhz: number;
  powerCapPct: number;
  migEnabled: boolean;
  migProfile: string;
  cudaVersion: string;
  driverVersion: string;
  ncclEnabled: boolean;
  gdrEnabled: boolean;
  egressLimitGb: number;
  priorityClass: JobPriority;
  preemptible: boolean;
  validate: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Filesystem {
  id: string;
  clusterId: string;
  name: string;
  type: "Lustre" | "GPFS" | "NFS" | "NVMe-oF" | "S3 Object";
  capacityTb: number;
  usedTb: number;
  readGbps: number;
  writeGbps: number;
  iops: number;
  status: HealthStatus;
}

export interface Fabric {
  id: string;
  clusterId: string;
  kind: "InfiniBand" | "Ethernet" | "NVLink";
  portsTotal: number;
  portsUp: number;
  bwTbps: number;
  errors: number;
  latencyUs: number;
  status: HealthStatus;
}

export interface MetricSample {
  t: number;
  gpuUtil: number;
  memUtil: number;
  powerKw: number;
  netGbps: number;
  tempC: number;
  jobThroughput: number;
  storageIops: number;
  storageGbps: number;
}

// --- PXE / bare-metal provisioning state machine -------------------------

export type PxeStage =
  | "queued"
  | "dhcp"
  | "tftp"
  | "bios-fw"
  | "image"
  | "drivers"
  | "dcgm"
  | "nvsm"
  | "fabric-join"
  | "scheduler"
  | "healthy"
  | "failed";

export interface PxeState {
  nodeId: string;
  clusterId: string;
  stage: PxeStage;
  progress: number;
  startedAt: number;
  updatedAt: number;
  attempts: number;
  lastError?: string;
  logs: { t: number; stage: PxeStage; message: string }[];
}

export const PXE_SEQUENCE: PxeStage[] = [
  "queued",
  "dhcp",
  "tftp",
  "bios-fw",
  "image",
  "drivers",
  "dcgm",
  "nvsm",
  "fabric-join",
  "scheduler",
  "healthy",
];

export function pxeMessage(stage: PxeStage): string {
  switch (stage) {
    case "queued":
      return "Node queued for provisioning";
    case "dhcp":
      return "DHCP lease acquired from provisioning VLAN";
    case "tftp":
      return "bootx64.efi fetched via TFTP";
    case "bios-fw":
      return "BIOS/firmware baseline applied";
    case "image":
      return "Base OS image streamed and written";
    case "drivers":
      return "NVIDIA driver + CUDA stack installed";
    case "dcgm":
      return "DCGM agent enrolled and hostengine started";
    case "nvsm":
      return "NVSM health monitor configured";
    case "fabric-join":
      return "Joined InfiniBand fabric; OFED up";
    case "scheduler":
      return "Registered as schedulable node";
    case "healthy":
      return "Node healthy and in service";
    case "failed":
      return "Provisioning failed";
    default:
      return stage;
  }
}

// --- InfiniBand fabric topology (switch / rail / plane level) -------------

export type SwitchTier = "leaf" | "spine" | "super-spine";

export interface FabricSwitch {
  id: string;
  clusterId: string;
  tier: SwitchTier;
  plane: number;
  rail?: number;
  name: string;
  portsTotal: number;
  portsUp: number;
  downlinks: number;
  uplinks: number;
  utilPct: number;
  errors: number;
  status: HealthStatus;
}

// --- Spot / preempt pools -------------------------------------------------

export type PoolKind = "spot" | "preempt" | "reserved";
export type PoolState = "active" | "draining" | "paused";

export interface NodePool {
  id: string;
  clusterId: string;
  name: string;
  kind: PoolKind;
  state: PoolState;
  nodeCount: number;
  gpuCount: number;
  baselineDiscount: number;
  currentDiscount: number;
  utilization: number;
  evictionRate: number;
  teams: string[];
}

// --- Canary deploys -------------------------------------------------------

export type CanaryState =
  | "pending"
  | "rolling"
  | "paused"
  | "promoted"
  | "aborted"
  | "failed";

export interface CanaryDeploy {
  id: string;
  clusterId: string;
  configId: string;
  name: string;
  version: string;
  state: CanaryState;
  batches: { name: string; nodeCount: number; pct: number; state: "waiting" | "rolling" | "done" | "failed" }[];
  currentBatch: number;
  canaryPct: number;
  errorBudgetPct: number;
  startedAt: number;
  updatedAt: number;
  rolloutGates: { name: string; passed: boolean }[];
}

export interface Rack {
  id: string;
  clusterId: string;
  name: string;
  powerCapacityKw: number;
  inletTempC: number;
  coolantTempC: number;
  airflowCfm: number;
  status: HealthStatus;
  nodeIds: string[];
}

export interface ClusterSettings {
  autoscaling: boolean;
  powerSteering: boolean;
  maintenanceWindow: string;
  defaultPartition: string;
  maxJobRuntimeSec: number;
  preemption: boolean;
  checkpointMinutes: number;
  migEnabled: boolean;
  isolation: "namespace" | "vlan" | "physical";
}

export type Connectivity =
  | "nvlink-domain"
  | "infiniband-island"
  | "ethernet-pod";

export interface TopologyBlock {
  id: string;
  clusterId: string;
  name: string;
  connectivity: Connectivity;
  nodeIds: string[];
  oversubscription: number;
  bandwidthTbps: number;
}

export interface Reservation {
  id: string;
  clusterId: string;
  teamId: string;
  name: string;
  gpuCount: number;
  startAt: number;
  endAt: number;
}

export interface PriceBook {
  computePerGpuHour: number;
  storagePerTbMonth: number;
  egressPerGb: number;
  reservedDiscount: number;
  spotDiscount: number;
}

export interface ClusterMetering {
  gpuHours24h: number;
  storageTb: number;
  egressGb24h: number;
  reservedGpus: number;
  spotGpus: number;
}

export interface ActivityEvent {
  id: string;
  t: number;
  kind:
    | "cluster"
    | "job"
    | "alert"
    | "user"
    | "provision"
    | "scale"
    | "fabric"
    | "health";
  severity: AlertSeverity;
  actor: string;
  message: string;
  clusterId?: string;
}

export interface Notification {
  id: string;
  t: number;
  severity: AlertSeverity;
  title: string;
  message: string;
  source: string;
  clusterId?: string;
  alertId?: string;
  read: boolean;
}

// --- Virtualized fleet index (large-scale node table) ---------------------

export interface FleetIndexRow {
  id: string;
  clusterId: string;
  clusterName: string;
  hostname: string;
  regionId: string;
  rack: string;
  slot: number;
  gpuModelId: string;
  gpuCount: number;
  utilization: number;
  tempC: number;
  powerW: number;
  status: HealthStatus;
  pxeStage: PxeStage | "n/a";
  poolKind: PoolKind;
  materialized: boolean;
}

export interface SimState {
  tick: number;
  running: boolean;
  speed: number;
  seed: number;
  generatedAt: number;
  regions: Region[];
  gpuCatalog: GpuSpec[];
  clusters: Cluster[];
  nodes: ClusterNode[];
  jobs: Job[];
  users: User[];
  teams: Team[];
  alerts: Alert[];
  filesystems: Filesystem[];
  fabrics: Fabric[];
  racks: Record<string, Rack[]>;
  topology: Record<string, TopologyBlock[]>;
  settings: Record<string, ClusterSettings>;
  reservations: Reservation[];
  priceBook: PriceBook;
  metering: Record<string, ClusterMetering>;
  configs: ClusterConfig[];
  notifications: Notification[];
  pxe: Record<string, PxeState>;
  switches: Record<string, FabricSwitch[]>;
  pools: NodePool[];
  canaries: CanaryDeploy[];
  fleetIndex: Record<string, FleetIndexRow[]>;
  history: Record<string, MetricSample[]>;
  globalHistory: MetricSample[];
  activity: ActivityEvent[];
}

export interface ProvisionRequest {
  name: string;
  regionId: string;
  zone: string;
  kind: ClusterKind;
  orchestrator: Orchestrator;
  gpuModelId: string;
  gpuCount: number;
  gpusPerNode: number;
  fabric: string;
  tags: string[];
  ownerTeamId: string;
}
