# AetherGrid — Design Document

> **AetherGrid** is a high-fidelity, interactive simulator of an enterprise **GPU / GPU-cluster
> management platform** — the kind of control plane used to operate AI factories at NVIDIA-scale.
> It is a front-end application that runs entirely in the browser with a deterministic,
> client-side synthetic data engine.

---

## 1. Purpose & Scope

AetherGrid exists to make the operational model of large accelerated computing **tangible,
inspectable and interactive**. It reproduces the mental model of products such as:

| Real-world system | What AetherGrid simulates |
| --- | --- |
| **NVIDIA Base Command Manager (BCM) / Base View** | End-to-end cluster lifecycle, provisioning, node inventory, rack view |
| **NVIDIA Mission Control** | AI-factory operations, power steering, fabric visibility |
| **NVIDIA DCGM / NVSM** | Per-GPU health, XID/ECC events, thermal & power telemetry |
| **Slurm Workload Manager** | Partitions/queues, priorities, job lifecycle, backfill |
| **Kubernetes + NVIDIA GPU Operator** | Containerized cluster profile, device plugin model |
| **Run:AI** | Kubernetes GPU virtualization & fractional/MIG slicing concepts |
| **GPUStack** | Multi-cluster model-serving stack profile |
| **ClusterWareAI (Penguin Solutions)** | Hardware-agnostic AI-factory control plane, conversational diagnostics |
| **Vultr Open Cluster Manager** | Turnkey Slurm + Prometheus/Grafana stack profile |

**In scope:** multi-region and multi-cluster topology, cluster provisioning/decommissioning,
resource allocation (GPU/CPU/memory/network/storage), a Slurm-style scheduler, live
observability, alerting/health, users/teams/RBAC, quotas and cost/chargeback.

**Out of scope:** real infrastructure calls, authentication, persistence across sessions,
actual Kubernetes/Slurm APIs, billing integrations. All data is synthetic.

---

## 2. Design Principles

1. **Mission-control clarity.** The UI reads like an operations console: dense but calm,
   dark by default, high-contrast numerics, monospace for all machine values.
2. **Progressive depth.** Global → region → cluster → node → GPU. Every level drills into
   the next without a context switch in mental model.
3. **Motion with meaning.** Animation and pulses signal *live telemetry* and *urgency*
   (critical alerts, provisioning), never decoration for its own sake.
4. **Honest simulation.** The synthetic engine is deterministic given a seed, so a demo is
   reproducible, yet it evolves continuously to feel alive.
5. **Zero-backend, zero-friction.** No database, no API keys, no network. `npm install && npm run dev`.
6. **Composable primitives.** A small UI kit (Panel, Badge, StatTile, charts) composes into
   every screen, keeping the visual language consistent and the codebase approachable.

---

## 3. Technology Stack

| Layer | Choice | Rationale |
| --- | --- | --- |
| Framework | **Next.js 15 (App Router)** | File-based routing, layouts for nested cluster views, static prerender |
| Language | **TypeScript (strict)** | Type-safe domain model, refactor confidence |
| UI | **React 19** | Component model, hooks, context |
| Styling | **Tailwind CSS 3** | Utility-first, design tokens in config, no runtime CSS-in-JS |
| Charts | **Custom SVG components** | Full control, tiny bundle, no heavy dependencies |
| State | **React Context + reducer-free updater pattern** | Sufficient for a single simulated dataset |
| Persistence | **None (in-memory)** | Regenerated on load; reseed on demand |

**No third-party charting, state, or data libraries.** This keeps the dependency graph to
`next`, `react`, `react-dom` plus the Tailwind toolchain, which guarantees reproducibility
and fast installs.

---

