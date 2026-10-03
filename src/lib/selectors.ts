import type { Cluster, ClusterNode, Job, SimState } from "./types";

export function regionById(state: SimState, regionId: string) {
  return state.regions.find((r) => r.id === regionId);
}

export function clusterById(state: SimState, clusterId: string) {
  return state.clusters.find((c) => c.id === clusterId);
}

export function nodesForCluster(state: SimState, clusterId: string): ClusterNode[] {
  return state.nodes.filter((n) => n.clusterId === clusterId);
}

export function jobsForCluster(state: SimState, clusterId: string): Job[] {
  return state.jobs.filter((j) => j.clusterId === clusterId);
}

export interface FleetKpis {
  regions: number;
  clusters: number;
  gpuNodes: number;
  totalGpus: number;
  allocatedGpus: number;
  gpuUtilization: number;
  avgMemUtilization: number;
  runningJobs: number;
  pendingJobs: number;
  activeAlerts: number;
  criticalAlerts: number;
  totalPowerKw: number;
  costPerHour: number;
  healthyClusters: number;
  degradedClusters: number;
  provisioningClusters: number;
}

export function fleetKpis(state: SimState): FleetKpis {
  const totalGpus = state.clusters.reduce((s, c) => s + c.gpuCount, 0);
  const allocatedGpus = state.clusters.reduce((s, c) => s + c.gpuCount * c.utilization, 0);
  const gpuUtilization = totalGpus ? allocatedGpus / totalGpus : 0;
  const avgMemUtilization =
    state.clusters.reduce((s, c) => s + c.memUtilization, 0) / Math.max(1, state.clusters.length);
  const activeAlerts = state.alerts.filter((a) => a.state === "active");
  return {
    regions: state.regions.length,
    clusters: state.clusters.length,
    gpuNodes: state.nodes.filter((n) => n.role === "gpu-worker").length,
    totalGpus,
    allocatedGpus: Math.round(allocatedGpus),
    gpuUtilization,
    avgMemUtilization,
    runningJobs: state.jobs.filter((j) => j.state === "running").length,
    pendingJobs: state.jobs.filter((j) => j.state === "pending").length,
    activeAlerts: activeAlerts.length,
    criticalAlerts: activeAlerts.filter((a) => a.severity === "critical").length,
    totalPowerKw: state.clusters.reduce((s, c) => s + c.powerKw * (0.55 + c.utilization * 0.45), 0),
    costPerHour: state.clusters.reduce((s, c) => s + c.costPerHour, 0),
    healthyClusters: state.clusters.filter((c) => c.status === "ready" && c.health === "healthy").length,
    degradedClusters: state.clusters.filter((c) => c.status === "degraded" || c.health === "warning" || c.health === "critical").length,
    provisioningClusters: state.clusters.filter((c) => c.status === "provisioning").length,
  };
}

export function clusterAggregate(state: SimState, cluster: Cluster) {
  const nodes = nodesForCluster(state, cluster.id);
  const jobs = jobsForCluster(state, cluster.id);
  const alerts = state.alerts.filter((a) => a.clusterId === cluster.id && a.state !== "resolved");
  return {
    nodes,
    jobs,
    alerts,
    running: jobs.filter((j) => j.state === "running").length,
    pending: jobs.filter((j) => j.state === "pending").length,
    failed: jobs.filter((j) => j.state === "failed").length,
    gpuNodes: nodes.filter((n) => n.role === "gpu-worker").length,
    criticalNodes: nodes.filter((n) => n.status === "critical").length,
  };
}

export function regionClusters(state: SimState, regionId: string) {
  return state.clusters.filter((c) => c.regionId === regionId);
}

export function regionKpis(state: SimState, regionId: string) {
  const clusters = regionClusters(state, regionId);
  const totalGpus = clusters.reduce((s, c) => s + c.gpuCount, 0);
  const powerKw = clusters.reduce((s, c) => s + c.powerKw * (0.55 + c.utilization * 0.45), 0);
  return {
    clusters,
    totalGpus,
    utilization: clusters.length
      ? clusters.reduce((s, c) => s + c.utilization * c.gpuCount, 0) / Math.max(1, totalGpus)
      : 0,
    powerKw,
    alerts: state.alerts.filter((a) => clusters.some((c) => c.id === a.clusterId) && a.state === "active").length,
  };
}

export function teamById(state: SimState, teamId: string) {
  return state.teams.find((t) => t.id === teamId);
}

export function userById(state: SimState, userId: string) {
  return state.users.find((u) => u.id === userId);
}

export function topJobs(state: SimState, n = 8) {
  return [...state.jobs]
    .filter((j) => j.state === "running")
    .sort((a, b) => b.gpusRequested * (b.priority === "urgent" ? 3 : b.priority === "high" ? 2 : 1) - a.gpusRequested * (a.priority === "urgent" ? 3 : a.priority === "high" ? 2 : 1))
    .slice(0, n);
}

export function teamUsage(state: SimState) {
  return state.teams
    .map((team) => {
      const activeGpus = state.jobs
        .filter((j) => j.teamId === team.id && (j.state === "running" || j.state === "pending"))
        .reduce((s, j) => s + j.gpusRequested, 0);
      return {
        ...team,
        activeGpus,
        quotaUtil: activeGpus / Math.max(1, team.quota.gpuLimit),
      };
    })
    .sort((a, b) => b.cost30d - a.cost30d);
}

export function alertsSorted(state: SimState, clusterId?: string) {
  return state.alerts
    .filter((a) => (clusterId ? a.clusterId === clusterId : true))
    .sort((a, b) => {
      const order = { active: 0, acknowledged: 1, resolved: 2 };
      const sev = { critical: 0, warning: 1, info: 2 };
      if (order[a.state] !== order[b.state]) return order[a.state] - order[b.state];
      if (sev[a.severity] !== sev[b.severity]) return sev[a.severity] - sev[b.severity];
      return b.raisedAt - a.raisedAt;
    });
}
