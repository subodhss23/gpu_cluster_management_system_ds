# AetherGrid — Technical Map

> **Audience:** engineers who want to understand *exactly* how AetherGrid works — every module,
> engine, function, data structure, action, selector and component, and how they connect.
>
> This is the low-level companion to [`design_document.md`](./design_document.md) (rationale)
> and [`features.md`](./features.md) (capabilities). Here the emphasis is on **mechanics**.

**Version:** 1.0 · **Stack:** Next.js 15 · React 19 · TypeScript (strict) · Tailwind CSS 3
**Total source:** ~11,000 lines across 42 TypeScript/TSX files.

---

## 1. High-level architecture at a glance

```
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                              BROWSER (client only)                            │
 │                                                                               │
 │   src/app/layout.tsx                                                          │
 │     <PrefsProvider>            ← localStorage prefs (density/toasts)          │
 │       <SimProvider>            ← the entire simulation world + 40 actions     │
 │         <AppShell>             ← sidebar, topbar, footer, toasts              │
 │           {children}           ← routed pages                                 │
 │                                                                               │
 │   ┌── lib/synth/generator.ts ──►  SimState      (built once, on mount)        │
 │   │        ▲                                                                  │
 │   │        │ finish                                                           │
 │   │   lib/synth/engine.ts ──►  advance(prev) ──► new SimState  (every tick)   │
 │   │        │                                                                  │
 │   │   lib/runbooks.ts, constants.ts   (static knowledge)                      │
 │   │                                                                           │
 │   └── lib/store.tsx  ──  setState(updater)  ──  React re-render               │
 │                                                                               │
 │   Pages ── useSim() ── state + actions                                        │
 │              └── lib/selectors.ts  (pure derived view-models)                 │
 │              └── components/*      (render)                                   │
 └─────────────────────────────────────────────────────────────────────────────┘
```

**Golden rules of the architecture**

1. **One source of truth** — a single immutable `SimState` object in `SimProvider`.
2. **Pure core** — `generator.ts` and `engine.ts` are pure functions (`seed → SimState`,
   `SimState → SimState`). No React, no `Date` in the *math* except `Date.now()` timestamps.
3. **Derive, never store** — pages compute view data through `selectors.ts`.
4. **Client-only** — the world is generated after mount to avoid SSR/hydration drift.
5. **Deterministic** — the same `seed` always yields the same starting fleet.

---

## 2. File-by-file map

### 2.1 `src/lib/` — core library (no JSX except `store.tsx`, `prefs.tsx`)

| File | Lines | Responsibility |
| --- | ---: | --- |
| `types.ts` | 460 | Every interface/type — the domain model (§3) |
| `constants.ts` | 424 | Static catalogs: GPU specs, regions, teams, alert templates, partitions |
| `rng.ts` | 58 | Seeded PRNG (`mulberry32`) + `hashString` |
| `format.ts` | 166 | Number/time/unit formatters, colours, `clamp` |
| `selectors.ts` | 140 | Pure derivations from `SimState` (KPIs, aggregates, rankings) |
| `runbooks.ts` | 324 | Alert `code → Runbook` knowledge base (§7) |
| `cn.ts` | 3 | className joiner |
| `analytics.ts` | ~110 | PostHog wrapper — env-gated init, `capture`, `capturePageview`, `identify`, opt-in/out |
| `store.tsx` | 1113 | React context provider, all actions, `applyStep`/`applyConfig` helpers |
| `prefs.tsx` | 69 | `PrefsProvider` + `usePrefs` (localStorage persistence) |
| `synth/generator.ts` | 852 | Builds the initial `SimState` from a seed (§4) |
| `synth/engine.ts` | 579 | Advances the world one tick (§5) |

### 2.2 `src/app/` — routes (App Router)

| Route | File | Type | Role |
| --- | --- | --- | --- |
| `/` | `page.tsx` (397) | static | Mission Control |
| `/clusters` | `clusters/page.tsx` (189) | static | Fleet list |
| `/clusters/[clusterId]` | `.../page.tsx` (340) | dynamic | Cluster overview |
| `/clusters/[clusterId]/nodes` | `.../nodes/page.tsx` (364) | dynamic | Rack view + node inspector |
| `/clusters/[clusterId]/jobs` | `.../jobs/page.tsx` (235) | dynamic | Cluster scheduler |
| `/clusters/[clusterId]/storage` | `.../storage/page.tsx` (168) | dynamic | Storage & fabric |
| `/clusters/[clusterId]/alerts` | `.../alerts/page.tsx` (68) | dynamic | Cluster alerts |
| `/clusters/[clusterId]/settings` | `.../settings/page.tsx` (264) | dynamic | Cluster config/lifecycle |
| `/clusters/[clusterId]` (layout) | `.../layout.tsx` (119) | dynamic | Shared cluster header + tabs |
| `/regions/[regionId]` | `regions/[regionId]/page.tsx` (157) | dynamic | Region drill-down |
| `/jobs` | `jobs/page.tsx` (106) | static | Global workloads |
| `/partitions` | `partitions/page.tsx` (163) | static | Scheduler partitions |
| `/fabric` | `fabric/page.tsx` (141) | static | Interconnect domains |
| `/topology` | `topology/page.tsx` (188) | static | Placement domains |
| `/health` | `health/page.tsx` (185) | static | Thermal/power/ECC/XID |
| `/alerts` | `alerts/page.tsx` (112) | static | Global alert center |
| `/configs` | `configs/page.tsx` (331) | static | Config Manager (CRUD/apply) |
| `/activity` | `activity/page.tsx` (142) | static | Audit log |
| `/users` | `users/page.tsx` (274) | static | Users/teams/RBAC/quotas |
| `/billing` | `billing/page.tsx` (225) | static | Cost/chargeback/reservations |
| `/provision` | `provision/page.tsx` (408) | static | 4-step wizard |
| `/settings` | `settings/page.tsx` (132) | static | Personal preferences |
| `layout.tsx` | (35) | — | Providers + shell + theme bootstrap script |
| `globals.css` | — | — | Theme tokens (CSS vars) + density overrides |