## 4. System Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                             Browser (SPA)                              │
│                                                                        │
│  App Router (src/app)                                                  │
│   ├─ layout.tsx ──► <SimProvider> ──► <AppShell>                        │
│   │                    │                  │                            │
│   │                    │                  ├─ Sidebar / Topbar          │
│   │                    │                  └─ {children}                │
│   │                    │                                              │
│   │                    ├─ Simulation store (state + actions)           │
│   │                    │     ▲ tick every 1600ms / speed               │
│   │                    │     │                                         │
│   │                    │  ┌──┴───────────────┐                         │
│   │                    │  │  engine.advance() │  random-walk metrics    │
│   │                    │  └──┬───────────────┘  job progression         │
│   │                    │     │                  alert generation        │
│   │                    │  ┌──┴───────────────┐                         │
│   │                    │  │ generator.generate│  seeded fleet build    │
│   │                    │  └──────────────────┘                         │
│   │                    │                                              │
│   └─ routes (pages) ───┴── selectors ── charts / panels                │
└───────────────────────────────────────────────────────────────────────┘
```

### 4.1 Data flow

1. On mount, `SimProvider` calls `generateState(seed)` to build the entire world
   (regions, clusters, nodes, GPUs, jobs, users, teams, alerts, storage, fabrics, history).
2. A `setInterval` loop calls `advance(prev, rng)` on every tick, producing a new immutable
   state snapshot (new array references for changed collections) so React re-renders.
3. Pages subscribe through the `useSim()` hook and derive view-model data via pure
   **selectors** (`fleetKpis`, `regionKpis`, `clusterAggregate`, `teamUsage`, …).
4. Actions (provision, delete, submit job, ack alert, set quota…) are exposed on the same
   context and mutate state through `setState(prev => …)` updater functions.

### 4.2 Rendering & hydration

Because the simulation depends on wall-clock time, the world is generated **after mount**.
Until then the provider renders a branded **boot screen**. This eliminates SSR/client
hydration mismatches and keeps the server render cheap (static shell).

---

## 5. Domain Model

The model lives in `src/lib/types.ts` and intentionally mirrors real management-plane concepts.

```
Region ─┬─ Cluster ─┬─ ClusterNode ─┬─ GpuDevice (0..8 per node)
        │           ├─ Job
        │           ├─ Filesystem
        │           └─ Fabric
        ├─ Team ── User
        └─ Alert (references Cluster / Node / GPU)
