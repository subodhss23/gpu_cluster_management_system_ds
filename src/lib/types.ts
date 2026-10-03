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