### 2.3 `src/components/`

| Folder | Files | Contents |
| --- | --- | --- |
| `layout/` | `AppShell`, `PageHeader`, `ThemeToggle`, `Toasts`, `NotificationBell` | Chrome & global UI |
| `ui/` | `primitives` (311), `icons`, `domain` | Design-system kit |
| `charts/` | `charts` (410), `WorldMap` (112) | Custom SVG charts |
| `domain/` | `ClusterCard`, `JobTable`, `AlertList`, `RemediationPanel` | Business components |
| `providers/` | `AnalyticsProvider` | Initialises PostHog + emits `$pageview` on route change |

---

## 3. Domain model (`src/lib/types.ts`)

Every entity is a plain, serialisable interface. Key types and their fields:

### 3.1 Status unions

```ts
type HealthStatus   = "healthy" | "warning" | "critical" | "offline" | "provisioning"
type ProvisionState = "ready" | "provisioning" | "deleting" | "degraded" | "offline"
type JobState       = "running" | "pending" | "completed" | "failed" | "cancelled" | "paused" | "held"
type JobPriority    = "low" | "normal" | "high" | "urgent"
type AlertSeverity  = "critical" | "warning" | "info"
type NodeRole       = "gpu-worker" | "head" | "login" | "storage" | "management"
type Connectivity   = "nvlink-domain" | "infiniband-island" | "ethernet-pod"
```

### 3.2 Core entities

| Type | Fields (abridged) | Notes |
| --- | --- | --- |
| `GpuSpec` | id, name, arch, memoryGb, tdpW, typicalPowerW, fp16Tflops, hbmBandwidthGbps, **boostClockMhz**, interconnect, msrpPerGpuHour, tier | Drives all physics + economics |
| `Region` | id, city, lat/lng, zones[], tier, powerCapacityMw, pue, carbonIntensity, renewablePct | Feeds map & efficiency panels |
| `Cluster` | id, name, regionId, zone, kind, orchestrator, gpuModelId, gpuCount, nodeCount, gpusPerNode, cpuCoresPerNode, memGbPerNode, localNvmeTbPerNode, fabric, powerKw, status, health, utilization, memUtilization, provisionProgress, tags[], sla, ownerTeamId, costPerHour, **pinned**, **notes** | Fleet-level truth |
| `GpuDevice` | index, utilPct, memUsedGb/Total, tempC, powerW, smClockMhz, memClockMhz, xidErrors, eccErrors, throttle, migMode | Atomic telemetry |
| `ClusterNode` | id, hostname, clusterId, rack, slot, role, gpuModelId?, gpus[], cpuCores, cpuUtilPct, memUsed/Total, nvmeUsed/Total, netTx/RxGbps, status, uptimeHours, powerW | Materialized node |
| `Job` | id, name, userId, teamId, clusterId, partition, nodesRequested, gpusRequested, cpuRequested, memRequestedGb, priority, state, submittedAt, startedAt?, endedAt?, runtimeSec, requestedRuntimeSec, progress, exitCode?, framework, networkClass, preemptible, gang, checkpointable, migrating | Scheduler unit |
| `User` | id, name, email, teamId, role, status, gpuHours30d, cost30d, initials, hue | Identity |
| `Team` | id, name, color, quota{gpuLimit,cpuLimit,memLimitGb,storageLimitTb,costLimitUsd}, gpuHours30d, cost30d | Tenant |
| `Alert` | id, clusterId, nodeId?, gpuIndex?, severity, source, code, title, detail, metric?, value?, raisedAt, state, **remediationSteps[]**, **remediatedSteps** | Health event |
| `Runbook` | code, title, summary, rootCause, steps[] | Fix knowledge |
| `RemediationStep` | id, label, detail, kind, effect, requiresNode? | One fix action |
| `ClusterConfig` | id, name, clusterId, partition, gpuClockCapMhz, powerCapPct, migEnabled, migProfile, cudaVersion, driverVersion, ncclEnabled, gdrEnabled, egressLimitGb, priorityClass, preemptible, validate, createdAt, updatedAt | Named profile |
| `Filesystem` | id, clusterId, name, type, capacityTb, usedTb, readGbps, writeGbps, iops, status | Storage |
| `Fabric` | id, clusterId, kind, portsTotal, portsUp, bwTbps, errors, latencyUs, status | Interconnect |
| `MetricSample` | t, gpuUtil, memUtil, powerKw, netGbps, tempC, jobThroughput, storageIops, storageGbps | 60-sample ring |
| `Rack` | id, clusterId, name, powerCapacityKw, inletTempC, coolantTempC, airflowCfm, status, nodeIds[] | Thermal/power domain |
| `TopologyBlock` | id, clusterId, name, connectivity, nodeIds[], oversubscription, bandwidthTbps | Placement domain |
| `Reservation` | id, clusterId, teamId, name, gpuCount, startAt, endAt | Capacity hold |
| `ClusterMetering` | gpuHours24h, storageTb, egressGb24h, reservedGpus, spotGpus | Billing inputs |
| `PriceBook` | computePerGpuHour, storagePerTbMonth, egressPerGb, reservedDiscount, spotDiscount | Pricing |
| `ActivityEvent` | id, t, kind, severity, actor, message, clusterId? | Audit entry |
| `Notification` | id, t, severity, title, message, source, clusterId?, alertId?, read | Toast/queue item |
| `Notification.kind` ∈ | cluster, job, alert, user, provision, scale, fabric, health | Event category |