```

### 5.1 Key entities

| Entity | Notable fields | Notes |
| --- | --- | --- |
| `Region` | lat/lng, tier, powerCapacityMw, `pue`, `carbonIntensity`, `renewablePct` | Drives the world map and datacenter-efficiency panels |
| `Cluster` | kind, orchestrator, gpuModelId, gpuCount, nodeCount, fabric, status, health, `utilization`, `costPerHour` | `gpuCount` is *fleet* size; only a representative set of nodes is materialized |
| `ClusterNode` | hostname, rack/slot, role, gpus[], cpu/mem/NVMe, net, power, status, uptime | Materialized up to 28 GPU nodes + 4 infra nodes per cluster |
| `GpuDevice` | util, HBM used, temp, power, clocks, XID/ECC, throttle, MIG mode | The atomic unit of telemetry |
| `Job` | partition, resources, priority, state, progress, framework | Slurm-style lifecycle |
| `Team` / `User` | quota {gpu, cpu, mem, storage, cost}, role, gpuHours30d, cost30d | Multi-tenant / RBAC / chargeback |
| `Alert` | severity, source (DCGM/NVSM/Slurm/Fabric/Power/Scheduler), code, state | Health event stream |
| `Filesystem` | type (Lustre/GPFS/NFS/NVMe-oF/S3), capacity, used, R/W, IOPS | Storage tier view |
| `Fabric` | kind (InfiniBand/Ethernet/NVLink), ports, BW, latency, errors | Interconnect view |
| `MetricSample` | gpuUtil, memUtil, powerKw, netGbps, tempC, jobThroughput, storageIops, storageGbps | 60-sample rolling window per cluster + global |
| `Rack` | powerCapacityKw, inlet/coolant temp, airflow, status, nodeIds | Thermal & power domain per rack |
| `TopologyBlock` | connectivity, nodeIds, oversubscription, bandwidthTbps | NVLink / IB-island / Ethernet placement domains |
| `ClusterSettings` | autoscaling, powerSteering, preemption, migEnabled, isolation | Live orchestration switches |
| `Reservation` | teamId, gpuCount, startAt, endAt | Guaranteed capacity holds |
| `ClusterMetering` | gpuHours24h, storageTb, egressGb24h, reserved/spot GPUs | Chargeback inputs |
| `PriceBook` | compute/storage/egress rates, reserved/spot discounts | Billing model |
| `ClusterConfig` | CUDA, driver, partition, clock/power caps, MIG, NCCL, GDR, egress, priority | Named hardware & runtime profiles |
| `Alert.remediationSteps` / `remediatedSteps` | ordered runbook steps + progress | Incident response state |
| `Runbook` / `RemediationStep` | rootCause, ordered steps, `kind`, `effect` | Code → fix mapping (see §6.5) |

### 5.2 GPU catalog

A curated catalog (`src/lib/constants.ts`) with realistic specs:

| GPU | Arch | HBM | TDP | FP16 TFLOPS | Interconnect | Tier |
| --- | --- | --- | --- | --- | --- | --- |
| B200 SXM | Blackwell | 180 GB | 1000 W | 2250 | NVLink 5 | flagship |
| GB200 NVL72 | Blackwell | 192 GB | 1200 W | 2500 | NVLink 5 | flagship |
| H200 SXM | Hopper | 141 GB | 700 W | 1979 | NVLink 4 | workhorse |
| H100 SXM | Hopper | 80 GB | 700 W | 1979 | NVLink 4 | workhorse |
| L40S PCIe | Ada | 48 GB | 350 W | 733 | PCIe Gen4 | inference |
| A100 SXM | Ampere | 80 GB | 400 W | 624 | NVLink 3 | inference |

Each spec drives power budgets, memory math, FP16 peak calculations and cost modeling.

---

## 6. Simulation Engine

### 6.1 Seeded randomness

`src/lib/rng.ts` implements a **mulberry32** PRNG plus Gaussian sampling and weighted
pickers. The same `seed` always produces the same initial fleet, making screenshots, demos
and tests reproducible. `hashString` derives stable IDs.

### 6.2 Generation (`src/lib/synth/generator.ts`)

1. Build teams (from fixed definitions) and ~56 users distributed across them.
2. For each region, create 1–3 clusters whose kind/tier determine GPU family and fleet size.
3. Derive per-cluster specs: GPUs/node, CPU cores, memory, local NVMe, fabric, power, rate.
4. Materialize up to 28 GPU nodes (+ head/login/storage/management) with per-GPU telemetry.
5. Create filesystems and fabrics per cluster.
6. Generate ~6–18 jobs per cluster across all lifecycle states.
7. Raise 0–7 alerts per cluster, correlated with node state.
8. Seed a 60-sample history per cluster and a global aggregate; derive team usage.

### 6.3 Tick logic (`src/lib/synth/engine.ts`)

Each tick (`advance`):

- **Metrics** — every cluster's utilization/memory random-walks toward a drifting target.
  Each GPU is modelled with **coupled physics**: a boost clock that derates as silicon heats,
  power that combines a dynamic component (∝ utilisation · clock²) with temperature-dependent
  leakage, a slow thermal time constant, and throttle arbitration where the first budget
  exceeded (thermal > 88 °C or power > ~TDP) clamps clocks and pulls power down. XID/ECC
  counters increment occasionally. See §6.7.
- **Lifecycle** — provisioning clusters advance their progress bar and transition to ready;
  **ready clusters can enter a degraded state and later recover**; degraded clusters converge
  probabilistically.
- **Autoscaling** — when enabled, each cluster's utilization is gently pulled toward the
  70–85% green band, simulating elastic capacity reconciliation.
- **Power steering** — per-node GPU power is capped so a rack cannot exceed its power budget,
  mimicking Power Reservation Steering.
- **Jobs** — running jobs accrue runtime; on completion they close; a small failure
  probability applies; pending jobs start when cluster utilization drops; new jobs are
  injected under load. Jobs carry `gang`, `preemptible`, `checkpointable`, `networkClass`
  and `migrating` flags.
- **Node faults** — a node becoming critical can **fail, requeue or migrate** the jobs running
  on it; checkpointable jobs are paused and resumed.
- **Preemption** — on saturated clusters, low-priority preemptible work is **held** to admit
  higher-priority jobs when preemption is enabled.
- **Alerts** — new events are raised probabilistically from a library of realistic templates
  (XID 79, XID 48, XID 63, thermal throttle, power budget, IB link flap, NVLink errors…).
- **Storage/Fabric** — throughput, IOPS, latency and port-up counts drift; the aggregate
  storage throughput/IOPS feed the per-cluster and global history.
- **Racks** — inlet/coolant temperature and power draw are derived from member nodes and the
  rack power budget; over-budget racks flag as warning.
- **Metering** — each cluster's 24h GPU-hours, storage footprint and egress accumulate for
  chargeback.
- **History** — a new sample is appended to each cluster and to the global series; windows
  are capped at 60.
- **Activity** — a human-readable event is occasionally prepended to the fleet activity feed.

**Speed control** multiplies the tick frequency (0.5×–4×); pause halts it. `running` and
`speed` are part of state, surfaced in the top bar.

### 6.4 Incident remediation engine (`src/lib/runbooks.ts`)

Every alert `code` maps to a **runbook**: a root-cause explanation and an ordered list of
`RemediationStep`s, each with a `kind` that names a concrete recovery action. A step is
"applied" through `applyStep`, which:

1. Mutates world state according to the step's `kind` (drain node, power-cycle, clear XID/ECC,
   reset the fabric, apply clock/power caps, migrate/requeue jobs, scale out, enable
   preemption, reap idle jobs, raise thermal margin, …).
2. Advances the alert's progress (`remediatedSteps`), moving it to `acknowledged`.
3. Resolves the alert automatically when the final step completes.
4. Appends an audit entry to the activity feed.

Operators can apply steps one at a time (guided) or use **auto-remediate** for a single
alert, an entire cluster, or the whole fleet. This turns the dashboard from a read-only
monitor into a hands-on control plane: the user can *go to the thing that is broken and fix
it*, watching telemetry respond.

### 6.5 Named configuration profiles

`ClusterConfig` records are first-class objects with full CRUD + apply semantics:

- **Create / edit / delete** through the Config Manager (`/configs`).
- A profile binds CUDA/driver versions, partition, GPU clock cap, power cap, MIG mode and
  profile, NCCL, GPUDirect Storage, egress limits, priority class and preemptibility, plus a
  validation flag.
- **Apply** reconciles the profile into the cluster's live `ClusterSettings` (MIG, preemption,
  default partition) and stamps `updatedAt`, emitting an audit event.
- The cluster Settings page lists profiles bound to that cluster with an inline Apply action.

Nodes additionally expose a **deep-config drawer** (reboot, clear XID/ECC, apply a clock
ceiling, apply a power cap) so an operator can remediate a single accelerator.

### 6.6 Notifications

High-signal engine events (new alerts, provisioning milestones, scheduler changes) are projected
into a bounded `notifications[]` queue on `SimState`. A `Toasts` layer renders them as auto-expiring
slide-ins with deep links, and a `NotificationBell` dropdown keeps a scrollable, readable history.
Both respect the user's `showToasts` preference. Because notifications live in state, they are
deterministic given the seed and pace with the tick loop.

### 6.7 GPU physics model (`updateGpu`)

Per accelerator, per tick:

```
boostCeiling  = spec.boostClockMhz
thermalDerate = clamp((temp − 70)·12, 0, 420)
targetClock   = boostCeiling − thermalDerate
dynamicPower  = TDP·0.72·util·(targetClock/boostCeiling)²
leakagePower  = TDP·(0.08 + (temp − 30)·0.0018)
power         = walk(prevPower → dynamic + leakage)
temp          = walk(prevTemp → 30 + power·55/TDP, τ = 0.9)   // thermal mass
throttle      = temp > 88 ? "thermal" : power > TDP·0.995 ? "power" : "none"
if throttled: clamp clocks (55–82% of ceiling) and reduce power
```

This produces familiar real-world behaviour: sustained load heats the die, clocks walk down,
power plateaus near TDP, and a warm rack throttles sooner — all of which the UI surfaces as
clock/temperature/throttle telemetry.

### 6.8 Preferences & pinning

A dedicated `PrefsProvider` persists `{ density, showToasts, defaultRegionFilter }` to
`localStorage` under `aethergrid-prefs`; the theme (`ThemeToggle`) and playback speed use their
own keys. Density is applied via a `data-density` attribute on `<html>` and CSS overrides.
Clusters carry `pinned` and `notes` fields with `togglePin` / `setClusterNotes` actions, and the
fleet view sorts pinned clusters first.

### 6.9 Materialization strategy

Real AI factories span 100k+ nodes. Rendering all of them is neither useful nor performant, so:

- `Cluster.gpuCount` / `nodeCount` hold the **true fleet numbers** used for aggregates.
- Only a **representative slice** (≤28 GPU nodes) is materialized for rack/node inspection.
- The UI is explicit ("N of M materialized") so the simulation stays honest.

---

## 7. Information Architecture & Routes

```
/                                   Mission Control (global)
├─ /regions/[regionId]              Region drill-down
├─ /clusters                        Fleet list (grid + table, filters)
│   └─ /clusters/[clusterId]        Cluster workspace (nested layout)
│       ├─ (index)                  Overview
│       ├─ /nodes                   Nodes & per-GPU explorer + rack view
│       ├─ /jobs                    Scheduler queues + submit workload
│       ├─ /storage                 Storage & fabric
│       ├─ /alerts                  Cluster alert stream
│       └─ /settings                Lifecycle, scaling, danger zone
├─ /jobs                            Global workloads
├─ /partitions                      Scheduler partition / QoS view
├─ /fabric                          Interconnect domain operations
├─ /topology                        Topology-aware placement domains
├─ /health                          Fleet thermal / power / ECC / XID
├─ /alerts                          Global alert center (+ guided remediation)
├─ /configs                         Cluster configuration profiles
├─ /activity                        Activity & audit log
├─ /users                           Users, teams, RBAC & quotas
├─ /billing                         Cost, chargeback & reservations
├─ /settings                        Personal preferences (theme, density, speed)
└─ /provision                       4-step provisioning wizard
```

The cluster section uses a **shared nested layout** (`/clusters/[clusterId]/layout.tsx`)
that renders the cluster identity header, live mini-stats, provisioning banner and tab
navigation once, around every sub-page.

---

## 8. Visual Design System

### 8.1 Palette

| Token | Value | Use |
| --- | --- | --- |
| `ink-950` … `ink-600` | `#05070a` → `#223040` | Backgrounds, surfaces, borders |
| `nv-500` | `#76b900` | Primary / healthy / brand (NVIDIA-inspired) |
| `vol-teal` | `#22d3ee` | HBM, fabric, informational |
| `vol-violet` | `#a855f7` | Workloads, secondary series |
| `vol-amber` | `#f59e0b` | Warning |
| `vol-red` | `#ef4444` | Critical |
| `vol-emerald` | `#10b981` | Cost / savings |

