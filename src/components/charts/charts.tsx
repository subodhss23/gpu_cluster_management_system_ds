"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

const GRID_STROKE = "rgb(var(--ink-500) / 0.28)";
const TRACK_STROKE = "rgb(var(--ink-700) / 0.8)";

function buildPoints(data: number[], w: number, h: number, min: number, max: number) {
  const n = Math.max(1, data.length - 1);
  const span = max - min || 1;
  return data.map((v, i) => {
    const x = (i / n) * w;
    const y = h - ((v - min) / span) * h;
    return [x, y] as const;
  });
}

function linePath(points: readonly (readonly [number, number])[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
}

export function Sparkline({
  data,
  color = "#76b900",
  height = 34,
  className,
  fill = true,
}: {
  data: number[];
  color?: string;
  height?: number;
  className?: string;
  fill?: boolean;
}) {
  const id = useId();
  const w = 120;
  const h = height;
  if (data.length === 0) return <div className={cn("h-[34px]", className)} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const points = buildPoints(data, w, h, min, max);
  const d = linePath(points);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("w-full", className)} style={{ height }}>
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && (
        <path d={`${d} L${w},${h} L0,${h} Z`} fill={`url(#spark-${id})`} />
      )}
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function AreaChart({
  data,
  color = "#76b900",
  height = 180,
  yFormat,
  gridLines = 4,
  compare,
  compareColor = "#22d3ee",
  className,
}: {
  data: number[];
  color?: string;
  height?: number;
  yFormat?: (v: number) => string;
  gridLines?: number;
  compare?: number[];
  compareColor?: string;
  className?: string;
}) {
  const id = useId();
  const w = 600;
  const h = 200;
  const pad = 4;
  if (data.length === 0) return <div className={className} style={{ height }} />;
  const all = compare ? [...data, ...compare] : data;
  const rawMin = Math.min(...all);
  const rawMax = Math.max(...all);
  const min = rawMin - (rawMax - rawMin) * 0.08;
  const max = rawMax + (rawMax - rawMin) * 0.08;
  const points = buildPoints(data, w, h - pad * 2, min, max).map(([x, y]) => [x, y + pad] as const);
  const d = linePath(points);
  const compareD = compare
    ? linePath(buildPoints(compare, w, h - pad * 2, min, max).map(([x, y]) => [x, y + pad] as const))
    : null;
  return (
    <div className={cn("relative", className)} style={{ height }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const y = (i / gridLines) * h;
          return (
            <line
              key={i}
              x1="0"
              y1={y}
              x2={w}
              y2={y}
              stroke={GRID_STROKE}
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        <path d={`${d} L${w},${h} L0,${h} Z`} fill={`url(#area-${id})`} />
        <path d={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {compareD && (
          <path
            d={compareD}
            fill="none"
            stroke={compareColor}
            strokeWidth="1.5"
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      {yFormat && (
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between py-1 text-[9px] text-ink-500">
          <span>{yFormat(max)}</span>
          <span>{yFormat(min)}</span>
        </div>
      )}
    </div>
  );
}

export function LineChart({
  series,
  height = 180,
  className,
  yFormat,
}: {
  series: { name: string; color: string; data: number[] }[];
  height?: number;
  className?: string;
  yFormat?: (v: number) => string;
}) {
  const w = 600;
  const h = 200;
  const all = series.flatMap((s) => s.data);
  if (all.length === 0) return <div className={className} style={{ height }} />;
  const rawMin = Math.min(...all);
  const rawMax = Math.max(...all);
  const min = rawMin - (rawMax - rawMin) * 0.06;
  const max = rawMax + (rawMax - rawMin) * 0.06;
  return (
    <div className={cn("relative", className)} style={{ height }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full">
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={i}
            x1="0"
            y1={(i / 4) * h}
            x2={w}
            y2={(i / 4) * h}
            stroke={GRID_STROKE}
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {series.map((s) => (
          <path
            key={s.name}
            d={linePath(buildPoints(s.data, w, h, min, max))}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {yFormat && (
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between text-[9px] text-ink-500">
          <span>{yFormat(max)}</span>
          <span>{yFormat(min)}</span>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-3">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5 text-[11px] text-ink-400">
            <span className="h-1.5 w-3 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export function RadialGauge({
  value,
  label,
  unit = "%",
  color = "#76b900",
  size = 120,
  thickness = 10,
  display,
}: {
  value: number;
  label?: string;
  unit?: string;
  color?: string;
  size?: number;
  thickness?: number;
  display?: string;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, Math.max(0, value));
  const dash = c * 0.75;
  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-[135deg]">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={TRACK_STROKE}
            strokeWidth={thickness}
            strokeDasharray={`${dash} ${c}`}
            strokeLinecap="round"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={thickness}
            strokeDasharray={`${dash * pct} ${c}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-lg font-semibold text-ink-100">
            {display ?? `${(value * 100).toFixed(0)}${unit}`}
          </span>
        </div>
      </div>
      {label && <span className="mt-1 text-[11px] uppercase tracking-wider text-ink-400">{label}</span>}
    </div>
  );
}

export function Donut({
  segments,
  size = 140,
  thickness = 16,
  centerLabel,
  centerValue,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {segments.map((s) => {
            const len = (s.value / total) * c;
            const el = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        {(centerValue || centerLabel) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {centerValue && <span className="font-mono text-xl font-semibold text-ink-100">{centerValue}</span>}
            {centerLabel && <span className="text-[10px] uppercase tracking-wider text-ink-400">{centerLabel}</span>}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="text-ink-300">{s.label}</span>
            <span className="ml-auto font-mono text-ink-400">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HBar({
  items,
  unit = "",
  max,
}: {
  items: { label: string; value: number; color: string; sub?: string }[];
  unit?: string;
  max?: number;
}) {
  const top = max ?? Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="truncate text-ink-300">{item.label}</span>
            <span className="font-mono text-ink-400">
              {item.value.toLocaleString()}
              {unit}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(item.value / top) * 100}%`, backgroundColor: item.color }}
            />
          </div>
          {item.sub && <p className="mt-0.5 text-[10px] text-ink-500">{item.sub}</p>}
        </div>
      ))}
    </div>
  );
}

export function GpuHeatmap({
  cells,
  columns = 16,
  onSelect,
  selectedId,
}: {
  cells: {
    id: string;
    label: string;
    sub?: string;
    value: number;
    color: string;
    status?: string;
  }[];
  columns?: number;
  onSelect?: (id: string) => void;
  selectedId?: string;
}) {
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {cells.map((cell) => (
        <button
          key={cell.id}
          type="button"
          title={`${cell.label}${cell.sub ? ` · ${cell.sub}` : ""}`}
          onClick={() => onSelect?.(cell.id)}
          className={cn(
            "group relative aspect-square rounded-[3px] border transition-transform hover:scale-110 hover:z-10",
            selectedId === cell.id ? "ring-2 ring-white/70" : "border-transparent"
          )}
          style={{ backgroundColor: cell.color }}
        >
          <span className="sr-only">{cell.label}</span>
        </button>
      ))}
    </div>
  );
}

export function utilColor(value: number): string {
  if (value >= 0.9) return "#76b900";
  if (value >= 0.7) return "#93e000";
  if (value >= 0.5) return "#aef22f";
  if (value >= 0.3) return "#c8f56e";
  if (value >= 0.1) return "#456d00";
  return "#2f4a00";
}

export function tempColor(c: number): string {
  if (c >= 85) return "#ef4444";
  if (c >= 75) return "#fb923c";
  if (c >= 60) return "#f59e0b";
  if (c >= 45) return "#aef22f";
  return "#456d00";
}