### 3.3 The root object

```ts
interface SimState {
  tick, running, speed, seed, generatedAt,
  regions: Region[], gpuCatalog: GpuSpec[],
  clusters: Cluster[], nodes: ClusterNode[], jobs: Job[],
  users: User[], teams: Team[], alerts: Alert[],
  filesystems: Filesystem[], fabrics: Fabric[],
  racks: Record<clusterId, Rack[]>,
  topology: Record<clusterId, TopologyBlock[]>,
  settings: Record<clusterId, ClusterSettings>,
  reservations: Reservation[], priceBook: PriceBook,
  metering: Record<clusterId, ClusterMetering>,
  configs: ClusterConfig[], notifications: Notification[],
  history: Record<clusterId, MetricSample[]>,
  globalHistory: MetricSample[],
  activity: ActivityEvent[],
}
```

> **Collections keyed by `clusterId`** (`racks`, `topology`, `settings`, `metering`,
> `history`) are the drill-down backbone: `state.racks[clusterId]` etc.

---

## 4. World generation — `src/lib/synth/generator.ts`

`generateState(seed: number): SimState` is the single entry point. It creates a fresh `Rng`,
then runs these helpers **in order** (order matters for determinism):

```
generateState(seed)
 ├─ new Rng(seed)
 ├─ TEAM_DEFS ─────────► teams[]            (8 teams, random quotas)
 ├─ makeUsers(rng, teams) ► users[]          (~56 identities)
 ├─ for each REGION:
 │    makeCluster(...)  ──► clusters[]       (1–3 per region, name-unique)
 │      └─ sets ownerTeamId
 ├─ for each cluster:
 │    makeNode(...) ─────► nodes[]           (≤28 gpu-workers + 4 infra)
 ├─ makeJobs(...) ───────► jobs[]            (6–18 per cluster, all states)
 ├─ makeAlerts(...) ─────► alerts[]          (with remediationSteps via stepsFor())
 ├─ makeFilesystems(...) ► filesystems[]     (Lustre/GPFS/S3/…)
 ├─ makeFabrics(...) ────► fabrics[]         (IB/Ethernet/NVLink)
 ├─ makeHistory(...) ────► history{}         (60 back-filled samples/cluster)
 ├─ makeGlobalHistory() ─► globalHistory[]   (aggregate series)
 ├─ makeActivity(...) ───► activity[]        (24 seeded events)
 ├─ per cluster:
 │    makeRacks / makeTopology / DEFAULT_SETTINGS / makeMetering
 ├─ makeReservations(...)► reservations[]
 ├─ priceBook (constant)
 ├─ makeConfig(...) ─────► configs[]         (0–3 per cluster)
 └─ derive team.gpuHours30d / cost30d from users
```

### 4.1 Helper functions

| Function | Signature | What it does |
| --- | --- | --- |
| `gpuCountOptions(kind, tier)` | `→ number[]` | Fleet sizes: SuperPOD 1024–4096, BasePOD 128–512, edge 16–64 |
| `pickGpuId(rng, kind)` | `→ string` | Chooses a plausible accelerator per cluster kind |
| `makeGpu(rng, specId, index, util)` | `→ GpuDevice` | Seeds a GPU (util, HBM, temp, power, throttle) |
| `makeNode(rng, cluster, rack, slot, role, index)` | `→ ClusterNode` | Builds a node; hostname pattern `abc-gpu-RRSS` (RR=rack, SS=slot) |
| `makeCluster(rng, regionId, zone, tier, usedNames, index)` | `→ Cluster` | Name-unique cluster with derived power/cost |
| `makeUsers(rng, teams)` | `→ User[]` | 56 users; role weighted toward ml-engineer |
| `makeFilesystems(rng, cluster)` | `→ Filesystem[]` | 3–4 filesystems scaled by GPU count |
| `makeFabrics(rng, cluster)` | `→ Fabric[]` | Compute fabric + optional NVLink domain |
| `makeJobs(rng, clusters, users, now)` | `→ Job[]` | Mixed-state jobs; network-bound → `gpu-infer` |
| `makeAlerts(rng, clusters, nodes, now)` | `→ Alert[]` | From `ALERT_TEMPLATES`; attaches `stepsFor(code)` |
| `makeHistory(rng, clusters, now)` | `→ Record<id, MetricSample[]>` | 60 samples, 5 s apart |
| `makeGlobalHistory(history)` | `→ MetricSample[]` | Averages/sums across clusters |
| `makeActivity(rng, clusters, users, now)` | `→ ActivityEvent[]` | Human-readable seed events |
| `makeRacks(rng, cluster, nodes)` | `→ Rack[]` | Groups nodes by rack; computes budget |
| `makeTopology(rng, cluster, nodes)` | `→ TopologyBlock[]` | Splits into NVLink/IB/Ethernet blocks |
| `makeConfig(rng, cluster, index, now)` | `→ ClusterConfig` | Preset profile (baseline/throughput/efficiency/debug) |
| `makeReservations(rng, clusters, teams, now)` | `→ Reservation[]` | 0–2 holds per cluster |
| `makeMetering(rng, cluster, filesystems)` | `→ ClusterMetering` | 24h GPU-hours, storage, egress, reserved/spot |