### 8.2 Typography

- **Sans** (system stack) for labels and prose.
- **Monospace** for every machine value: utilization, power, IDs, hostnames, costs.
- Tight tracking on headings, uppercase 10–11px labels for metadata.

### 8.3 Components

A compact kit in `src/components/ui`:

- `Panel`, `Badge`, `Button`, `Segmented`, `StatusDot`, `ProgressBar`, `StatTile`,
  `KeyValue`, `Avatar`, `Meter`, `EmptyState`, `Pill`.
- Domain badges: `HealthBadge`, `SeverityBadge`, `JobStateBadge`, `GpuBadge`, `TeamChip`.

### 8.4 Charts (custom SVG)

`src/components/charts`:

- `Sparkline`, `AreaChart` (with comparison series), `LineChart`, `BarChart`, `HBar`.
- `RadialGauge`, `Donut`, `GpuHeatmap`.
- `WorldMap` — equirectangular projection with region nodes sized by GPU capacity and
  animated control-traffic arcs.

Color helper functions map utilization → green ramp and temperature → heat ramp so that
heatmaps and gauges share a consistent semantic palette.

---

## 9. Key User Flows

### 9.1 Provision a cluster
`/provision` → **Placement** (name, region, profile) → **Hardware** (GPU, count, GPUs/node)
→ **Network & tenancy** (fabric, owner team, tags) → **Review** (cost/power estimate) →
provision. A new cluster enters `provisioning`, its progress bar fills over subsequent
ticks, then it flips to `ready` and begins emitting telemetry and accepting jobs.

