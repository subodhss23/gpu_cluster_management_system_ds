import type { GpuSpec, Orchestrator, Region } from "./types";

export const APP_NAME = "AetherGrid";
export const APP_TAGLINE = "AI Factory Control Plane";

export const GPU_CATALOG: GpuSpec[] = [
  {
    id: "b200",
    name: "NVIDIA B200 SXM",
    arch: "Blackwell",
    memoryGb: 180,
    tdpW: 1000,
    typicalPowerW: 780,
    fp16Tflops: 2250,
    hbmBandwidthGbps: 8000,
    boostClockMhz: 1965,
    interconnect: "NVLink 5",
    nvlinkGbps: 1800,
    msrpPerGpuHour: 8.4,
    launched: 2024,
    tier: "flagship",
  },
  {
    id: "gb200",
    name: "NVIDIA GB200 NVL72",
    arch: "Blackwell",
    memoryGb: 192,
    tdpW: 1200,
    typicalPowerW: 950,
    fp16Tflops: 2500,
    hbmBandwidthGbps: 8000,
    boostClockMhz: 1965,
    interconnect: "NVLink 5",
    nvlinkGbps: 1800,
    msrpPerGpuHour: 9.6,
    launched: 2024,
    tier: "flagship",
  },
  {
    id: "h200",
    name: "NVIDIA H200 SXM",
    arch: "Hopper",
    memoryGb: 141,
    tdpW: 700,
    typicalPowerW: 560,
    fp16Tflops: 1979,
    hbmBandwidthGbps: 4800,
    boostClockMhz: 1980,
    interconnect: "NVLink 4",
    nvlinkGbps: 900,
    msrpPerGpuHour: 5.2,
    launched: 2023,
    tier: "workhorse",
  },
  {
    id: "h100",
    name: "NVIDIA H100 SXM",
    arch: "Hopper",
    memoryGb: 80,
    tdpW: 700,
    typicalPowerW: 520,
    fp16Tflops: 1979,
    hbmBandwidthGbps: 3350,
    boostClockMhz: 1980,
    interconnect: "NVLink 4",
    nvlinkGbps: 900,
    msrpPerGpuHour: 3.9,
    launched: 2022,
    tier: "workhorse",
  },
  {
    id: "l40s",
    name: "NVIDIA L40S PCIe",
    arch: "Ada Lovelace",
    memoryGb: 48,
    tdpW: 350,
    typicalPowerW: 290,
    fp16Tflops: 733,
    hbmBandwidthGbps: 864,
    boostClockMhz: 2520,
    interconnect: "PCIe Gen4",
    nvlinkGbps: 0,
    msrpPerGpuHour: 1.6,
    launched: 2023,
    tier: "inference",
  },
  {
    id: "a100",
    name: "NVIDIA A100 SXM",
    arch: "Ampere",
    memoryGb: 80,
    tdpW: 400,
    typicalPowerW: 320,
    fp16Tflops: 624,
    hbmBandwidthGbps: 2039,
    boostClockMhz: 1410,
    interconnect: "NVLink 3",
    nvlinkGbps: 600,
    msrpPerGpuHour: 1.9,
    launched: 2020,
    tier: "inference",
  },
];

export const GPU_BY_ID: Record<string, GpuSpec> = Object.fromEntries(
  GPU_CATALOG.map((g) => [g.id, g])
);