### 4.2 Determinism guarantee

Because every helper draws from the **same** `Rng` instance in a fixed call order, and IDs are
derived from `hashString(...)` of stable strings, `generateState(s)` is a pure function of `s`.
Reseeding from the top bar (`regenerate()`) picks a new seed and rebuilds from scratch.

---

## 5. Simulation engine — `src/lib/synth/engine.ts`

`advance(prev: SimState, rng: Rng): SimState` runs once per tick (default **1600 ms ÷ speed**).

### 5.1 Execution order inside `advance`

```
advance(prev, rng)
 0. now = Date.now(); tick = prev.tick + 1
 1. CLUSTERS   — provisioning progress / degradation / recovery / auto-scaling / target walk
 2. NODES      — updateNode() per node (physics, failure model, power steering)
 3. JOBS       — advanceJob() each; node-fault requeue/migrate; preemption of low-priority
 4. prune completed jobs > 1 h old; inject new job (p<0.28, cap 320)
 5. ALERTS     — maybeAlert() with probability 0.06
 6. STORAGE    — filesystem throughput/IOPS/usage drift; aggregate per cluster
 7. FABRICS    — latency, errors, portsUp drift
 8. RACKS      — inlet/coolant temp + status derived from member nodes
 9. METERING   — accumulate gpuHours/storage/egress
10. HISTORY    — append MetricSample per cluster + global (cap 60)
11. ACTIVITY   — maybe prepend a random event (p<0.12) + extraActivity
12. NOTIFICATIONS — project extraAlerts/extraActivity into notifications (cap 40)
13. return { ...prev, tick, clusters, nodes, jobs, alerts, ... }
```

### 5.2 The physics core — `updateGpu`

Called per GPU inside `updateNode`. Inputs: previous device, cluster utilisation, `specPower`
(TDP), `specClock` (boost ceiling), `rng`.

```
step 1  util        = walk(prevUtil → clusterUtil·100 ± noise, vol=5)
step 2  memUsed     = walk(prev → memTotal · frac(util), vol=2%·total)
step 3  thermalDerate = clamp((prevTemp − 70)·12, 0, 420)
        targetClock   = boostCeiling − thermalDerate            // hot ⇒ slower boost
step 4  dynamicPower  = TDP·0.72 · (util/100) · (targetClock/boostCeiling)²
        leakagePower  = TDP·(0.08 + (prevTemp − 30)·0.0018)      // heat ⇒ more leakage
        power         = walk(prevPower → dynamic + leakage, vol=9)
step 5  temp        = walk(prevTemp → 30 + power·(55/TDP), vol=0.9)   // thermal mass
step 6  thermalLimited = temp > 88 ; powerLimited = power > TDP·0.995
        throttle    = thermalLimited ? "thermal" : powerLimited ? "power" : "none"
step 7  smClock     = targetClock, then clamped:
                       thermal  ⇒ min(·, ceiling·0.55)
                       power    ⇒ min(·, ceiling·0.82)
                       clamp to [210, ceiling]
        if throttled: power ×= 0.96
step 8  memClock    = temp > 93 ? 1215 : 2619
        xidErrors  += p(0.0004) ; eccErrors += p(0.0008)
```

This coupling produces the emergent behaviour users see: load → heat → clock derate → power
plateau → throttle when a rack is warm.

### 5.3 `walk(current, target, volatility, rng)`

The universal smoothing primitive:

```ts
return current + (target - current) * 0.1 + rng.gaussian(0, volatility);
```

Every drifting metric (utilisation, memory, power, temperature, fabric latency) uses it, so all
curves are exponential approaches plus Gaussian noise — never instant jumps.

### 5.4 Cluster state machine

```
provisioning ──progress≥100──► ready
ready        ──p(0.004)/tick──► degraded   (health → warning|critical)
degraded     ──p(0.02)/tick───► ready       (health → healthy)
```

*Probabilities are **per tick**, not per second; at 1× (≈0.625 ticks/s) this yields the
observed incident cadence.*

### 5.5 Job lifecycle & scheduling

