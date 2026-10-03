# AetherGrid — Feature Specification

A complete catalogue of what the simulator can do, grouped by capability area.
Everything below is implemented and runnable in the browser.

Legend: ✅ implemented · ◐ simulated approximation · ▢ conceptual/roadmap

---

## 1. Multi-region & multi-cluster topology

| # | Feature | Status | Where |
| --- | --- | --- | --- |
| 1.1 | Five global regions (Santa Clara, Ashburn, Frankfurt, Tokyo, Mumbai) with tiers, zones, PUE, carbon intensity and renewable mix | ✅ | `/`, `/regions/[id]` |
| 1.2 | Animated world map with capacity-sized nodes and inter-region control arcs | ✅ | Mission Control |
| 1.3 | Region drill-down: aggregate utilization, power demand, fabric throughput, efficiency gauges | ✅ | `/regions/[regionId]` |
| 1.4 | 11+ clusters across regions with distinct kinds and orchestrators | ✅ | `/clusters` |
| 1.5 | Cluster kinds: DGX SuperPOD, DGX BasePOD, Kubernetes, Slurm, Run:AI, GPUStack | ✅ | Fleet & provisioning |
| 1.6 | Region capacity headroom and post-deploy projection | ✅ | `/provision` |
| 1.7 | Fleet topology counters (regions, clusters, nodes, GPUs) | ✅ | Mission Control |

## 2. Cluster provisioning & lifecycle

| # | Feature | Status | Where |
| --- | --- | --- | --- |
| 2.1 | 4-step wizard: Placement → Hardware → Network & tenancy → Review | ✅ | `/provision` |
| 2.2 | GPU family selection across 6 accelerators with live specs | ✅ | Wizard |
| 2.3 | GPU count selection (8 → 8192) and 4×/8× GPUs-per-node | ✅ | Wizard |
| 2.4 | Fabric selection (IB NDR/XDR, RoCEv2, NVLink) | ✅ | Wizard |
| 2.5 | Owner-team assignment and tag management | ✅ | Wizard |
| 2.6 | Live specification sidebar with HBM, FP16 peak, power and run-rate | ✅ | Wizard |
| 2.7 | Provisioning lifecycle: `provisioning → ready` with progress animation | ✅ | Cluster header |
| 2.8 | Capacity scaling (resize GPU count, recompute nodes/power/cost) | ✅ | `/clusters/[id]/settings` |
| 2.9 | Decommission cluster with type-to-confirm danger zone | ✅ | Settings |
| 2.10 | Auto-recovery, checkpointing and maintenance-window policy display | ✅ | Settings |

## 3. Nodes, GPUs & resource allocation

| # | Feature | Status | Where |
| --- | --- | --- | --- |
| 3.1 | Rack view — each cell is one GPU, colored by utilization/throttle | ✅ | `/clusters/[id]/nodes` |
| 3.2 | Node inventory table: role, GPUs, util, temp, power, memory, network, status | ✅ | Nodes |
| 3.3 | Node inspector with per-GPU gauges, HBM, clocks, XID/ECC and throttle state | ✅ | Nodes |
| 3.4 | Per-GPU heatmap (24-wide) with color semantics | ✅ | Overview |
| 3.5 | Drain / Restore node actions | ✅ | Nodes |
| 3.6 | CPU, memory and local-NVMe utilization meters per node | ✅ | Inspector |
| 3.7 | Node roles: gpu-worker, head, login, storage, management | ✅ | Nodes |
| 3.8 | MIG mode and fractional-slicing representation | ✅ | GPU model |
| 3.9 | Team-level GPU quotas with live consumption | ✅ | `/users` |
| 3.10 | Team quota editing (GPU, budget, storage) | ✅ | Users |

## 4. Workload scheduler (Slurm-style)

