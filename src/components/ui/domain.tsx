import { GPU_BY_ID } from "@/lib/constants";
import { gpuShortName, healthLabel } from "@/lib/format";
import { Badge, StatusDot } from "./primitives";

export function HealthBadge({ status, label }: { status: string; label?: string }) {
  const tone =
    status === "healthy"
      ? "green"
      : status === "warning"
        ? "amber"
        : status === "critical"
          ? "red"
          : status === "provisioning"
            ? "cyan"
            : "neutral";
  return (
    <Badge tone={tone as never}>
      <StatusDot status={status} />
      {label ?? healthLabel(status)}
    </Badge>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const tone = severity === "critical" ? "red" : severity === "warning" ? "amber" : "cyan";
  return <Badge tone={tone as never}>{severity}</Badge>;
}

export function JobStateBadge({ state }: { state: string }) {
  const tone =
    state === "running"
      ? "green"
      : state === "pending"
        ? "amber"
        : state === "completed"
          ? "cyan"
          : state === "failed"
            ? "red"
            : state === "paused"
              ? "violet"
              : "neutral";
  return (
    <Badge tone={tone as never}>
      {state === "running" && <StatusDot status="healthy" />}
      {state}
    </Badge>
  );
}

export function GpuBadge({ gpuModelId, count }: { gpuModelId: string; count?: number }) {
  const spec = GPU_BY_ID[gpuModelId];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-ink-600 bg-ink-800 px-2 py-0.5 text-[11px] text-ink-200">
      <span className="font-mono font-semibold text-nv-300">{spec ? gpuShortName(spec.name) : gpuModelId}</span>
      {count !== undefined && <span className="text-ink-400">×{count.toLocaleString()}</span>}
    </span>
  );
}

export function TeamChip({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-300">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </span>
  );
}

export function MethodTag({ children, color = "#22d3ee" }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="rounded px-1.5 py-0.5 font-mono text-[10px] uppercase"
      style={{ backgroundColor: `${color}18`, color }}
    >
      {children}
    </span>
  );
}
