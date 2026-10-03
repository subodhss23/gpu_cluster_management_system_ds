"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Icon } from "@/components/ui/icons";
import { Badge, Button, KeyValue, Panel, Segmented } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { usePrefs, type Density } from "@/lib/prefs";
import { useSim } from "@/lib/store";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import {
  analyticsConfigured,
  isAnalyticsEnabled,
  isOptedOut,
  optInAnalytics,
  optOutAnalytics,
} from "@/lib/analytics";

export default function SettingsPage() {
  const { state } = useSim();
  const { prefs, setPref, resetPrefs } = usePrefs();
  const [analyticsOn, setAnalyticsOn] = useState(true);

  useEffect(() => {
    setAnalyticsOn(isAnalyticsEnabled());
  }, []);

  function toggleAnalytics(value: boolean) {
    if (value) {
      optInAnalytics();
      setAnalyticsOn(true);
    } else {
      optOutAnalytics();
      setAnalyticsOn(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6 p-5 lg:p-7">
      <PageHeader
        title="Preferences"
        subtitle="Personalize the console. Preferences are stored locally in your browser and survive reloads."
        actions={<ThemeToggle />}
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Panel title="Appearance" subtitle="Theme and layout density">
            <div className="flex flex-col gap-4">
              <Row label="Color theme" hint="Light or dark palette, persisted per browser">
                <ThemeToggle />
              </Row>
              <Row label="Interface density" hint="Compact tightens table rows and grid gaps">
                <Segmented
                  value={prefs.density}
                  onChange={(v) => setPref("density", v as Density)}
                  options={[
                    { label: "Comfortable", value: "comfortable" },
                    { label: "Compact", value: "compact" },
                  ]}
                />
              </Row>
              <Row label="Live toast notifications" hint="Slide-in alerts for scheduler and DCGM events">
                <Toggle value={prefs.showToasts} onChange={(v) => setPref("showToasts", v)} />
              </Row>
            </div>
          </Panel>

          <Panel title="Privacy & analytics" subtitle="Anonymous, privacy-first product analytics via PostHog">
            <div className="flex flex-col gap-4">
              <Row label="Share anonymous usage data" hint="Page views and feature events only — no PII, no session recording">
                <Toggle
                  value={analyticsOn && !isOptedOut()}
                  onChange={toggleAnalytics}
                  disabled={!analyticsConfigured()}
                />
              </Row>
              {!analyticsConfigured() ? (
                <p className="rounded-lg border border-ink-700/60 bg-ink-900/40 p-3 text-[11px] text-ink-500">
                  Analytics is not configured. Set <span className="font-mono text-ink-300">NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN</span>{" "}
                  (and optionally <span className="font-mono text-ink-300">NEXT_PUBLIC_POSTHOG_HOST</span>) to enable it.
                </p>
              ) : (
                <p className="text-[11px] text-ink-500">
                  Disabling analytics immediately opts this browser out and stops all event capture.
                </p>
              )}
            </div>
          </Panel>

          <Panel title="Simulation" subtitle="Telemetry engine controls (also in the top bar)">
            <div className="flex flex-col gap-4">
              <Row label="Playback speed" hint="Higher multipliers tick the engine faster">
                <Segmented
                  size="sm"
                  value={String(state.speed)}
                  onChange={(v) => {
                    try {
                      localStorage.setItem("aethergrid-speed", v);
                    } catch {
                      /* ignore */
                    }
                    window.location.reload();
                  }}
                  options={[
                    { label: "0.5×", value: "0.5" },
                    { label: "1×", value: "1" },
                    { label: "2×", value: "2" },
                    { label: "4×", value: "4" },
                  ]}
                />
              </Row>
              <Row label="Running" hint="Pause or resume the tick loop">
                <Badge tone={state.running ? "green" : "amber"}>{state.running ? "running" : "paused"}</Badge>
              </Row>
              <Row label="Current seed" hint="Reseed from the top bar for a new deterministic fleet">
                <span className="font-mono text-xs text-ink-300">{state.seed}</span>
              </Row>
            </div>
          </Panel>

          <Panel title="Reset" subtitle="Restore defaults">
            <div className="flex items-center justify-between">
              <p className="text-xs text-ink-400">
                Restores density, toasts and region defaults. Theme and speed are kept.
              </p>
              <Button variant="ghost" onClick={resetPrefs}>
                <Icon name="refresh" size={14} /> Reset preferences
              </Button>
            </div>
          </Panel>
        </div>

        <Panel title="About this console" subtitle="AetherGrid">
          <KeyValue label="Clusters">{state.clusters.length}</KeyValue>
          <KeyValue label="Materialized GPUs">
            {state.nodes.filter((n) => n.role === "gpu-worker").reduce((s, n) => s + n.gpus.length, 0)}
          </KeyValue>
          <KeyValue label="Pinned clusters">
            {state.clusters.filter((c) => c.pinned).length}
          </KeyValue>
          <KeyValue label="Storage key">aethergrid-prefs</KeyValue>
          <div className="mt-4 rounded-lg border border-ink-700/60 bg-ink-900/40 p-3 text-[11px] text-ink-500">
            <p className="flex items-center gap-1.5 text-ink-300">
              <Icon name="check" size={13} className="text-nv-400" /> Local-only
            </p>
            <p className="mt-1">No accounts, no network, no telemetry. All data is fictional and generated in-browser.</p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-ink-700/40 pb-4 last:border-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm text-ink-200">{label}</p>
        <p className="text-[11px] text-ink-500">{hint}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({
  value,
  onChange,
  disabled = false,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
        value ? "bg-nv-500" : "bg-ink-600",
        disabled && "cursor-not-allowed opacity-40"
      )}
    >
      <span className={cn("inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform", value ? "translate-x-[18px]" : "translate-x-[3px]")} />
    </button>
  );
}
