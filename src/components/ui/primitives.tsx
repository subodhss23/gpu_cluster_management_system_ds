import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { healthColor } from "@/lib/format";

export function Panel({
  children,
  className,
  bodyClassName,
  title,
  subtitle,
  actions,
  padded = true,
  fill = false,
}: {
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  padded?: boolean;
  /** When true, the panel is a flex column that stretches its body to fill the cell. */
  fill?: boolean;
}) {
  return (
    <section
      className={cn(
        "relative rounded-xl border border-ink-700/80 bg-ink-850/70 shadow-panel backdrop-blur",
        fill && "flex h-full flex-col",
        className
      )}
    >
      {(title || actions) && (
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-ink-700/60 px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="truncate text-sm font-semibold text-ink-100">{title}</h2>}
            {subtitle && <p className="mt-0.5 truncate text-xs text-ink-400">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(padded && "p-4", fill && "flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "amber" | "red" | "cyan" | "violet" | "blue";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "border-ink-600 bg-ink-800 text-ink-300",
    green: "border-nv-500/40 bg-nv-500/10 text-nv-300",
    amber: "border-vol-amber/40 bg-vol-amber/10 text-vol-amber",
    red: "border-vol-red/40 bg-vol-red/10 text-vol-red",
    cyan: "border-vol-teal/40 bg-vol-teal/10 text-vol-teal",
    violet: "border-vol-violet/40 bg-vol-violet/10 text-vol-violet",
    blue: "border-vol-blue/40 bg-vol-blue/10 text-vol-blue",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusDot({ status, pulse = true }: { status: string; pulse?: boolean }) {
  const color = healthColor(status);
  return (
    <span className="relative inline-flex h-2.5 w-2.5 items-center justify-center">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {pulse && (status === "critical" || status === "provisioning") && (
        <span
          className="absolute inline-flex h-2 w-2 animate-pulseRing rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = "default",
  size = "md",
  disabled,
  className,
  type = "button",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
  title?: string;
}) {
  const variants: Record<string, string> = {
    default:
      "border-ink-600 bg-ink-750 text-ink-200 hover:border-ink-500 hover:bg-ink-700",
    primary:
      "border-nv-500/50 bg-nv-500/15 text-nv-200 hover:bg-nv-500/25 hover:shadow-glow",
    ghost: "border-transparent bg-transparent text-ink-300 hover:bg-ink-800 hover:text-ink-100",
    danger: "border-vol-red/40 bg-vol-red/10 text-vol-red hover:bg-vol-red/20",
    outline: "border-ink-600 bg-transparent text-ink-200 hover:border-nv-500/50 hover:text-nv-200",
  };
  const sizes: Record<string, string> = {
    sm: "px-2.5 py-1 text-xs",
    md: "px-3.5 py-2 text-sm",
  };
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </button>
  );
}

export function ProgressBar({
  value,
  color = "#76b900",
  className,
  showTrack = true,
}: {
  value: number;
  color?: string;
  className?: string;
  showTrack?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-full",
        showTrack && "bg-ink-700",
        className
      )}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${Math.min(100, Math.max(0, value * 100))}%`,
          background: `linear-gradient(90deg, ${color}66, ${color})`,
        }}
      />
    </div>
  );
}

export function StatTile({
  label,
  value,
  sub,
  accent = "#76b900",
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-ink-700/80 bg-ink-850/70 p-4 shadow-panel",
        className
      )}
    >
      <div
        className="absolute inset-x-0 top-0 h-px opacity-80"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-ink-400">{label}</p>
        {icon && <span style={{ color: accent }}>{icon}</span>}
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold text-ink-100">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-400">{sub}</p>}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-ink-700 bg-ink-900/60 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-md font-medium transition-colors",
            size === "sm" ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
            value === opt.value
              ? "bg-nv-500/20 text-nv-200"
              : "text-ink-400 hover:text-ink-200"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function KeyValue({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-ink-700/40 py-2 last:border-0">
      <span className="text-xs text-ink-400">{label}</span>
      <span className="text-right text-xs font-medium text-ink-200">{children}</span>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-ink-700 bg-ink-900/40 py-10 text-center">
      <p className="text-sm font-medium text-ink-300">{title}</p>
      {hint && <p className="text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

export function Avatar({ initials, hue, size = 28 }: { initials: string; hue: number; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full border font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        color: `hsl(${hue} 85% 72%)`,
        backgroundColor: `hsl(${hue} 60% 16%)`,
        borderColor: `hsl(${hue} 60% 30%)`,
      }}
    >
      {initials}
    </span>
  );
}

export function Pill({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium"
      style={{ borderColor: `${color}55`, backgroundColor: `${color}14`, color }}
    >
      {children}
    </span>
  );
}

export function Meter({
  label,
  value,
  total,
  unit,
  color,
}: {
  label: string;
  value: number;
  total: number;
  unit?: string;
  color?: string;
}) {
  const ratio = total ? value / total : 0;
  const auto = ratio > 0.9 ? "#ef4444" : ratio > 0.75 ? "#f59e0b" : "#76b900";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-ink-400">{label}</span>
        <span className="font-mono text-ink-300">
          {value.toFixed(0)}
          {unit} / {total.toFixed(0)}
          {unit}
        </span>
      </div>
      <ProgressBar value={ratio} color={color ?? auto} />
    </div>
  );
}