```
advanceJob(job, cluster, now, rng):
  migrating         → p(0.5) clears the flag (resume)
  running           → runtime += 5s; progress = runtime/requested
                      progress ≥ 1  → completed (exitCode 0)
                      p(0.00035)    → failed (exit 1/2/134/137)
  paused            → unchanged
  pending           → if cluster.util < 0.93 and p(0.02): → running

Outside advanceJob (in advance):
  • node critical  → running jobs on that cluster: p(0.08)
        checkpointable → migrating = true (pause/requeue)
        else           → failed (exit 137)
  • cluster util ≥ 0.97 & preemption on → running low-priority preemptible job: p(0.15) → held
  • inject new job if jobs.length < 320 and p(0.28)
```

### 5.6 Alert generation — `maybeAlert`

Picks a random cluster and an `ALERT_TEMPLATES` entry, attaches a node/GPU when applicable, sets
`state:"active"`, `remediationSteps: stepsFor(code)`, `remediatedSteps: 0`.

### 5.7 History & notifications

* Per-cluster ring `history[id]` and `globalHistory` are capped at **60** samples (`shift()`).
* `notifications` is capped at **40**; only raised when `prev.tick > 0` (so the first frame is
  quiet). Each item links back to its cluster/alert for deep-linking.

---

## 6. State store — `src/lib/store.tsx`

### 6.1 Module-level helpers (pure)

| Function | Purpose |
| --- | --- |
| `blankGpu(index, gpuModelId)` | A zeroed `GpuDevice` for newly provisioned nodes |
| `applyStepEffect(state, alert, step)` | Applies one remediation step's world mutation (`switch` on `step.kind`) — see §7.2 |
| `applyStep(prev, alertId, stepIndex)` | Guards ordering, calls effect, advances `remediatedSteps`, resolves on last step, appends activity |
| `applyConfigToState(prev, configId)` | Reconciles a `ClusterConfig` into `settings[clusterId]` (mig/preempt/partition) + audit |
| `activity(kind, message, actor, severity, clusterId)` | Builds an `ActivityEvent` |
| `BootScreen()` | Branded loading screen shown until the world exists |

### 6.2 Provider lifecycle

```
SimProvider
  state: SimState | null                 // null until mount
  rngRef: Rng                            // persists across ticks
  seedRef: number = 20260402

  useEffect([])  → read saved speed from localStorage, generateState(seed), setState
  useEffect([running, speed])
                 → setInterval(advance, 1600 / speed) when running
  if state == null → render <BootScreen/>
  else             → provide { state, actions }
```

**Why client-only:** the world contains timestamps; generating on the server would cause
hydration mismatches. The boot screen keeps the first paint stable.

### 6.3 Actions (complete reference)

All actions are `useCallback`-wrapped, mutate via `setState(prev => …)`, and are memoised into a
single `actions` object. Grouped by concern:

**Simulation control**
| Action | Effect |
| --- | --- |
| `toggleRunning()` | Flips `state.running` |
| `setSpeed(n)` | Sets speed, persists `aethergrid-speed`, resumes if n>0 |
| `regenerate(seed?)` | New seed → `generateState` |

**Cluster lifecycle**
| Action | Effect |
| --- | --- |
| `createCluster(request)` | Inserts a `provisioning` cluster + materialised nodes + fs + fabric + rack/topology/settings/metering stubs; returns id |
| `deleteCluster(id)` | Removes cluster and **all** keyed collections |
| `scaleCluster(id, gpuCount)` | Recomputes nodeCount, powerKw, costPerHour |
| `setClusterSetting(id, key, value)` | Typed partial update of `settings[id]` |
| `togglePin(id)` / `setClusterNotes(id, notes)` | User metadata |

**Workloads**
| Action | Effect |
| --- | --- |
| `submitJob(input)` | Prepends a `pending` job; infers networkClass/preemptible/gang |
| `setJobState(id, state)` | Lifecycle transition with timestamps |
| `setJobPriority(id, p)` | Priority change |

**Alerts & remediation**
| Action | Effect |
| --- | --- |
| `acknowledgeAlert` / `resolveAlert` / `acknowledgeAllAlerts(clusterId?)` | State transitions |
| `applyRemediationStep(alertId, i)` | → `applyStep` |
| `autoRemediate(alertId)` | Loops `applyStep` over remaining steps |
| `remediateAll(clusterId?)` | Auto-remediates every unresolved alert (optionally scoped) |

**Node operations**
| Action | Effect |
| --- | --- |
| `drainNode` / `restoreNode` | Remove/return a node to the pool |
| `rebootNode` | Reset uptime, zero GPU thermal/power |
| `resetNodeErrors` | Zero XID/ECC, mark healthy |
| `throttleNodeClock(id, MHz)` | Lower SM clocks + cool the die |
| `capNodePower(id, pct)` | Scale node/GPU power + cool |

**Fabric / cluster operations**
| Action | Effect |
| --- | --- |
| `resetClusterFabric(id)` | Ports up, errors 0, lower latency |
| `migrateClusterJobs(id)` | Running → pending (re-queue) |
| `killIdleJobs(clusterId?)` | Cancel stalled/low-priority jobs |

