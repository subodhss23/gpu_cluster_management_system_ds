# AetherGrid — Installation & Usage Instructions

This guide takes you from a clean checkout to a running simulation, and explains how to use
and customize the app.

---

## 1. Prerequisites

| Requirement | Version | Notes |
| --- | --- | --- |
| **Node.js** | 18.18+ (LTS recommended; tested on 20 & 26) | `node --version` |
| **npm** | 9+ | Ships with Node. `npm --version` |

No database, API keys, Docker, or GPU hardware is required. The entire app is local.

---

## 2. Install

```bash
# 1. Enter the project directory
cd gpu_management_system_deepseek

# 2. Install dependencies
npm install
```

This installs Next.js, React, the Tailwind build toolchain and `posthog-js` (optional analytics).

---

## 2b. Analytics (optional — PostHog)

AetherGrid ships with **opt-out, privacy-first product analytics** via PostHog. It is fully
**env-gated**: without a key, the SDK is never loaded and every call is a no-op, so the app runs
unchanged.

**Enable it:**

1. Copy the example env file:
   ```bash
   cp .env.example .env.local
   ```
2. Add your PostHog project API key (PostHog → Project Settings → Project API Key):
   ```
   NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=phc_xxxxxxxxxxxxxxxx
   NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com   # or https://eu.i.posthog.com
   ```
3. Restart the dev server.

**What is captured**

| Event | When |
| --- | --- |
| `$pageview` | Every App Router navigation |
| `cluster_provisioned` | Cluster created via the wizard |
| `cluster_decommissioned` | Cluster deleted |
| `job_submitted` | Workload launched |
| `remediation_step_applied` / `_auto_applied` / `_bulk_applied` | Incident fixes |
| `config_created` / `config_applied` | Config Manager actions |
| `fleet_regenerated` / `simulation_speed_changed` | Simulation controls |
| `analytics_opt_in` / `analytics_opt_out` | Consent changes |

**Privacy defaults:** autocapture on, **session recording disabled**, `person_profiles:
"identified_only"`, and every event tagged with `app: "aethergrid"` + `env`. No PII is collected
(cluster/user data is synthetic).

**Opting out:** users can disable analytics anytime in **Preferences → Privacy & analytics**. The
choice is stored in `localStorage` (`aethergrid-analytics-optout`) and immediately stops capture.

---

## 3. Run in development

```bash
npm run dev
```

Then open **http://localhost:3000** in your browser.

You will see a short boot screen ("Discovering regions, clusters and accelerators…") while the
synthetic world is generated client-side, followed by the **Mission Control** dashboard.

To use a different port:

```bash
npm run dev -- -p 4000
```

---

## 4. Build & run for production

```bash
npm run build   # compiles, type-checks and lints
npm run start   # serves the optimized build on :3000
```

---