### 9.2 Investigate a hot GPU
Mission Control → region → cluster → **Nodes & GPUs** → click a rack cell → the node
inspector shows per-GPU utilization, HBM, temperature, power, clocks, XID/ECC and throttle
state, with **Drain** / **Restore** actions. Or go to **Alerts** and jump to the offending
node via the event's cluster link.

### 9.3 Schedule a job
Cluster → **Workloads** → **Submit job** (name, user, framework, partition, nodes, priority)
→ **Launch**. The job appears as `pending` and transitions to `running` when capacity frees
up. From the queue you can pause, cancel or boost priority.

### 9.4 Diagnose and fix an incident
**Alert Center** → click **Fix** on any active event → the remediation drawer opens with the
root-cause analysis and numbered steps. Apply each step and watch the world react (node drains,
fabric re-trains, temperatures fall); or press **Auto-remediate all**. The alert resolves
automatically on the final step and the action appears in the **Activity Log**.

### 9.5 Configure a cluster
**Config Manager** (`/configs`) → **New config** → choose cluster, CUDA/driver, partition,
clock & power caps, MIG profile, NCCL/GDR toggles and scheduler policy → **Create**. Then
**Apply** to reconcile the profile into the cluster's live settings, or open the cluster
**Settings → Configuration profiles** panel to apply one inline.