| # | Feature | Status | Where |
| --- | --- | --- | --- |
| 4.1 | Partition queues (gpu-train, gpu-infer, gpu-burst, interactive, preempt) | ✅ | Cluster Workloads |
| 4.2 | Submit workload form (name, user, framework, partition, nodes, priority) | ✅ | Cluster Workloads |
| 4.3 | Job lifecycle: pending → running → completed / failed / cancelled / paused / held | ✅ | Engine |
| 4.4 | Progress tracking with runtime vs requested runtime | ✅ | Job table |
| 4.5 | Priority levels (low/normal/high/urgent) with one-click boost | ✅ | Job table |
| 4.6 | Pause / resume / cancel actions | ✅ | Job table |
| 4.7 | Resource requests: GPUs, nodes, CPU cores, memory | ✅ | Job table |
| 4.8 | Framework tags (PyTorch, TensorRT-LLM, vLLM, SGLang, NeMo, JAX, DeepSpeed…) | ✅ | Jobs |
| 4.9 | Global workload view with cluster filter and scheduler throughput chart | ✅ | `/jobs` |
| 4.10 | Backfill behavior — queued jobs start when capacity frees | ◐ | Engine |
| 4.11 | Fairshare quota enforcement | ◐ | Team quotas |

## 5. Live observability & graphics

| # | Feature | Status | Where |
| --- | --- | --- | --- |
| 5.1 | Fleet GPU utilization area chart over a rolling 5-minute window | ✅ | Mission Control |
| 5.2 | Power (MW) and fabric (Tbps) trend charts | ✅ | Mission Control, Region |
| 5.3 | Cluster utilization + HBM comparison series | ✅ | Cluster Overview |
| 5.4 | Per-cluster power trend | ✅ | Cluster Overview |
| 5.5 | Sparklines on every cluster card | ✅ | Fleet |
| 5.6 | Radial gauges (utilization, renewable mix, ports up) | ✅ | Multiple |
| 5.7 | Donut charts (GPU mix, alert sources, capacity, frameworks, cost by architecture) | ✅ | Multiple |
| 5.8 | Horizontal bar rankings (teams, alerts hotspots, cost, capacity) | ✅ | Multiple |
| 5.9 | Temperature and utilization heat ramps | ✅ | Nodes, Overview |
| 5.10 | Live activity feed (scheduler, DCGM, autoscaler, system) | ✅ | Mission Control |

## 6. Alerts & health (DCGM/NVSM-style)

| # | Feature | Status | Where |
| --- | --- | --- | --- |
| 6.1 | Realistic alert codes: XID 79, XID 48, XID 63, thermal throttle, power budget, IB link flap, NVLink errors | ✅ | Engine |
| 6.2 | Severity levels: critical / warning / info | ✅ | Alerts |
| 6.3 | Sources: DCGM, NVSM, Slurm, Fabric, Power, Scheduler | ✅ | Alerts |
| 6.4 | Alert lifecycle: active → acknowledged → resolved | ✅ | Alerts |
| 6.5 | Per-alert context: node, GPU index, metric and value | ✅ | Alert list |
| 6.6 | Cluster alert stream with severity/state filters | ✅ | `/clusters/[id]/alerts` |
| 6.7 | Global alert center with source composition and hotspots | ✅ | `/alerts` |
| 6.8 | Acknowledge one / acknowledge all | ✅ | Alerts |
| 6.9 | Sidebar + top-bar live alert counters | ✅ | Shell |
| 6.10 | Correlated node/GPU state degradation | ✅ | Engine |

## 7. Storage & network

| # | Feature | Status | Where |
| --- | --- | --- | --- |
| 7.1 | Filesystems: Lustre, GPFS, NFS, NVMe-oF, S3 Object | ✅ | `/clusters/[id]/storage` |
| 7.2 | Capacity, used, read/write throughput and IOPS per filesystem | ✅ | Storage |
| 7.3 | Capacity breakdown donut and per-tier throughput distribution | ✅ | Storage |
| 7.4 | Interconnect fabrics: InfiniBand, Ethernet RoCEv2, NVLink | ✅ | Storage |
| 7.5 | Ports up/total, bandwidth, latency and error counters | ✅ | Storage |
| 7.6 | GPUDirect Storage and local NVMe cache panels | ✅ | Storage |
| 7.7 | Fabric throughput trend | ✅ | Storage, Region |

## 8. Users, teams, RBAC & quotas

| # | Feature | Status | Where |
| --- | --- | --- | --- |
| 8.1 | 56 synthetic identities across 8 teams | ✅ | `/users` |
| 8.2 | Roles: admin, researcher, ml-engineer, viewer, service | ✅ | Users |
| 8.3 | RBAC permission matrix (provision, quotas, submit, telemetry, manage users) | ✅ | Users |
| 8.4 | User directory with GPU-hours, cost, status and search/role filters | ✅ | Users |
| 8.5 | Suspend / activate users | ✅ | Users |
| 8.6 | Team quota manager (GPU limit, monthly budget, storage limit) | ✅ | Users |
| 8.7 | Team GPU-hours and cost rankings | ✅ | Users |

