"use client";

import Link from "next/link";
import { useState } from "react";
import { SeverityBadge } from "@/components/ui/domain";
import { Icon } from "@/components/ui/icons";
import { Badge, Button, EmptyState, ProgressBar } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { relTime } from "@/lib/format";
import { alertProgress } from "@/lib/runbooks";
import { useSim } from "@/lib/store";
import type { Alert } from "@/lib/types";
import { RemediationPanel } from "./RemediationPanel";

export function AlertList({
  alerts,
  showCluster = false,
}: {
  alerts: Alert[];
  showCluster?: boolean;
}) {
  const { state, actions } = useSim();
  const [openId, setOpenId] = useState<string | null>(null);
  const openAlert = alerts.find((a) => a.id === openId) ?? null;

  if (alerts.length === 0) {
    return <EmptyState title="No alerts" hint="The fleet is nominal. New events will appear here in real time." />;
  }

  return (
    <>
      <div className="flex flex-col divide-y divide-ink-800/60">
        {alerts.map((a) => {
          const cluster = state.clusters.find((c) => c.id === a.clusterId);
          const node = a.nodeId ? state.nodes.find((n) => n.id === a.nodeId) : undefined;
          const progress = alertProgress(a);
          const resolved = a.state === "resolved";
          return (
            <div
              key={a.id}
              className={cn(
                "flex flex-col gap-2 py-3 sm:flex-row sm:items-start",
                resolved && "opacity-60"
              )}
            >
              <div className="flex items-center gap-3 sm:w-56 sm:shrink-0">
                <SeverityBadge severity={a.severity} />
                <span className="font-mono text-xs text-ink-300">{a.code}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-200">{a.title}</p>
                <p className="mt-0.5 text-xs text-ink-500">{a.detail}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-500">
                  <span className="rounded bg-ink-800 px-1.5 py-0.5">{a.source}</span>
                  {showCluster && cluster && (
                    <Link href={`/clusters/${cluster.id}/alerts`} className="text-nv-300 hover:underline">
                      {cluster.name}
                    </Link>
                  )}
                  {node && <span className="font-mono">{node.hostname}</span>}
                  {a.gpuIndex !== undefined && <span className="font-mono">GPU {a.gpuIndex}</span>}
                  {a.metric && a.value !== undefined && (
                    <span className="font-mono">
                      {a.metric}={a.value}
                    </span>
                  )}
                  <span>· {relTime(a.raisedAt)}</span>
                </div>
                {a.remediationSteps.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="w-28">
                      <ProgressBar value={progress} color={resolved ? "#76b900" : "#22d3ee"} />
                    </div>
                    <span className="text-[10px] text-ink-500">
                      runbook {a.remediatedSteps}/{a.remediationSteps.length}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={resolved ? "green" : a.state === "acknowledged" ? "cyan" : "amber"}>{a.state}</Badge>
                <Button size="sm" variant="primary" onClick={() => setOpenId(a.id)}>
                  <Icon name="settings" size={13} /> {resolved ? "View" : "Fix"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {openAlert && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpenId(null)} />
          <div className="relative z-10 h-full w-full max-w-lg overflow-y-auto border-l border-ink-700 bg-ink-900 p-5 shadow-panel">
            <RemediationPanel alert={openAlert} onDone={() => setOpenId(null)} />
          </div>
        </div>
      )}
    </>
  );
}