export const REGIONS: Region[] = [
  {
    id: "us-west-1",
    name: "US West",
    city: "Santa Clara",
    country: "United States",
    lat: 37.35,
    lng: -121.95,
    zones: ["us-west-1a", "us-west-1b", "us-west-1c"],
    tier: "flagship",
    powerCapacityMw: 240,
    pue: 1.12,
    carbonIntensity: 145,
    renewablePct: 82,
  },
  {
    id: "us-east-1",
    name: "US East",
    city: "Ashburn",
    country: "United States",
    lat: 39.04,
    lng: -77.49,
    zones: ["us-east-1a", "us-east-1b"],
    tier: "flagship",
    powerCapacityMw: 180,
    pue: 1.18,
    carbonIntensity: 210,
    renewablePct: 61,
  },
  {
    id: "eu-central-1",
    name: "EU Central",
    city: "Frankfurt",
    country: "Germany",
    lat: 50.11,
    lng: 8.68,
    zones: ["eu-central-1a", "eu-central-1b"],
    tier: "standard",
    powerCapacityMw: 120,
    pue: 1.09,
    carbonIntensity: 88,
    renewablePct: 91,
  },
  {
    id: "ap-northeast-1",
    name: "Asia Pacific",
    city: "Tokyo",
    country: "Japan",
    lat: 35.68,
    lng: 139.69,
    zones: ["ap-northeast-1a"],
    tier: "standard",
    powerCapacityMw: 96,
    pue: 1.22,
    carbonIntensity: 168,
    renewablePct: 54,
  },
  {
    id: "ap-south-1",
    name: "Asia South",
    city: "Mumbai",
    country: "India",
    lat: 19.08,
    lng: 72.88,
    zones: ["ap-south-1a"],
    tier: "edge",
    powerCapacityMw: 48,
    pue: 1.34,
    carbonIntensity: 320,
    renewablePct: 38,
  },
];

export const FABRICS = [
  "InfiniBand NDR 400G",
  "InfiniBand XDR 800G",
  "Ethernet 400G RoCEv2",
  "NVLink 5 + InfiniBand NDR",
];

export const FRAMEWORKS = [
  "PyTorch",
  "TensorRT-LLM",
  "vLLM",
  "SGLang",
  "NeMo",
  "Megatron-LM",
  "JAX",
  "DeepSpeed",
  "RAPIDS",
  "Triton Inference",
];

export const TRAINING_FRAMEWORKS = ["PyTorch", "Megatron-LM", "NeMo", "JAX", "DeepSpeed"];

export const NETWORK_CLASSES = ["infiniband", "roce", "ethernet"] as const;
export type NetworkClass = (typeof NETWORK_CLASSES)[number];

export const RESERVATION_NAMES = [
  "Quarterly-Blackwell-Ramp",
  "Inference-SLA-Coverage",
  "Research-Burst-Window",
  "Model-Eval-Sprint",
  "Customer-Demo-Reserve",
  "Nightly-Pretraining-Block",
];

export const JOB_PREFIXES = [
  "llm-pretrain",
  "sft-finetune",
  "rlhf-train",
  "vision-seg",
  "recsys-embed",
  "rag-index",
  "diffusion-gen",
  "moe-train",
  "protein-fold",
  "asr-train",
  "eval-suite",
  "distill",
];

export const FIRST_NAMES = [
  "Ava",
  "Noah",
  "Mia",
  "Liam",
  "Zoe",
  "Kai",
  "Iris",
  "Omar",
  "Priya",
  "Diego",
  "Lena",
  "Yuki",
  "Nadia",
  "Ethan",
  "Sofia",
  "Marcus",
  "Aisha",
  "Hiro",
  "Elena",
  "Raj",
  "Maya",
  "Tomas",
  "Chloe",
  "Andre",
];

export const LAST_NAMES = [
  "Chen",
  "Patel",
  "Novak",
  "Okafor",
  "Kim",
  "Silva",
  "Haddad",
  "Rossi",
  "Nguyen",
  "Berg",
  "Ivanov",
  "Tanaka",
  "Garcia",
  "Muller",
  "Kaur",
  "Osei",
  "Laurent",
  "Dubois",
  "Sato",
  "Kowalski",
];

export const TEAM_DEFS: { name: string; color: string }[] = [
  { name: "Foundation Models", color: "#76b900" },
  { name: "Applied Research", color: "#22d3ee" },
  { name: "Inference Platform", color: "#a855f7" },
  { name: "Autonomy & Robotics", color: "#f59e0b" },
  { name: "Health AI", color: "#f43f5e" },
  { name: "Data Platform", color: "#3b82f6" },
  { name: "Simulation", color: "#10b981" },
  { name: "Security AI", color: "#fb923c" },
];