## 9. Cost & billing

| # | Feature | Status | Where |
| --- | --- | --- | --- |
| 9.1 | Burn rate, daily, monthly run-rate KPIs | ✅ | `/billing` |
| 9.2 | 30-day spend vs budget consumption | ✅ | Billing |
| 9.3 | GPU-hours and cost by team | ✅ | Billing |
| 9.4 | Cost by cluster and by GPU architecture | ✅ | Billing |
| 9.5 | Idle-capacity waste estimate | ✅ | Billing |
| 9.6 | Chargeback table with budget status (on-track / at-risk / over) | ✅ | Billing |
| 9.7 | Per-cluster billing profile | ✅ | Cluster Settings |

## 10. Advanced operations (deep simulation)

| # | Feature | Status | Where |
| --- | --- | --- | --- |
| 10.1 | Autoscaling reconciliation toward a 70–85% utilization band | ✅ | Engine, cluster settings |
| 10.2 | Power steering — per-rack power budget enforcement | ✅ | Engine, rack panels |
| 10.3 | Preemption / spot — low-priority jobs checkpointed & requeued | ✅ | Engine, JobTable |
| 10.4 | Node-fault driven job failure, requeue and migration | ✅ | Engine |
| 10.5 | Cluster degradation → recovery state machine | ✅ | Engine |
| 10.6 | Thermal model — per-GPU junction temp, throttling, rack inlet/coolant | ✅ | `/health`, nodes |
| 10.7 | Rack power-capacity budgets and draw tracking | ✅ | Nodes, cluster overview |
| 10.8 | Storage throughput / IOPS time series | ✅ | Cluster storage |
| 10.9 | Topology-aware placement domains (NVLink / IB islands / Ethernet pods) | ✅ | `/topology` |
| 10.10 | Oversubscription and bandwidth per block | ✅ | `/topology` |
| 10.11 | Scheduler partitions with QoS, priority, max nodes, preempt policy | ✅ | `/partitions` |
| 10.12 | Queue depth + backlog trend | ✅ | `/partitions` |
| 10.13 | Capacity reservations with active/scheduled/expired windows | ✅ | `/billing`, cluster overview |
| 10.14 | Reserved / spot GPU metering and discounts | ✅ | `/billing` |
| 10.15 | Storage & egress chargeback (TB-month, GB egress) | ✅ | `/billing` |
| 10.16 | Network-aware job classes (InfiniBand / RoCE) | ✅ | JobTable |
| 10.17 | Gang scheduling and checkpointable flags | ✅ | JobTable |
| 10.18 | Tenant isolation policy (namespace / VLAN / physical) | ✅ | Cluster settings |
| 10.19 | Live cluster control-plane toggles (autoscale, power, preempt, MIG) | ✅ | Cluster settings |
| 10.20 | Fleet thermal / power / error observability page | ✅ | `/health` |
| 10.21 | Fabric operations page with per-domain health | ✅ | `/fabric` |
| 10.22 | Activity & audit log with category/cluster filtering | ✅ | `/activity` |

## 11. Incident remediation & deep configuration

