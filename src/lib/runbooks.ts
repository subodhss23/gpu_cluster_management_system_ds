import type { Alert, Runbook } from "./types";

const GENERIC: Runbook = {
  code: "GENERIC",
  title: "Triage infrastructure event",
  summary: "A generic triage sequence for uncatalogued events.",
  rootCause:
    "The event has no dedicated runbook. Follow the standard triage path: acknowledge, contain, then verify.",
  steps: [
    {
      id: "ack",
      label: "Acknowledge event",
      detail: "Claim the alert so other operators know it is being handled.",
      kind: "acknowledge",
      effect: "Moves the event to acknowledged.",
    },
    {
      id: "contain",
      label: "Contain affected workload",
      detail: "Move jobs off the implicated resource to stop the blast radius growing.",
      kind: "migrate-jobs",
      effect: "Migrates running jobs off the affected cluster.",
    },
    {
      id: "verify",
      label: "Verify recovery",
      detail: "Run a health sweep and confirm telemetry has returned to nominal.",
      kind: "reboot-node",
      effect: "Reboots the affected node and restores it to the pool.",
      requiresNode: true,
    },
  ],
};

export const RUNBOOKS: Record<string, Runbook> = {
  "XID 79": {
    code: "XID 79",
    title: "GPU has fallen off the bus",
    summary: "The device became unreachable over PCIe and cannot be scheduled.",
    rootCause:
      "Typically a PCIe link or riser fault, or a device hang requiring a full node power cycle. The GPU must be drained before any recovery attempt.",
    steps: [
      {
        id: "drain",
        label: "Drain the node",
        detail: "Cordon the node so the scheduler stops placing new work on it and requeues running jobs.",
        kind: "drain-node",
        effect: "Node leaves the ready pool; jobs are requeued.",
        requiresNode: true,
      },
      {
        id: "migrate",
        label: "Requeue affected jobs",
        detail: "Checkpoint and requeue training jobs onto healthy nodes.",
        kind: "requeue-jobs",
        effect: "Running jobs on the node return to the queue.",
      },
      {
        id: "reboot",
        label: "Power-cycle the node",
        detail: "Reset the PCIe link and reinitialize the device via a host reboot.",
        kind: "reboot-node",
        effect: "Node reboots and rejoins with healthy GPUs.",
        requiresNode: true,
      },
      {
        id: "clear",
        label: "Clear XID counters",
        detail: "Zero the error counters once the device re-enumerates cleanly.",
        kind: "clear-xid",
        effect: "XID counters reset to 0.",
        requiresNode: true,
      },
    ],
  },
  "XID 48": {
    code: "XID 48",
    title: "Double-bit ECC error detected",
    summary: "An uncorrectable HBM error was recorded; the GPU may return bad results.",
    rootCause:
      "A hardware memory fault in HBM. Row remapping can recover the bank temporarily, but recurring DBEs should trigger an RMA.",
    steps: [
      {
        id: "ack",
        label: "Acknowledge and isolate",
        detail: "Confirm the GPU is no longer trusted for training and quarantine it.",
        kind: "acknowledge",
        effect: "Event acknowledged.",
      },
      {
        id: "ecc",
        label: "Perform row remapping",
        detail: "Remap the failed memory rows and mark the device healthy again.",
        kind: "reset-ecc",
        effect: "ECC errors cleared and row remap completed.",
        requiresNode: true,
      },
      {
        id: "drain",
        label: "Drain if remap fails",
        detail: "If errors persist, drain the node for hardware replacement.",
        kind: "drain-node",
        effect: "Node removed from service for RMA.",
        requiresNode: true,
      },
    ],
  },
  "XID 63": {
    code: "XID 63",
    title: "ECC row remapping event",
    summary: "A row remap was recorded; a memory bank is degrading.",
    rootCause: "Correctable ECC errors crossed the threshold that triggers a row remap.",
    steps: [
      {
        id: "ack",
        label: "Track the device",
        detail: "Add the GPU to the watchlist and continue monitoring for recurrence.",
        kind: "acknowledge",
        effect: "Event acknowledged; device watched.",
      },
      {
        id: "reset",
        label: "Reset ECC state",
        detail: "Clear correctable counters after the remap settles.",
        kind: "reset-ecc",
        effect: "Correctable ECC counters reset.",
        requiresNode: true,
      },
    ],
  },
  "THERM-01": {
    code: "THERM-01",
    title: "Thermal throttling engaged",
    summary: "SM clocks were reduced because the GPU crossed the thermal limit.",
    rootCause:
      "Rack inlet temperature is too high or airflow is restricted. Either improve cooling or cap the power/clock envelope.",
    steps: [
      {
        id: "clock",
        label: "Apply a clock cap",
        detail: "Reduce the SM clock ceiling to keep the GPU below the throttle threshold.",
        kind: "throttle-clock",
        effect: "GPU clock ceiling lowered; temperature falls.",
        requiresNode: true,
      },
      {
        id: "power",
        label: "Cap device power",
        detail: "Lower the power limit so heat output drops within the rack budget.",
        kind: "cap-power",
        effect: "GPU power cap reduced.",
        requiresNode: true,
      },
      {
        id: "margin",
        label: "Raise thermal margin",
        detail: "Increase fan/airflow headroom for the rack and re-evaluate.",
        kind: "raise-thermal-margin",
        effect: "Rack airflow raised; inlet temperature reduced.",
      },
    ],
  },
  "PWR-02": {
    code: "PWR-02",
    title: "Rack power budget exceeded",
    summary: "The rack is drawing more than its reserved power budget.",
    rootCause: "Concurrent workloads pushed the rack beyond its power allocation; load must be shed.",
    steps: [
      {
        id: "steer",
        label: "Enable power steering",
        detail: "Turn on Power Reservation Steering to hold the rack within budget automatically.",
        kind: "toggle-power-steering",
        effect: "Power steering enabled for the cluster.",
      },
      {
        id: "shed",
        label: "Shed low-priority jobs",
        detail: "Terminate idle or best-effort jobs to reclaim power headroom.",
        kind: "kill-idle-jobs",
        effect: "Idle and low-priority jobs cancelled.",
      },
      {
        id: "cap",
        label: "Cap per-GPU power",
        detail: "Apply a device power cap to the busiest GPUs in the rack.",
        kind: "cap-power",
        effect: "GPU power caps applied.",
        requiresNode: true,
      },
    ],
  },
  "IB-14": {
    code: "IB-14",
    title: "InfiniBand link flap",
    summary: "A fabric port flapped repeatedly in the sampling window.",
    rootCause: "A faulty transceiver, cable or switch port. Reset the link, then replace if it recurs.",
    steps: [
      {
        id: "migrate",
        label: "Migrate collective jobs",
        detail: "Move tightly-coupled jobs off the affected fabric island to avoid stalls.",
        kind: "migrate-jobs",
        effect: "Running jobs migrated to healthy nodes.",
      },
      {
        id: "reset",
        label: "Reset the fabric port",
        detail: "Bounce the port and re-run link training.",
        kind: "reset-fabric",
        effect: "Fabric ports re-trained; port-up count restored.",
      },
    ],
  },
  "NVSM-07": {
    code: "NVSM-07",
    title: "NVLink error counters rising",
    summary: "Correctable NVLink errors increased on a GPU pair.",
    rootCause: "A degrading NVLink lane or a software-side collective that needs retraining.",
    steps: [
      {
        id: "reset",
        label: "Reset NVLink counters",
        detail: "Clear the link error counters and re-train the link.",
        kind: "reset-fabric",
        effect: "NVLink counters cleared and ports retrained.",
      },
      {
        id: "drain",
        label: "Drain on recurrence",
        detail: "If errors return, drain the node for service.",
        kind: "drain-node",
        effect: "Node drained for maintenance.",
        requiresNode: true,
      },
    ],
  },
  "SLURM-03": {
    code: "SLURM-03",
    title: "Job requeued by node failure",
    summary: "A running job was requeued after its node entered drain state.",
    rootCause: "The node hosting the job failed or was drained; scheduler restored the job to the queue.",
    steps: [
      {
        id: "requeue",
        label: "Confirm requeue",
        detail: "Verify the job is healthy in the queue and its resources are re-reserved.",
        kind: "requeue-jobs",
        effect: "Job confirmed requeued.",
      },
      {
        id: "scale",
        label: "Add capacity",
        detail: "Scale the cluster out so the requeued job can start promptly.",
        kind: "scale-out",
        effect: "Cluster capacity increased.",
      },
    ],
  },
  "QUEUE-01": {
    code: "QUEUE-01",
    title: "Partition backlog high",
    summary: "Pending jobs exceed the fairness threshold for a partition.",
    rootCause: "Demand is outpacing available capacity in this partition.",
    steps: [
      {
        id: "preempt",
        label: "Enable preemption",
        detail: "Allow low-priority spot jobs to yield to queued high-priority work.",
        kind: "enable-preemption",
        effect: "Preemption enabled for the cluster.",
      },
      {
        id: "kill",
        label: "Reclaim idle allocations",
        detail: "Reap jobs that are holding GPUs without making progress.",
        kind: "kill-idle-jobs",
        effect: "Idle jobs cancelled, freeing GPUs.",
      },
      {
        id: "scale",
        label: "Scale out the partition",
        detail: "Add GPU capacity so the backlog can drain.",
        kind: "scale-out",
        effect: "Cluster capacity increased.",
      },
    ],
  },
  "MEM-11": {
    code: "MEM-11",
    title: "HBM utilization stalled",
    summary: "Framebuffer use is flat while SM utilization is elevated.",
    rootCause: "A process may be spinning or leaking; reclaim memory or restart the job.",
    steps: [
      {
        id: "kill",
        label: "Reap stalled jobs",
        detail: "Cancel jobs that are holding memory without progress.",
        kind: "kill-idle-jobs",
        effect: "Stalled jobs cancelled, freeing HBM.",
      },
      {
        id: "migrate",
        label: "Migrate remaining work",
        detail: "Move healthy jobs to nodes with free HBM.",
        kind: "migrate-jobs",
        effect: "Jobs redistributed to free capacity.",
      },
    ],
  },
};

export function runbookForCode(code: string): Runbook {
  return RUNBOOKS[code] ?? { ...GENERIC, code, title: code };
}

export function stepsFor(code: string): string[] {
  return runbookForCode(code).steps.map((s) => s.label);
}

export function alertProgress(alert: Alert): number {
  const total = Math.max(1, alert.remediationSteps.length);
  return Math.min(1, alert.remediatedSteps / total);
}
