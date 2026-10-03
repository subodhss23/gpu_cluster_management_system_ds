"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { clockTime } from "@/lib/format";
import { useSim } from "@/lib/store";
import { fleetKpis } from "@/lib/selectors";
import { Button, Segmented } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icons";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Toasts } from "@/components/layout/Toasts";
import { NotificationBell } from "@/components/layout/NotificationBell";

const NAV_GROUPS: { title: string; items: { href: string; label: string; icon: string }[] }[] = [
  {
    title: "Operations",
    items: [
      { href: "/", label: "Mission Control", icon: "dashboard" },
      { href: "/clusters", label: "Cluster Fleet", icon: "cluster" },
      { href: "/jobs", label: "Workloads", icon: "jobs" },
      { href: "/partitions", label: "Partitions", icon: "layers" },
    ],
  },
  {
    title: "Infrastructure",
    items: [
      { href: "/fabric", label: "Fabric Operations", icon: "network" },
      { href: "/topology", label: "Network Topology", icon: "globe" },
      { href: "/health", label: "Fleet Health", icon: "activity" },
      { href: "/alerts", label: "Alert Center", icon: "bell" },
      { href: "/configs", label: "Config Manager", icon: "settings" },
      { href: "/activity", label: "Activity Log", icon: "clock" },
    ],
  },
  {
    title: "Organization",
    items: [
      { href: "/users", label: "Users & Teams", icon: "users" },
      { href: "/billing", label: "Cost & Billing", icon: "dollar" },
      { href: "/provision", label: "Provision Cluster", icon: "rocket" },
      { href: "/settings", label: "Preferences", icon: "settings" },
    ],
  },
];

function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-2.5">
      <span className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-nv-500/40 bg-nv-500/10">
        <span className="absolute inset-0 rounded-lg bg-nv-500/20 blur-md transition group-hover:bg-nv-500/30" />
        <svg viewBox="0 0 24 24" className="relative h-[18px] w-[18px] text-nv-300" width={18} height={18} fill="currentColor">
          <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 3.2 5.5 3v6L12 17.4l-5.5-3.2v-6l5.5-3Z" />
          <circle cx="12" cy="12" r="2.4" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold tracking-tight text-ink-100">AetherGrid</span>
        <span className="block text-[10px] uppercase tracking-[0.18em] text-ink-500">AI Factory Control</span>
      </span>
    </Link>
  );
}

function LiveClock() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="hidden font-mono text-xs text-ink-400 sm:inline">
      {now ? clockTime(now) : "--:--:--"} UTC{new Date().getTimezoneOffset() === 0 ? "" : ""}
    </span>
  );
}

function SimulationControls() {
  const { state, actions } = useSim();
  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant={state.running ? "default" : "primary"}
        onClick={actions.toggleRunning}
        title={state.running ? "Pause simulation" : "Resume simulation"}
      >
        <Icon name={state.running ? "pause" : "play"} size={13} />
        {state.running ? "Pause" : "Resume"}
      </Button>
      <Segmented
        size="sm"
        value={String(state.speed)}
        onChange={(v) => actions.setSpeed(Number(v))}
        options={[
          { label: "0.5×", value: "0.5" },
          { label: "1×", value: "1" },
          { label: "2×", value: "2" },
          { label: "4×", value: "4" },
        ]}
      />
      <Button size="sm" variant="ghost" onClick={() => actions.regenerate()} title="Regenerate synthetic fleet">
        <Icon name="refresh" size={14} />
      </Button>
    </div>
  );
}

