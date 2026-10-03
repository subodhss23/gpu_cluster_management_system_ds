<div align="center">

# ⚡ AetherGrid

### The AI Factory Control Plane — in your browser

**An interactive simulator of an enterprise GPU / GPU-cluster management platform.**
Provision clusters, schedule workloads, watch GPUs in real time, and *fix incidents by hand* —
all on a fully synthetic, zero-backend fleet.

[![License](https://img.shields.io/badge/License-MIT-76b900?style=for-the-badge)](#-license)

[**Quickstart**](#-quickstart) · [**Tour**](#-a-tour) · [**Features**](#-what-you-can-do) · [**How it works**](#-how-the-simulation-works) · [**Docs**](#-documentation)

</div>

---

> **AetherGrid** reproduces the mental model of operating a large accelerated-computing fleet —
> the kind of control plane behind **NVIDIA Base Command Manager**, **Mission Control**, **DCGM**,
> **Slurm**, **Run:AI** and **GPUStack** — as a single, beautiful, interactive web app.
>
> No backend. No API keys. No GPU. Just `npm install && npm run dev`.

---

## 🚀 Quickstart

```bash
# 1. Install
npm install

# 2. Run
npm run dev
# → open http://localhost:3000
```

That's it. The fleet generates itself in the browser the moment the app loads.

<details>
<summary><b>Production build &amp; quality checks</b></summary>

```bash
npm run build      # compile, type-check & lint
npm run start      # serve the optimized build

npm run typecheck  # tsc --noEmit
npm run lint       # next lint
```
</details>

**Requirements:** Node.js 18.18+ and npm. Nothing else.

<details>
<summary><b>Optional: enable PostHog analytics</b></summary>

Analytics is **env-gated** — without a key the SDK never loads. To enable:

```bash
cp .env.example .env.local
# set NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=phc_...  (+ optional NEXT_PUBLIC_POSTHOG_HOST)
```

Privacy-first defaults: session recording off, no PII, and users can opt out anytime in
**Preferences → Privacy & analytics**. See [`instructions.md`](./instructions.md).
</details>

---

## 🌟 Why it's interesting

| | |
| --- | --- |
| 🌍 **Global → GPU drill-down** | Region → cluster → node → individual accelerator, with no loss of context. |
| 🕹️ **It's not a mockup** | A real simulation engine drives every number; telemetry evolves every tick. |
| 🛠️ **You can fix broken things** | Guided runbooks repair incidents and *actually change world state*, live. |
| 🧩 **You can build configs** | Create, validate and apply named hardware/runtime profiles to any cluster. |
| 🔔 **It talks back** | Real-time toasts and a notification center surface fleet events as they happen. |
| 🌡️ **Physically grounded** | Boost clocks derate with temperature; power includes leakage; GPUs genuinely throttle. |
| 🌗 **Personal** | Theme, speed, density, pinned clusters and notes persist across reloads. |
| ⚡ **Zero friction** | Static, client-side, deterministic, and instantly runnable. |
| 🎨 **Made to look real** | A dense, calm, animated mission-control UI with light & dark themes. |

---

## 🖼️ A tour

| Screen | What you'll see |
| --- | --- |
| **🌐 Mission Control** (`/`) | Fleet KPIs, an animated world map, cluster grid, alert hotspots and a live activity feed. |
| **🏗️ Provision** (`/provision`) | A 4-step wizard: region → profile → GPU family/capacity → fabric & tenancy, with live cost & power estimates. |
| **🧊 Nodes & GPUs** (`/clusters/[id]/nodes`) | Rack view where every cell is one accelerator; click any node for per-GPU telemetry and deep configuration. |
| **📅 Workloads** (`/jobs`, `/clusters/[id]/jobs`) | A Slurm-style scheduler with partitions, QoS, priorities, and submit / pause / cancel / boost. |
| **🚨 Alert Center** (`/alerts`) | DCGM/NVSM-style events with severities, sources and *guided remediation runbooks*. |
| **🧩 Config Manager** (`/configs`) | Named cluster profiles (CUDA, driver, MIG, clock/power caps, NCCL, GDR) — create, edit, apply. |
| **🌐 Fabric & Topology** (`/fabric`, `/topology`) | InfiniBand / NVLink / RoCE domains, port health, placement blocks and oversubscription. |
| **💸 Cost & Billing** (`/billing`) | Run-rate, chargeback by team/cluster/architecture, reservations, storage & egress. |
| **🔔 Notifications** | Live toasts + a notification center with unread badge and deep links. |
| **🌗 Themes & Preferences** (`/settings`) | Light/dark, density, playback speed, pinned clusters — all persisted locally. |

> 💡 **Tip:** after `npm run dev`, drop your own screenshots into a `docs/` folder and embed them
> here — a README with real screenshots is the one people actually read.

---

## 🎛️ What you can do

<table>
<tr><td width="50%" valign="top">

**Operate the fleet**
- Multi-region, multi-cluster topology on a live world map
- Provision clusters (DGX SuperPOD / BasePOD / Slurm / K8s / Run:AI / GPUStack)
- Resize and decommission clusters
- Autoscaling, power steering, preemption
- Users, teams, RBAC, editable quotas

</td><td width="50%" valign="top">

**Observe & debug**
- Live GPU / HBM / power / thermal / fabric telemetry
- Rack thermal & power-budget views
- Alert stream with severity, source and metric context
- Fleet health, fabric ops, network topology pages
- Full activity & audit log

</td></tr>
<tr><td valign="top">

**Fix & configure**
- Guided remediation runbooks for every alert
- Step-by-step **or** one-click auto-remediation
- Node deep-config: reboot, clear XID/ECC, clock & power caps
- Create / edit / apply named **cluster configs**
- Everything written to the audit trail

</td><td valign="top">

**Measure & plan**
- Cost run-rate, chargeback and idle-waste detection
- Capacity reservations and reserved vs spot metering
- Scheduler partition depth & backlog
- Deterministic reseed for reproducible demos

</td></tr>
</table>

Full catalogue → [`features.md`](./features.md)

---

## 🧠 How the simulation works

```
   seed ──►  generator.ts  ──►  SimState  ──►  SimProvider ──►  React pages
                    ▲                             │
                    │                             ▼
             runbooks.ts / constants        engine.ts  (advance every tick)
                                                    │
                                        utilization • jobs • alerts
                                        thermal • power • storage • fabric
```

1. **World generation** — a seeded PRNG ([mulberry32](https://gist.github.com/tommyettinger/46a874533244883189143505d203312c))
   builds regions, clusters, materialized nodes with per-GPU telemetry, jobs, users, teams,
   alerts, racks, topology blocks, filesystems and 60 samples of history.
2. **Tick loop** — every 1.6 s (÷ speed), utilization random-walks, GPUs update, jobs progress
   and fail, nodes fault and recover, racks heat up, and alerts fire.
3. **Remediation** — applying a runbook step mutates real state (drains nodes, resets fabrics,
   caps clocks…) and resolves the incident.
4. **Immutable snapshots** feed React through one context; pages derive view-models with pure selectors.

> The same seed always yields the same fleet — reseed anytime from the top bar. 🎲

---

## 📁 Project structure

```
gpu_management_system_deepseek/
├─ design_document.md        # architecture & design
├─ features.md               # full feature catalogue
├─ instructions.md           # setup & usage guide
├─ README.md
└─ src/
   ├─ app/                   # routes (App Router)
   │  ├─ page.tsx            # Mission Control
   │  ├─ clusters/[id]/…     # cluster workspace (overview, nodes, jobs, storage, alerts, settings)
   │  ├─ regions/[id]/       # region drill-down
   │  ├─ fabric/ topology/ health/ partitions/
   │  ├─ alerts/ configs/ activity/
   │  ├─ users/ billing/ provision/
   │  └─ layout.tsx globals.css
   ├─ components/
   │  ├─ layout/             # AppShell, PageHeader, ThemeToggle
   │  ├─ ui/                 # primitives, icons, domain badges
   │  ├─ charts/             # SVG charts + WorldMap
   │  └─ domain/             # ClusterCard, JobTable, AlertList, RemediationPanel
   └─ lib/
      ├─ types.ts            # domain model
      ├─ constants.ts        # regions, GPU catalog, alert templates
      ├─ runbooks.ts         # alert code → root cause + remediation steps
      ├─ rng.ts format.ts selectors.ts cn.ts
      ├─ store.tsx           # simulation context + actions
      └─ synth/              # generator.ts (build) + engine.ts (tick)
```

---

## 📚 Documentation

| Document | What's inside |
| --- | --- |
| [`design_document.md`](./design_document.md) | Architecture, domain model, simulation engine, remediation & config systems, design system |
| [`features.md`](./features.md) | Complete, sectioned feature catalogue |
| [`instructions.md`](./instructions.md) | Install, run, use, customize, troubleshoot, deploy |

---

## 🗺️ Roadmap

- [ ] Conversational AI diagnostics agent ("ask about cluster *Helios*")
- [ ] IndexedDB persistence & shareable seed URLs
- [ ] Real backend adapters (Slurm / Kubernetes / DCGM) behind the store API
- [ ] Interactive force-directed fabric topology graph
- [ ] Datacenter-scale Power Reservation Steering
- [ ] Prometheus/Grafana-style dashboard builder
- [ ] Cloudbursting / hybrid-cloud overflow + carbon-aware scheduling

---

## 🤝 Contributing

Contributions are welcome!

1. 🍴 Fork and branch: `git checkout -b feat/amazing-thing`
2. 🧭 Keep the design tokens and component patterns consistent (see `design_document.md`)
3. ✅ Run `npm run typecheck && npm run lint && npm run build`
4. 🚀 Open a PR with a clear description

Good first issues: new GPU models in `constants.ts`, new alert runbooks in `runbooks.ts`,
new chart types in `components/charts`.

---

## 📄 License

Released under the **MIT License**.

AetherGrid is an independent, educational simulation. It is **not affiliated with or endorsed
by NVIDIA**. Product names (NVIDIA, Base Command Manager, DCGM, NVLink, Slurm, Kubernetes,
Run:AI, GPUStack, …) are trademarks of their respective owners and are referenced here for
descriptive and illustrative purposes only. **All data is fictional.**

<div align="center">

**Built in California by Subodh**

</div>