**Configs**
| Action | Effect |
| --- | --- |
| `createConfig(draft)` | Insert `ClusterConfig`, returns id |
| `updateConfig(id, patch)` | Merge + stamp `updatedAt` |
| `deleteConfig(id)` | Remove |
| `applyConfig(id)` | → `applyConfigToState` |

**Governance & preferences**
| Action | Effect |
| --- | --- |
| `setUserStatus(id, status)` | Suspend/activate a user |
| `setTeamQuota(teamId, partial)` | Merge quota fields |
| `dismissNotification` / `clearNotifications` / `markAllNotificationsRead` | Notification queue |

### 6.4 `useSim()`

```ts
function useSim(): { state: SimState; actions: SimActions }
```

Throws if used outside `SimProvider`. Every page/component consumes the world through this hook.

---

## 7. Remediation system — `src/lib/runbooks.ts` + store helpers

### 7.1 `RUNBOOKS` knowledge base

A `Record<string, Runbook>` keyed by alert code:

```
XID 79, XID 48, XID 63, THERM-01, PWR-02, IB-14, NVSM-07, SLURM-03, QUEUE-01, MEM-11
+ GENERIC fallback
```

Each `Runbook` = `{ code, title, summary, rootCause, steps: RemediationStep[] }`.

| Helper | Returns |
| --- | --- |
| `runbookForCode(code)` | The `Runbook` (falls back to GENERIC) |
| `stepsFor(code)` | `string[]` of step labels (used by the generator/engine to seed alerts) |
| `alertProgress(alert)` | `remediatedSteps / remediationSteps.length` |

### 7.2 `applyStepEffect` — step kind → world mutation

`switch (step.kind)` over the `RemediationKind` union:

| kind | Mutation |
| --- | --- |
| `drain-node` | node → warning, GPU util 0 |
| `reboot-node` | uptime 0, GPU temp/power/clock reset |
| `clear-xid` | node healthy, XID 0, throttle none |
| `reset-ecc` | node healthy, ECC 0 |
| `reset-fabric` | fabric ports up, errors 0 |
| `throttle-clock` | clamp SM clock ≤1600, cool die |
| `cap-power` | scale node/GPU power ×0.8, cool |
| `raise-thermal-margin` | rack inlet −2 °C, airflow ×1.15 |
| `toggle-power-steering` | `settings[cluster].powerSteering = true` |
| `enable-preemption` | `settings[cluster].preemption = true` |
| `migrate-jobs` / `requeue-jobs` | running (or failed) → pending |
| `scale-out` | cluster gpuCount/nodeCount ×1.15 |
| `kill-idle-jobs` | cancel progress<5% or low-priority |
| `acknowledge` / default | no world change |

`applyStep` then increments `remediatedSteps`, sets state to `acknowledged` (or `resolved` on the
last step) and appends an `ActivityEvent`.

---

## 8. Preferences — `src/lib/prefs.tsx`

```
Prefs = { density: "comfortable"|"compact", showToasts: boolean, defaultRegionFilter: string }
PREF_KEY = "aethergrid-prefs-v2"
```

* `PrefsProvider` reads on mount, writes on change, and sets `document.documentElement.dataset.density`.
* `globals.css` reacts to `html[data-density="compact"]` to tighten table rows/grid gaps.
* **Toasts default to off** (`showToasts: false`) so notifications never obstruct content.
* Theme (`ThemeToggle`) and speed use separate localStorage keys (`aethergrid-theme`,
  `aethergrid-speed`). The theme has a **pre-hydration inline script** in `layout.tsx` to avoid a
  flash of the wrong theme.

---

## 8b. Analytics — `src/lib/analytics.ts` + `providers/AnalyticsProvider.tsx`

PostHog is wrapped behind a tiny façade so the rest of the app never imports the SDK directly
and analytics is a guaranteed no-op without a key.

```ts
const TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const HOST  = process.env.NEXT_PUBLIC_POSTHOG_HOST;
const OPT_OUT_KEY = "aethergrid-analytics-optout";
export const APP_ID = "gpu_management_system_app2_ds";   // shared-project discriminator
```

`initAnalytics()` is called with `defaults: "2026-05-30"` and immediately
`posthog.register({ app: APP_ID })` — registering an **`app` super-property** so events from
this app are distinguishable from other apps sharing the same PostHog project. The
super-property is re-applied inside the `loaded` callback (before opt-out) and is also attached
to every explicit `capture`/`identify` call.

| Function | Behaviour |
| --- | --- |
| `analyticsConfigured()` | `Boolean(KEY)` — used by the UI to enable/disable the toggle |
| `isOptedOut()` / `isAnalyticsEnabled()` | Reads the localStorage opt-out flag |
| `initAnalytics()` | `posthog.init(...)` once; `capture_pageview:false`, `disable_session_recording:true`, `person_profiles:"identified_only"` |
| `capture(event, props)` | No-op unless enabled; injects `app: APP_ID` + `env` |
| `capturePageview(path, props)` | Manual `$pageview` for the App Router |
| `captureClusterEvent(event, cluster, props)` | Convenience for "action on cluster X" |
| `identify` / `resetAnalytics` | Identity management (opaque ids only) |
| `optInAnalytics()` / `optOutAnalytics()` | Persist choice + `opt_in/out_capturing()` |