| # | Feature | Status | Where |
| --- | --- | --- | --- |
| 11.1 | **Guided remediation runbooks** — every alert code maps to a root-cause analysis and ordered fix steps | ✅ | `/alerts`, cluster alerts |
| 11.2 | Root-cause explanation panel per incident | ✅ | Remediation drawer |
| 11.3 | Step-by-step "Fix" workflow — apply each step, world state changes in response | ✅ | Remediation drawer |
| 11.4 | **Auto-remediate all** (per-alert, per-cluster, fleet-wide) | ✅ | Alert list, alert pages |
| 11.5 | Runbook effects: drain, power-cycle, XID/ECC reset, fabric reset, clock/power caps, job migration, requeue, scale-out, preemption, idle-job reaping | ✅ | Engine / store |
| 11.6 | Remediation progress tracking per alert (n/m steps) | ✅ | Alert list |
| 11.7 | Auto-resolution when the final step is applied | ✅ | Store |
| 11.8 | **Cluster Config Manager** — create / edit / delete / apply named profiles | ✅ | `/configs` |
| 11.9 | Config fields: CUDA, driver, partition, clock cap, power cap, MIG + profile, NCCL, GPUDirect Storage, egress limit, priority class, preemptible, validation | ✅ | `/configs` |
| 11.10 | Apply a config to a cluster (updates live settings + audit trail) | ✅ | `/configs`, cluster settings |
| 11.11 | Configs bound to and shown per cluster | ✅ | Cluster settings |
| 11.12 | **Node deep-config**: reboot, clear XID/ECC, apply clock ceiling, apply power cap | ✅ | Cluster nodes inspector |
| 11.13 | Fabric reset action per cluster | ✅ | Runbook / store |
| 11.14 | Job migration, requeue and idle reaping actions | ✅ | Runbook / store |
| 11.15 | Full audit trail for every remediation and config action | ✅ | `/activity` |

## 12. Realism core (engine & console)

| # | Feature | Status | Where |
| --- | --- | --- | --- |
| 12.1 | **Real-time notifications** — slide-in toasts for scheduler, DCGM and provisioning events | ✅ | Top bar, all pages |
| 12.2 | Notification center dropdown with unread badge and deep links to the source | ✅ | Top bar |
| 12.3 | Auto-expiring toasts with per-item dismiss and clear-all | ✅ | Toasts |
| 12.4 | **Realistic GPU physics** — boost clock derates with temperature, power = dynamic + temperature-dependent leakage, thermal time constant, coupled clock↔power↔temp | ✅ | Engine |
| 12.5 | First-order throttle arbitration (thermal vs power budget) with clock clamping and power reduction | ✅ | Engine |
| 12.6 | HBM clock behavior under sustained thermal stress | ✅ | Engine |
| 12.7 | SM/HBM clock telemetry surfaced per GPU | ✅ | Node inspector |
| 12.8 | **Persistent preferences** — theme, playback speed, UI density and toasts survive reloads | ✅ | `/settings`, localStorage |
| 12.9 | Compact / comfortable interface density | ✅ | `/settings` |
| 12.10 | Cluster pinning with pinned-first fleet sorting | ✅ | Fleet, cluster cards |
| 12.11 | Per-cluster operator notes | ✅ | Cluster settings |

## 13. Platform & UX

| # | Feature | Status | Where |
| --- | --- | --- | --- |
| 10.1 | Dark mission-control theme with custom design tokens | ✅ | Global |
| 10.2 | Responsive layout (sidebar collapses to drawer on mobile) | ✅ | Shell |
| 10.3 | Global command-style search for clusters & users | ✅ | Top bar |
| 10.4 | Simulation controls: pause/resume, 0.5×/1×/2×/4× speed | ✅ | Top bar |
| 10.5 | Resample fleet / regenerate world | ✅ | Top bar & Mission Control |
| 10.6 | Custom SVG chart library (no chart dependencies) | ✅ | Charts |
| 10.7 | Boot screen during world generation | ✅ | Provider |
| 10.8 | Live clock and tick/seed display | ✅ | Shell |
| 10.9 | Breadcrumbs across every drill-down | ✅ | Headers |
| 10.10 | Empty states throughout | ✅ | Multiple |

## 14. Roadmap (not yet implemented)

| # | Feature | Status |
| --- | --- | --- |
| 12.1 | Conversational AI diagnostics agent ("ask about cluster X") | ▢ |
| 12.2 | Persistence via IndexedDB + shareable seed URLs | ▢ |
| 12.3 | Real backend adapters (Slurm/K8s/DCGM) behind the store API | ▢ |
| 12.4 | Interactive topology graph (force-directed fabric map) | ▢ |
| 12.5 | Full Power Reservation Steering (datacenter-scale power budget) | ◐ |
| 12.6 | Multi-user collaboration and audit log export | ▢ |
| 12.7 | Prometheus/Grafana-style dashboard builder | ▢ |
| 12.8 | Cloudbursting / hybrid-cloud overflow simulation | ▢ |
| 12.9 | Multi-cluster federated scheduling and capacity sharing | ▢ |
| 12.10 | Carbon-aware scheduling by region intensity | ▢ |