export const CLUSTER_KINDS: {
  kind: string;
  orchestrator: Orchestrator;
  blurb: string;
}[] = [
  {
    kind: "DGX SuperPOD",
    orchestrator: "Base Command",
    blurb: "Reference-architecture AI supercomputer with NVLink fabric and Mission Control.",
  },
  {
    kind: "DGX BasePOD",
    orchestrator: "Base Command",
    blurb: "Scalable pod for departmental AI training and inference workloads.",
  },
  {
    kind: "Slurm",
    orchestrator: "Slurm",
    blurb: "Industry-standard batch scheduler for tightly-coupled HPC and training jobs.",
  },
  {
    kind: "Kubernetes",
    orchestrator: "Kubernetes",
    blurb: "GPU Operator-managed cluster for containerized serving and pipelines.",
  },
  {
    kind: "Run:AI",
    orchestrator: "Run:AI",
    blurb: "Kubernetes orchestration with fractional GPU slicing and fairness policies.",
  },
  {
    kind: "GPUStack",
    orchestrator: "GPUStack",
    blurb: "Multi-cluster serving stack for vLLM, SGLang and TensorRT-LLM endpoints.",
  },
];

export const ALERT_TEMPLATES: {
  source: "DCGM" | "NVSM" | "Slurm" | "Fabric" | "Scheduler" | "Power";
  severity: "critical" | "warning" | "info";
  code: string;
  title: string;
  detail: string;
  metric?: string;
}[] = [
  {
    source: "DCGM",
    severity: "critical",
    code: "XID 79",
    title: "GPU has fallen off the bus",
    detail: "Device became unreachable over PCIe. Recommend drain and RMA evaluation.",
    metric: "gpu_state",
  },
  {
    source: "DCGM",
    severity: "critical",
    code: "XID 48",
    title: "Double-bit ECC error detected",
    detail: "Uncorrectable HBM ECC error. Row-remapping engaged, schedule maintenance.",
    metric: "ecc_dbe",
  },
  {
    source: "DCGM",
    severity: "warning",
    code: "XID 63",
    title: "ECC row remapping event",
    detail: "A row remap was recorded. Monitor for recurrence and track pending pages.",
    metric: "ecc_remap",
  },
  {
    source: "DCGM",
    severity: "warning",
    code: "THERM-01",
    title: "Thermal throttling engaged",
    detail: "SM clock reduced above 88°C. Verify airflow and rack inlet temperature.",
    metric: "temp_c",
  },
  {
    source: "Power",
    severity: "warning",
    code: "PWR-02",
    title: "Rack power budget exceeded",
    detail: "Rack draw is above the reserved budget. Power Steering is shedding load.",
    metric: "power_kw",
  },
  {
    source: "Fabric",
    severity: "warning",
    code: "IB-14",
    title: "InfiniBand link flap",
    detail: "Port flapped multiple times in the last interval. Check transceiver health.",
    metric: "link_errors",
  },
  {
    source: "NVSM",
    severity: "warning",
    code: "NVSM-07",
    title: "NVLink error counters rising",
    detail: "Correctable NVLink errors increased on a GPU pair.",
    metric: "nvlink_err",
  },
  {
    source: "Slurm",
    severity: "info",
    code: "SLURM-03",
    title: "Job requeued by node failure",
    detail: "A running job was requeued after its node entered drain state.",
  },
  {
    source: "Scheduler",
    severity: "info",
    code: "QUEUE-01",
    title: "Partition backlog high",
    detail: "Pending jobs exceed the fairness threshold for this partition.",
    metric: "pending_jobs",
  },
  {
    source: "DCGM",
    severity: "warning",
    code: "MEM-11",
    title: "HBM utilization stalled",
    detail: "Framebuffer use did not change while SM utilization was elevated.",
    metric: "mem_util",
  },
];

export const DEFAULT_PARTITIONS = [
  "gpu-train",
  "gpu-infer",
  "gpu-burst",
  "interactive",
  "preempt",
];