### 9.6 Tune a single node
Cluster → **Nodes & GPUs** → select a node → in the inspector use **Reboot node**,
**Clear XID/ECC**, or apply a **clock ceiling** / **power cap** from the deep-configuration
panel. Use **Drain** / **Restore** to take the node in and out of the scheduling pool.

### 9.7 Chargeback & governance
**Users & Teams** for quotas and RBAC; **Cost & Billing** for burn rate, run-rate, allocation
per cluster/team/architecture, budget status and idle-capacity waste.

---

## 10. Performance Considerations

- **Immutable snapshots** with reference reuse: unchanged collections keep identity.
- **Materialization cap** bounds DOM size regardless of fleet size.
- **SVG charts** avoid canvas/Chrome overhead and scale crisply.
- **Memoized selectors** (`useMemo`) prevent recalculation on unrelated re-renders.
- **Client-only generation** keeps the server render static and instant.

---

## 11. Accessibility

- Semantic landmarks (`aside`, `header`, `main`, `nav`, `section`).
- Buttons carry `title`/`aria`-friendly labels; heatmap cells expose accessible labels.
- Status is communicated by **color + text** (badges with labels), not color alone.
- Keyboard-focusable controls with visible focus rings; native range/select inputs used.

---

## 12. Security & Privacy

- No network calls, no telemetry, no secrets.
- No real credentials or personal data — identities are generated.
- Content Security is inherently strong due to the absence of remote resources.

---

## 13. Extensibility

| To add… | Do this |
| --- | --- |
| A new GPU | Append to `GPU_CATALOG` |
| A new region | Append to `REGIONS` |
| A new alert type | Append to `ALERT_TEMPLATES` |
| A new scheduler feature | Extend `advance()` job section + `Job` type |
| A real backend | Replace `generateState`/`advance` with API adapters behind the same store API |
| Persistence | Serialize `SimState` to IndexedDB/localStorage in the provider |

---

## 14. Glossary

- **BCM** — Base Command Manager, NVIDIA's cluster lifecycle product.
- **DCGM** — Data Center GPU Manager; telemetry/health suite.
- **NVSM** — NVIDIA System Management; node-level health.
- **MIG** — Multi-Instance GPU; hardware partitioning.
- **NVLink / NVSwitch** — high-bandwidth GPU interconnect / switch fabric.
- **PUE** — Power Usage Effectiveness.
- **XID** — GPU error code reported by the driver.
- **Backfill** — scheduler technique to fit small jobs into gaps.
- **Showback / Chargeback** — attributing infrastructure cost to consumers.