function SearchBox() {
  const { state } = useSim();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const clusters = state.clusters
      .filter((c) => c.name.toLowerCase().includes(term) || c.kind.toLowerCase().includes(term) || c.regionId.includes(term))
      .slice(0, 5)
      .map((c) => ({ type: "cluster", id: c.id, label: c.name, sub: `${c.kind} · ${c.regionId}`, href: `/clusters/${c.id}` }));
    const users = state.users
      .filter((u) => u.name.toLowerCase().includes(term))
      .slice(0, 3)
      .map((u) => ({ type: "user", id: u.id, label: u.name, sub: u.role, href: "/users" }));
    return [...clusters, ...users];
  }, [q, state.clusters, state.users]);

  return (
    <div ref={boxRef} className="relative hidden flex-1 md:block md:max-w-md">
      <div className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-900/70 px-3 py-1.5 focus-within:border-nv-500/50">
        <Icon name="search" size={15} className="text-ink-500" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search clusters, users, regions…"
          className="w-full bg-transparent text-sm text-ink-200 outline-none placeholder:text-ink-500"
        />
        <kbd className="hidden rounded border border-ink-600 px-1.5 text-[10px] text-ink-500 lg:block">⌘K</kbd>
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-lg border border-ink-700 bg-ink-850 shadow-panel">
          {results.map((r) => (
            <button
              key={`${r.type}-${r.id}`}
              type="button"
              onClick={() => {
                router.push(r.href);
                setOpen(false);
                setQ("");
              }}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-ink-800"
            >
              <span className="truncate text-sm text-ink-200">{r.label}</span>
              <span className="shrink-0 text-[11px] text-ink-500">{r.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { state } = useSim();
  const kpis = useMemo(() => fleetKpis(state), [state]);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-ink-800 px-4">
        <Logo />
      </div>
      <nav className="flex-1 space-y-3 overflow-y-auto p-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-ink-600">{group.title}</p>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive(item.href)
                    ? "bg-nv-500/12 text-nv-200"
                    : "text-ink-400 hover:bg-ink-800 hover:text-ink-200"
                )}
              >
                <Icon
                  name={item.icon}
                  size={16}
                  className={cn(isActive(item.href) ? "text-nv-300" : "text-ink-500 group-hover:text-ink-300")}
                />
                <span className="flex-1">{item.label}</span>
                {item.href === "/alerts" && kpis.activeAlerts > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                      kpis.criticalAlerts > 0 ? "bg-vol-red/20 text-vol-red" : "bg-vol-amber/20 text-vol-amber"
                    )}
                  >
                    {kpis.activeAlerts}
                  </span>
                )}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-ink-800 p-3">
        <div className="rounded-lg border border-ink-700 bg-ink-900/60 p-3">
          <div className="flex items-center justify-between text-[11px] text-ink-400">
            <span>Fleet health</span>
            <span className="font-mono text-nv-300">
              {kpis.healthyClusters}/{kpis.clusters}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-800">
            <div
              className="h-full rounded-full bg-nv-500 transition-all"
              style={{ width: `${(kpis.healthyClusters / Math.max(1, kpis.clusters)) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-[10px] text-ink-500">
            tick {state.tick.toLocaleString()} · seed {state.seed}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-ink-950 text-ink-200">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-ink-800 bg-ink-900/80 backdrop-blur lg:block">
        {sidebar}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 border-r border-ink-800 bg-ink-900">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink-800 bg-ink-950/80 px-4 backdrop-blur-lg">
          <button
            type="button"
            className="rounded-lg border border-ink-700 p-2 text-ink-300 lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Icon name="layers" size={16} />
          </button>
          <SearchBox />
          <div className="ml-auto flex items-center gap-3">
            <LiveClock />
            <SimulationControls />
            <ThemeToggle />
            <NotificationBell />
            <Link
              href="/alerts"
              className="relative rounded-lg border border-ink-700 p-2 text-ink-300 hover:border-ink-500 hover:text-ink-100"
              title="Alert center"
            >
              <Icon name="bell" size={16} />
              {kpis.activeAlerts > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-vol-red px-1 text-[9px] font-bold text-white">
                  {kpis.activeAlerts > 99 ? "99+" : kpis.activeAlerts}
                </span>
              )}
            </Link>
          </div>
        </header>
        <main className="min-w-0 flex-1 bg-grid-fade bg-ink-950">{children}</main>
        <footer className="border-t border-ink-800 px-4 py-4 text-center text-xs text-ink-500">
          Built in California by Subodh
        </footer>
        <Toasts />
      </div>
    </div>
  );
}