`AnalyticsProvider` calls `initAnalytics()` on mount and emits one `$pageview` per unique
`usePathname()` value (deduped via a `lastPath` ref). It wraps the tree **outermost** in
`layout.tsx` so pageviews fire regardless of child providers.

**Instrumented actions** (in `store.tsx`): `cluster_provisioned`,
`cluster_decommissioned`, `job_submitted`, `config_created`, `config_applied`,
`remediation_step_applied`, `remediation_auto_applied`, `remediation_bulk_applied`,
`fleet_regenerated`, `simulation_speed_changed`.

**Consent:** the Preferences page exposes a toggle that calls `optIn/optOutAnalytics()`;
it is disabled when `analyticsConfigured()` is false.

---

## 9. Selectors — `src/lib/selectors.ts`

Pure functions from `SimState` to view-models. Memoised at call sites with `useMemo`.

| Selector | Returns |
| --- | --- |
| `regionById(state, id)` / `clusterById` / `teamById` / `userById` | Lookups |
| `nodesForCluster(state, id)` / `jobsForCluster` | Filtered arrays |
| `fleetKpis(state)` | `FleetKpis`: totals, allocation, running/pending, alerts, power, cost, health counts |
| `clusterAggregate(state, cluster)` | Per-cluster nodes/jobs/alerts + running/pending/failed/gpuNodes/criticalNodes |
| `regionClusters` / `regionKpis` | Region rollups (GPUs, util, power, alerts) |
| `topJobs(state, n)` | Highest-priority running jobs |
| `teamUsage(state)` | Teams joined with active GPUs + quota utilisation |
| `alertsSorted(state, clusterId?)` | Order: active→ack→resolved, then severity, then recency |

---

## 10. Formatting & colour — `src/lib/format.ts`

| Function | Purpose |
| --- | --- |
| `clamp(v,min,max)` | Bound a number |
| `pct`, `num`, `compact`, `usd`, `compactUsd`, `tb`, `gb` | Number/unit formatting |
| `duration(sec)`, `relTime(ts)`, `clockTime(ts)`, `dateTime(ts)` | Time formatting |
| `healthLabel`, `healthColor`, `jobStateColor`, `severityColor` | Semantic labels/colours |
| `gpuShortName`, `initialsOf` | Short GPU names, avatar initials |

These `*Color` helpers are the **single source of truth** for status colour, consumed by charts,
badges and heatmaps so the palette is consistent everywhere.

---

## 11. UI component library

### 11.1 Primitives (`components/ui/primitives.tsx`)

| Component | Contract |
| --- | --- |
| `Panel` | Bordered surface with optional `title`, `subtitle`, `actions` |
| `Badge` | 7 tones (neutral/green/amber/red/cyan/violet/blue) |
| `StatusDot` | Pulsing dot for critical/provisioning |
| `Button` | variants: default/primary/ghost/danger/outline; sizes sm/md |
| `ProgressBar` | Themed bar with gradient |
| `StatTile` | KPI card (label/value/sub/accent/icon) |
| `Segmented` | Radio-style toggle |
| `KeyValue`, `EmptyState`, `Avatar`, `Pill`, `Meter` | Utility pieces |

### 11.2 Domain badges (`components/ui/domain.tsx`)

`HealthBadge`, `SeverityBadge`, `JobStateBadge`, `GpuBadge`, `TeamChip`, `MethodTag` — map domain
unions to tones/labels.

### 11.3 Icons (`components/ui/icons.tsx`)

A single `paths: Record<string,string>` of SVG path data + an `Icon` component. No icon library.

### 11.4 Charts (`components/charts/charts.tsx`)

All hand-rolled SVG (no chart dependency):

| Component | Notes |
| --- | --- |
| `Sparkline` | Inline micro-trend |
| `AreaChart` | Gradient fill + optional `compare` series (dashed) |
| `LineChart` | Multi-series + legend |
| `RadialGauge` | 270° arc gauge |
| `Donut` | Segmented ring with centre label |
| `HBar` | Horizontal ranked bars |
| `GpuHeatmap` | Grid of GPU cells, click-select |
| `utilColor / tempColor` | Heat ramps (utilisation green, temperature warm) |

`WorldMap.tsx` — equirectangular projection, region nodes sized by GPU count, animated
control-traffic arcs drawn with a quadratic Bézier (`arc()`), grid via lat/lng projection.

### 11.5 Domain components

| Component | Role |
| --- | --- |
| `ClusterCard` | Fleet tile: pin toggle, health, GPU badge, sparkline, jobs/cost |
| `JobTable` | Scheduler table with lifecycle actions, tags (gang/spot/IB/RoCE/migr) |
| `AlertList` | Event rows + runbook progress; opens the remediation drawer |
| `RemediationPanel` | Root cause + ordered steps; apply step-by-step or auto-remediate |

### 11.6 Chrome

| Component | Role |
| --- | --- |
| `AppShell` | Sidebar (grouped nav), topbar (search/clock/sim controls/theme/notifications), footer, toasts |
| `PageHeader` | Breadcrumb + title + subtitle + actions |
| `ThemeToggle` | Light/dark toggle; exports `themeInitScript` |
| `NotificationBell` | Dropdown history + unread badge |
| `Toasts` | Auto-expiring slide-ins (default off) |

