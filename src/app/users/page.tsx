"use client";

import { useMemo, useState } from "react";
import { HBar } from "@/components/charts/charts";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar, Badge, Button, Panel, ProgressBar, StatTile } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icons";
import { compact, num, pct, usd } from "@/lib/format";
import { teamUsage } from "@/lib/selectors";
import { useSim } from "@/lib/store";

const ROLE_PERMISSIONS: Record<string, Record<string, boolean>> = {
  admin: { Provision: true, "Manage quotas": true, "Submit jobs": true, "View telemetry": true, "Manage users": true },
  researcher: { Provision: false, "Manage quotas": false, "Submit jobs": true, "View telemetry": true, "Manage users": false },
  "ml-engineer": { Provision: true, "Manage quotas": false, "Submit jobs": true, "View telemetry": true, "Manage users": false },
  viewer: { Provision: false, "Manage quotas": false, "Submit jobs": false, "View telemetry": true, "Manage users": false },
  service: { Provision: false, "Manage quotas": false, "Submit jobs": true, "View telemetry": true, "Manage users": false },
};

export default function UsersPage() {
  const { state, actions } = useSim();
  const [editing, setEditing] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState("all");
  const [query, setQuery] = useState("");

  const usage = useMemo(() => teamUsage(state), [state]);

  const users = useMemo(() => {
    const term = query.toLowerCase();
    return state.users
      .filter((u) => (roleFilter === "all" ? true : u.role === roleFilter))
      .filter((u) => (term ? `${u.name} ${u.email}`.toLowerCase().includes(term) : true))
      .sort((a, b) => b.cost30d - a.cost30d);
  }, [state.users, roleFilter, query]);

  const totalGpuHours = state.teams.reduce((s, t) => s + t.gpuHours30d, 0);
  const totalCost = state.teams.reduce((s, t) => s + t.cost30d, 0);

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-5 lg:p-7">
      <PageHeader
        title="Users & Teams"
        subtitle="Multi-tenant access control, GPU quotas and fairness policies across the fleet."
        actions={<Badge tone="cyan">{state.users.length} identities</Badge>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Users" value={num(state.users.length)} accent="#76b900" icon={<Icon name="users" size={16} />} />
        <StatTile label="Teams" value={num(state.teams.length)} accent="#22d3ee" icon={<Icon name="users" size={16} />} />
        <StatTile label="Active" value={num(state.users.filter((u) => u.status === "active").length)} accent="#10b981" icon={<Icon name="check" size={16} />} />
        <StatTile label="Suspended" value={num(state.users.filter((u) => u.status === "suspended").length)} accent="#ef4444" icon={<Icon name="alert" size={16} />} />
        <StatTile label="GPU-hours (30d)" value={compact(totalGpuHours)} accent="#a855f7" icon={<Icon name="activity" size={16} />} />
        <StatTile label="Cost (30d)" value={usd(totalCost)} accent="#f59e0b" icon={<Icon name="dollar" size={16} />} />
      </div>

      <Panel title="Teams & quotas" subtitle="Reserved capacity and consumption per business unit">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {usage.map((team) => {
            const overQuota = team.quotaUtil > 1;
            return (
              <div key={team.id} className="rounded-xl border border-ink-700/70 bg-ink-900/40 p-4">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-ink-100">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: team.color }} />
                    {team.name}
                  </span>
                  <Badge tone={overQuota ? "red" : "green"}>{overQuota ? "over" : "ok"}</Badge>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[11px]">
                    <span className="text-ink-400">GPU quota</span>
                    <span className="font-mono text-ink-300">
                      {team.activeGpus} / {team.quota.gpuLimit}
                    </span>
                  </div>
                  <ProgressBar value={team.quotaUtil} color={overQuota ? "#ef4444" : team.color} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-ink-400">
                  <span>{compact(team.gpuHours30d)} GPU-h</span>
                  <span className="text-right">{usd(team.cost30d)}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-3 w-full"
                  onClick={() => setEditing(editing === team.id ? null : team.id)}
                >
                  <Icon name="settings" size={13} /> {editing === team.id ? "Close" : "Manage quota"}
                </Button>
                {editing === team.id && (
                  <div className="mt-3 space-y-3 border-t border-ink-700/60 pt-3">
                    <div>
                      <div className="mb-1 flex justify-between text-[11px] text-ink-400">
                        <span>GPU limit</span>
                        <span className="font-mono">{team.quota.gpuLimit}</span>
                      </div>
                      <input
                        type="range"
                        min={16}
                        max={2048}
                        step={16}
                        value={team.quota.gpuLimit}
                        onChange={(e) => actions.setTeamQuota(team.id, { gpuLimit: Number(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-[11px] text-ink-400">
                        <span>Monthly budget</span>
                        <span className="font-mono">{usd(team.quota.costLimitUsd)}</span>
                      </div>
                      <input
                        type="range"
                        min={50_000}
                        max={2_000_000}
                        step={50_000}
                        value={team.quota.costLimitUsd}
                        onChange={(e) => actions.setTeamQuota(team.id, { costLimitUsd: Number(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-[11px] text-ink-400">
                        <span>Storage limit</span>
                        <span className="font-mono">{team.quota.storageLimitTb} TB</span>
                      </div>
                      <input
                        type="range"
                        min={100}
                        max={5000}
                        step={100}
                        value={team.quota.storageLimitTb}
                        onChange={(e) => actions.setTeamQuota(team.id, { storageLimitTb: Number(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <Panel fill title="GPU-hours by team" subtitle="Last 30 days">
          <HBar
            items={usage.map((t) => ({
              label: t.name,
              value: Math.round(t.gpuHours30d),
              color: t.color,
              sub: `${usd(t.cost30d)}`,
            }))}
            unit=" h"
          />
        </Panel>

        <Panel fill className="lg:col-span-2" title="Role-based access control" subtitle="Effective permissions by role">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-ink-700 text-left text-[11px] uppercase tracking-wider text-ink-500">
                  <th className="py-2 pr-4 font-medium">Role</th>
                  {Object.keys(ROLE_PERMISSIONS.admin).map((p) => (
                    <th key={p} className="py-2 pr-4 text-center font-medium">{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(ROLE_PERMISSIONS).map(([role, perms]) => (
                  <tr key={role} className="border-b border-ink-800/60">
                    <td className="py-2 pr-4 font-medium text-ink-200">{role}</td>
                    {Object.entries(perms).map(([perm, allowed]) => (
                      <td key={perm} className="py-2 pr-4 text-center">
                        {allowed ? (
                          <Icon name="check" size={15} className="mx-auto text-nv-400" />
                        ) : (
                          <span className="text-ink-600">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel
        title="Directory"
        subtitle={`${users.length} users`}
        padded={false}
        actions={
          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users…"
              className="rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-1.5 text-xs text-ink-200 outline-none"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-lg border border-ink-700 bg-ink-900/60 px-2 py-1.5 text-xs text-ink-200 outline-none"
            >
              <option value="all">All roles</option>
              {Object.keys(ROLE_PERMISSIONS).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-ink-700 text-left text-[11px] uppercase tracking-wider text-ink-500">
                <th className="px-4 py-2.5 font-medium">User</th>
                <th className="px-4 py-2.5 font-medium">Team</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">GPU-hours (30d)</th>
                <th className="px-4 py-2.5 font-medium">Cost (30d)</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.slice(0, 60).map((u) => {
                const team = state.teams.find((t) => t.id === u.teamId);
                return (
                  <tr key={u.id} className="border-b border-ink-800/60 hover:bg-ink-800/30">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar initials={u.initials} hue={u.hue} />
                        <div>
                          <p className="text-ink-200">{u.name}</p>
                          <p className="text-[11px] text-ink-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {team && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-ink-300">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: team.color }} />
                          {team.name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5"><Badge tone="neutral">{u.role}</Badge></td>
                    <td className="px-4 py-2.5 font-mono text-xs text-ink-300">{compact(u.gpuHours30d)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-ink-300">{usd(u.cost30d)}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={u.status === "active" ? "green" : "red"}>{u.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        size="sm"
                        variant={u.status === "active" ? "ghost" : "primary"}
                        onClick={() => actions.setUserStatus(u.id, u.status === "active" ? "suspended" : "active")}
                      >
                        {u.status === "active" ? "Suspend" : "Activate"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
