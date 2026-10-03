"use client";

import { healthColor } from "@/lib/format";

export interface MapMarker {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  gpuCount: number;
  utilization: number;
  health: string;
  clusters: number;
}

function project(lat: number, lng: number) {
  return {
    x: ((lng + 180) / 360) * 1000,
    y: ((90 - lat) / 180) * 500,
  };
}

function arc(a: MapMarker, b: MapMarker) {
  const p1 = project(a.lat, a.lng);
  const p2 = project(b.lat, b.lng);
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2 - Math.abs(p1.x - p2.x) * 0.18 - 20;
  return `M${p1.x},${p1.y} Q${mx},${my} ${p2.x},${p2.y}`;
}

export function WorldMap({
  markers,
  onSelect,
  selectedId,
}: {
  markers: MapMarker[];
  onSelect?: (id: string) => void;
  selectedId?: string;
}) {
  const hub = markers[0];
  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-ink-700/60 bg-ink-950/60">
      <div className="pointer-events-none absolute inset-0 bg-grid-fade opacity-70" />
      <svg viewBox="0 0 1000 500" className="relative h-full w-full">
        <defs>
          <linearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#76b900" stopOpacity="0" />
            <stop offset="50%" stopColor="#76b900" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="nodeGlow">
            <stop offset="0%" stopColor="#76b900" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#76b900" stopOpacity="0" />
          </radialGradient>
        </defs>

        {Array.from({ length: 11 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={(i / 10) * 500} x2="1000" y2={(i / 10) * 500} stroke="rgb(var(--ink-500) / 0.16)" strokeWidth="1" />
        ))}
        {Array.from({ length: 19 }).map((_, i) => (
          <line key={`v${i}`} x1={(i / 18) * 1000} y1="0" x2={(i / 18) * 1000} y2="500" stroke="rgb(var(--ink-500) / 0.16)" strokeWidth="1" />
        ))}

        {hub &&
          markers.slice(1).map((m) => (
            <path
              key={`arc-${m.id}`}
              d={arc(hub, m)}
              fill="none"
              stroke="url(#arcGrad)"
              strokeWidth="1.5"
              strokeDasharray="6 8"
              style={{ animation: "dash 3s linear infinite" }}
            />
          ))}

        {markers.map((m) => {
          const p = project(m.lat, m.lng);
          const r = 4 + Math.min(14, Math.sqrt(m.gpuCount) / 6);
          const selected = selectedId === m.id;
          return (
            <g
              key={m.id}
              className="cursor-pointer"
              onClick={() => onSelect?.(m.id)}
            >
              <circle cx={p.x} cy={p.y} r={r * 3} fill="url(#nodeGlow)" />
              <circle
                cx={p.x}
                cy={p.y}
                r={r}
                fill={healthColor(m.health)}
                fillOpacity={selected ? 1 : 0.85}
                stroke={selected ? "#ffffff" : healthColor(m.health)}
                strokeWidth={selected ? 2 : 1}
              />
              <circle cx={p.x} cy={p.y} r={r + 6} fill="none" stroke={healthColor(m.health)} strokeOpacity="0.25" />
              <text x={p.x + r + 8} y={p.y + 3} fill="rgb(var(--ink-100))" fontSize="13" fontFamily="ui-monospace, monospace">
                {m.name}
              </text>
              <text x={p.x + r + 8} y={p.y + 19} fill="rgb(var(--ink-400))" fontSize="11">
                {m.city} · {m.gpuCount.toLocaleString()} GPUs
              </text>
            </g>
          );
        })}
      </svg>
      <style>{`@keyframes dash { to { stroke-dashoffset: -100; } }`}</style>
    </div>
  );
}