---

## 12. Design tokens & theming

* Tailwind colours are **CSS variables** (`rgb(var(--ink-950) / <alpha-value>)`), declared in
  `globals.css` under `:root, html.dark` and overridden by `html.light`.
* Semantic ramps: `ink` (surfaces/text, light↔dark inverted), `nv` (brand/healthy), `vol`
  (vol.teal/blue/violet/amber/orange/rose/red/emerald for data).
* Chart canvases read `GRID_STROKE`/`TRACK_STROKE` and `var(--ink-*)` so SVG re-themes with the
  page.
* Density preference is applied via `html[data-density="compact"]` overrides.

---

## 13. Navigation map (sidebar groups → routes)

```
Operations    → /, /clusters, /jobs, /partitions
Infrastructure→ /fabric, /topology, /health, /alerts, /configs, /activity
Organization  → /users, /billing, /provision, /settings
```

The active route is highlighted via `usePathname()` + prefix matching in `AppShell`.

---

## 14. Data-flow walkthroughs (end-to-end)

### 14.1 One engine tick

```
setInterval(1600/speed)
  → advance(prev, rngRef.current)
      clusters.map   → new Cluster[] (util/provision/health)
      nodes.map      → updateNode → updateGpu (physics)
      jobs.map       → advanceJob (+ fault/preempt rules)
      filesystems/fabrics/racks/metering drift
      history/globalHistory append (cap 60)
      activity + notifications prepend
  → setState(newState)
  → useSim() consumers re-render
  → selectors recompute view-models (useMemo)
```

### 14.2 Provisioning a cluster

```
/provision wizard (state: form)
  → actions.createCluster(request)
      new Cluster { status:"provisioning", provisionProgress:4 }
      + nodes[] (blankGpu), fs, fabric, racks/topology/settings/metering stubs
  → router.push(`/clusters/${id}`)
  → on each tick provisionProgress += 1.5–5 until ≥100 → status:"ready"
```

### 14.3 Remediating an incident

```
/alerts → "Fix" → RemediationPanel(alert)
  → actions.applyRemediationStep(alert.id, i)
      → applyStep → applyStepEffect (world mutation)
      → remediatedSteps++ ; resolve on last step
  OR actions.autoRemediate(alert.id) / remediateAll(clusterId?)
```

### 14.4 Applying a config

```
/configs → draft → actions.createConfig(draft)
  → "Apply" → applyConfigToState
      settings[cluster] ← { migEnabled, preemption, defaultPartition }
      config.updatedAt = now ; ActivityEvent appended
```

---

## 15. Dependency graph (import direction)

```
types.ts            ← imported by everything
constants.ts        ← generator, engine, pages, components
rng.ts / format.ts  ← generator, engine, selectors, components
runbooks.ts         ← generator, engine, store, RemediationPanel
selectors.ts        ← pages
generator.ts → SimState
engine.ts    → SimState
store.tsx    → generator + engine + runbooks + types   (the only stateful module)
prefs.tsx    → (independent)
   ▲
   └── app/* and components/*  consume store via useSim() / usePrefs()
```

No cyclic dependencies. `lib/` never imports from `components/` or `app/`.

---

## 16. Performance characteristics

* **Immutable snapshots** with reference reuse — unchanged collections keep identity.
* **Materialisation cap** — ≤28 GPU nodes per cluster; `gpuCount`/`nodeCount` hold true totals.
* **Memoised selectors** via `useMemo` at call sites.
* **SVG over canvas** — crisp, cheap, theme-aware.
* **Client-only generation** — static server render; no hydration mismatch.
* **Bounded collections** — histories (60), notifications (40), activity (80), alerts (400), jobs (320).

---

## 17. Extension points

| To add… | Touch |
| --- | --- |
| A new GPU model | `GPU_CATALOG` in `constants.ts` (include `boostClockMhz`) |
| A new region | `REGIONS` in `constants.ts` |
| A new alert + fix | `ALERT_TEMPLATES` (constants) **and** `RUNBOOKS` (runbooks) |
| A new remediation action | extend `RemediationKind` (types) + `applyStepEffect` (store) |
| A new metric | extend `MetricSample` + `sampleFromCluster` (engine) |
| A new page | add a route under `app/` + nav entry in `AppShell` |
| Persistence | serialise `SimState` in `SimProvider` (e.g. IndexedDB) |
| Real backend | swap `generator`/`engine` for API adapters behind the same store API |

---

## 18. Glossary of internal terms

| Term | Meaning |
| --- | --- |
| **Tick** | One `advance()` step (~1.6 s at 1×) |
| **Seed** | Integer that fully determines the initial fleet |
| **Materialised** | A node/GPU actually instantiated for display (≤28/cluster) |
| **Drill-down** | Region → cluster → node → GPU navigation |
| **Runbook** | Ordered remediation steps for an alert code |
| **Profile / Config** | Named `ClusterConfig` applied to a cluster |
| **Projection** | Deriving a view-model from `SimState` via selectors |
| **Keyed collection** | A `Record<clusterId, T[]>` map (racks/topology/settings/metering/history) |
