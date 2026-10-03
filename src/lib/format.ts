export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function pct(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function num(value: number, digits = 0): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function compact(value: number): string {
  return Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function usd(value: number, digits = 0): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function compactUsd(value: number): string {
  return `$${Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)}`;
}

export function tb(value: number): string {
  if (value >= 1024) return `${(value / 1024).toFixed(2)} PB`;
  return `${value.toFixed(1)} TB`;
}

export function gb(value: number): string {
  if (value >= 1024) return `${(value / 1024).toFixed(1)} TiB`;
  return `${value.toFixed(0)} GiB`;
}

export function duration(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds < 0) return "—";
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor((totalSeconds / 3600) % 24);
  const d = Math.floor(totalSeconds / 86400);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function relTime(timestamp: number, now = Date.now()): string {
  const diff = Math.max(0, now - timestamp);
  const s = Math.floor(diff / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function clockTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function dateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function healthLabel(status: string): string {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "warning":
      return "Warning";
    case "critical":
      return "Critical";
    case "offline":
      return "Offline";
    case "provisioning":
      return "Provisioning";
    default:
      return status;
  }
}

export function healthColor(status: string): string {
  switch (status) {
    case "healthy":
      return "#76b900";
    case "warning":
      return "#f59e0b";
    case "critical":
      return "#ef4444";
    case "offline":
      return "#64748b";
    case "provisioning":
      return "#22d3ee";
    default:
      return "#94a3b8";
  }
}

export function jobStateColor(state: string): string {
  switch (state) {
    case "running":
      return "#76b900";
    case "pending":
      return "#f59e0b";
    case "completed":
      return "#22d3ee";
    case "failed":
      return "#ef4444";
    case "cancelled":
    case "held":
      return "#94a3b8";
    case "paused":
      return "#a855f7";
    default:
      return "#94a3b8";
  }
}

export function severityColor(severity: string): string {
  switch (severity) {
    case "critical":
      return "#ef4444";
    case "warning":
      return "#f59e0b";
    default:
      return "#22d3ee";
  }
}

export function gpuShortName(name: string): string {
  return name.replace("NVIDIA ", "").replace(/ (SXM|PCIe|NVL.*)$/, "");
}

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