## 5. Quality checks

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint (ESLint)
npm run build       # full production validation
```

All three should pass with no errors.

---

## 6. Using the simulator

### 6.1 Simulation controls (top bar)
- **Pause / Resume** — freeze or resume the telemetry tick.
- **Speed** — `0.5×`, `1×`, `2×`, `4×` tick rate.
- **Refresh icon** — regenerate an entirely new synthetic fleet.
- **Search** — type a cluster, user or region to jump to it.
- **Bell** — active alert count; opens the Alert Center.

### 6.2 Navigation map
| Screen | Path | What it does |
| --- | --- | --- |
| Mission Control | `/` | Global KPIs, world map, fleet grid, alerts, activity |
| Cluster Fleet | `/clusters` | Browse/filter clusters (grid or table) |
| Workloads | `/jobs` | Global job queue and scheduler throughput |
| Partitions | `/partitions` | Scheduler QoS, queue depth, backlog |
| Fabric Operations | `/fabric` | Interconnect domains, ports, bandwidth |
| Network Topology | `/topology` | NVLink/IB placement blocks |
| Fleet Health | `/health` | Thermal, power, ECC/XID surveillance |
| Alert Center | `/alerts` | Events, hotspots, guided remediation |
| Config Manager | `/configs` | Create/edit/apply cluster profiles |
| Activity Log | `/activity` | Operational event stream & audit |
| Users & Teams | `/users` | Directory, RBAC, quotas |
| Cost & Billing | `/billing` | Run-rate, chargeback, efficiency |
| Provision Cluster | `/provision` | 4-step cluster creation wizard |
| Region | `/regions/[id]` | Regional drill-down |
| Cluster | `/clusters/[id]` | Overview, nodes, jobs, storage, alerts, settings |

### 6.3 Try these scenarios
1. **Provision a cluster** → `/provision` → pick a region and profile → choose `B200`, 256 GPUs
   → Review → **Provision cluster**. Watch the progress bar fill on the cluster page, then
   submit a job and watch it move from `pending` to `running`.
2. **Find a hot GPU** → Mission Control → a cluster → **Nodes & GPUs** → click a rack cell.
   Inspect temperature, power, XID/ECC. Try **Drain**.
3. **Fix a broken resource (guided remediation)** → `/alerts` → click **Fix** on any event.
   Read the root-cause analysis, then apply each runbook step in order (drain → power-cycle →
   clear XID → …) and watch the node/fabric telemetry react. Or press **Auto-remediate all**.
4. **Create & apply a config** → `/configs` → **New config** → pick a cluster, CUDA/driver,
   partition, clock/power caps, MIG profile and scheduler policy → **Create** → **Apply**.
   The change is reconciled into the cluster and written to the Activity Log.
5. **Tune a node** → cluster → **Nodes & GPUs** → select a node → use **Reboot node**,
   **Clear XID/ECC**, and the clock/power cap sliders in the deep-configuration panel.
6. **Rebalance quotas** → `/users` → **Manage quota** on a team → drag the GPU limit and watch
   the utilization bar change.
7. **Audit spend** → `/billing` → review run-rate, cost by team and over-budget teams.
8. **Resize a cluster** → cluster → **Settings** → move the capacity slider → **Apply resize**.

---

## 7. Project structure

```
gpu_management_system_deepseek/
├─ design_document.md        # architecture & design
├─ features.md               # full feature catalogue
├─ instructions.md           # this file
├─ readme.md                 # GitHub readme
├─ package.json
├─ next.config.js
├─ tailwind.config.js
├─ postcss.config.js
├─ tsconfig.json
└─ src/
   ├─ app/                   # routes (App Router)
   │  ├─ layout.tsx          # provider + shell
   │  ├─ globals.css
   │  ├─ page.tsx            # Mission Control
   │  ├─ regions/[regionId]/
   │  ├─ clusters/
   │  │  ├─ page.tsx
   │  │  └─ [clusterId]/
   │  │     ├─ layout.tsx    # cluster header + tabs
   │  │     ├─ page.tsx      # overview
   │  │     ├─ nodes/  jobs/  storage/  alerts/  settings/
   │  ├─ jobs/  partitions/  fabric/  topology/  health/
   │  ├─ alerts/  configs/  activity/  users/  billing/  provision/
   ├─ components/
   │  ├─ layout/             # AppShell, PageHeader
   │  ├─ ui/                 # primitives, icons, domain badges
   │  ├─ charts/             # custom SVG charts + WorldMap
   │  └─ domain/             # ClusterCard, JobTable, AlertList, RemediationPanel
   └─ lib/
      ├─ types.ts            # domain model
      ├─ constants.ts        # regions, GPU catalog, alert templates…
      ├─ runbooks.ts         # alert code -> root cause + remediation steps
      ├─ rng.ts              # seeded PRNG
      ├─ format.ts           # formatters
      ├─ selectors.ts        # derived view-models
      ├─ store.tsx           # simulation context + actions
      └─ synth/
         ├─ generator.ts     # world generation
         └─ engine.ts        # per-tick evolution
```

---

## 8. Customization

### Add a GPU
Edit `src/lib/constants.ts` → append to `GPU_CATALOG`:
```ts
{ id: "b300", name: "NVIDIA B300 SXM", arch: "Blackwell Ultra",
  memoryGb: 288, tdpW: 1200, typicalPowerW: 950, fp16Tflops: 3000,
  hbmBandwidthGbps: 8000, interconnect: "NVLink 5", nvlinkGbps: 1800,
  msrpPerGpuHour: 10.5, launched: 2025, tier: "flagship" },
```

### Add a region
Append a `Region` to `REGIONS` in the same file (include `lat`/`lng` for the map).

### Add an alert type
Append to `ALERT_TEMPLATES` with a `source`, `severity`, `code`, `title`, `detail` and optional `metric`.

### Change the default seed
In `src/lib/store.tsx`, edit `seedRef = useRef(20260402)`. The same seed always yields the
same fleet; use the top-bar refresh to reseed randomly.

### Change tick speed / interval
The base interval is `1600` ms in `src/lib/store.tsx`; the speed multiplier divides it.

### Adjust the design tokens
Colors, fonts, shadows and animations live in `tailwind.config.js`.

---

## 9. Troubleshooting

| Symptom | Fix |
| --- | --- |
| Blank page with boot spinner forever | Check the browser console. Ensure Node ≥ 18.18 and re-run `npm install`. |
| Port 3000 in use | `npm run dev -- -p 4000` |
| Type errors after editing | Run `npm run typecheck` and read the first error. |
| Warning about multiple lockfiles | Harmless; `outputFileTracingRoot` is already set. Remove a parent `package-lock.json` to silence it. |
| Slow machine | Lower the speed to `0.5×` or pause; the fleet is capped at a small materialized node count by design. |
| Styles missing | Ensure `src/app/globals.css` is imported by `layout.tsx` and Tailwind content globs include `src/**`. |

---

## 10. Deploying

The app is a standard Next.js project and deploys anywhere Next.js runs:

- **Vercel** — import the repo/folder, framework preset "Next.js", no env vars needed.
- **Node server** — `npm run build && npm run start`.
- **Static export (optional)** — add `output: "export"` to `next.config.js` and `next build`;
  the app is client-rendered and works as static files.

No environment variables, secrets or external services are required.
