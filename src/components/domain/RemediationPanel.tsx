"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { relTime } from "@/lib/format";
import { runbookForCode } from "@/lib/runbooks";
import { useSim } from "@/lib/store";
import type { Alert } from "@/lib/types";
import { Icon } from "@/components/ui/icons";
import { Badge, Button, ProgressBar } from "@/components/ui/primitives";
import { SeverityBadge } from "@/components/ui/domain";

export function RemediationPanel({ alert, onDone }: { alert: Alert; onDone?: () => void }) {
  const { state, actions } = useSim();
  const runbook = useMemo(() => runbookForCode(alert.code), [alert.code]);
  const cluster = state.clusters.find((c) => c.id === alert.clusterId);
  const node = alert.nodeId ? state.nodes.find((n) => n.id === alert.nodeId) : undefined;
  const total = Math.max(1, alert.remediationSteps.length);
  const done = alert.remediatedSteps;
  const progress = done / total;
  const resolved = alert.state === "resolved";

  const nextStepIndex = runbook.steps.findIndex((_, i) => i === done);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={alert.severity} />
            <span className="font-mono text-xs text-ink-300">{alert.code}</span>
            <Badge tone={resolved ? "green" : alert.state === "acknowledged" ? "cyan" : "amber"}>{alert.state}</Badge>
          </div>
          <h3 className="mt-2 text-sm font-semibold text-ink-100">{runbook.title}</h3>
          <p className="mt-0.5 text-xs text-ink-500">
            {cluster?.name} {node ? `· ${node.hostname}` : ""} {alert.gpuIndex !== undefined ? `· GPU ${alert.gpuIndex}` : ""} ·{" "}
            {relTime(alert.raisedAt)}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={onDone}>
          <Icon name="close" size={14} />
        </Button>
      </div>

      <div className="rounded-lg border border-ink-700/70 bg-ink-900/50 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">Root cause analysis</p>
        <p className="mt-1 text-xs text-ink-300">{runbook.rootCause}</p>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-[11px]">
          <span className="text-ink-400">Remediation progress</span>
          <span className="font-mono text-ink-300">{done}/{total} steps · {Math.round(progress * 100)}%</span>
        </div>
        <ProgressBar value={progress} color={resolved ? "#76b900" : "#22d3ee"} />
      </div>

      <ol className="flex flex-col gap-2">
        {runbook.steps.map((step, i) => {
          const isDone = i < done;
          const isNext = i === nextStepIndex && !resolved;
          const blocked = !isDone && !isNext;
          return (
            <li
              key={step.id}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 transition",
                isDone
                  ? "border-nv-500/40 bg-nv-500/5"
                  : isNext
                    ? "border-vol-teal/50 bg-vol-teal/5"
                    : "border-ink-700/60 bg-ink-900/30 opacity-70"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                  isDone
                    ? "border-nv-500 bg-nv-500 text-ink-950"
                    : isNext
                      ? "border-vol-teal text-vol-teal"
                      : "border-ink-600 text-ink-500"
                )}
              >
                {isDone ? "✓" : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm", isDone ? "text-ink-300 line-through" : "text-ink-100")}>
                  {step.label}
                  {step.requiresNode && (
                    <span className="ml-2 rounded bg-ink-800 px-1.5 py-0.5 text-[9px] uppercase text-ink-400">node</span>
                  )}
                </p>
                <p className="mt-0.5 text-[11px] text-ink-500">{step.detail}</p>
                <p className="mt-1 text-[10px] text-vol-teal/80">Effect: {step.effect}</p>
              </div>
              <div className="shrink-0">
                {isDone ? (
                  <span className="text-[11px] text-nv-300">applied</span>
                ) : isNext ? (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      actions.applyRemediationStep(alert.id, i);
                      if (i === runbook.steps.length - 1) onDone?.();
                    }}
                  >
                    <Icon name="bolt" size={13} /> Apply
                  </Button>
                ) : (
                  <span className="text-[11px] text-ink-600">locked</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex items-center justify-between border-t border-ink-700/50 pt-3">
        {resolved ? (
          <p className="flex items-center gap-1.5 text-xs text-nv-300">
            <Icon name="check" size={14} /> Issue resolved — telemetry returned to nominal.
          </p>
        ) : (
          <p className="text-xs text-ink-500">Apply each step in order, or let automation handle it.</p>
        )}
        <Button
          size="sm"
          variant="default"
          disabled={resolved}
          onClick={() => {
            actions.autoRemediate(alert.id);
            onDone?.();
          }}
        >
          <Icon name="rocket" size={13} /> Auto-remediate all
        </Button>
      </div>
    </div>
  );
}
