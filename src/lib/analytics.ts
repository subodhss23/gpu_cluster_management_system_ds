"use client";

import posthog, { type PostHog } from "posthog-js";

/**
 * PostHog analytics wrapper.
 *
 * - Env-gated: if `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` is absent the SDK is never
 *   loaded and every call becomes a safe no-op, so the app runs unchanged.
 * - Registers an `app` super-property so events from this project are
 *   distinguishable from other apps sharing the same PostHog project.
 * - Respects an opt-out flag stored in localStorage (`aethergrid-analytics-optout`).
 */

const TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;
const OPT_OUT_KEY = "aethergrid-analytics-optout";

/** Identifies this app within a shared PostHog project. */
export const APP_ID = "gpu_management_system_app2_ds";

let client: PostHog | null = null;
let initialised = false;

export function analyticsConfigured(): boolean {
  return Boolean(TOKEN);
}

export function isAnalyticsEnabled(): boolean {
  return Boolean(TOKEN) && !isOptedOut();
}

export function isOptedOut(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(OPT_OUT_KEY) === "true";
  } catch {
    return false;
  }
}

export function initAnalytics(): void {
  if (typeof window === "undefined") return;
  if (!TOKEN) return;
  if (initialised) return;
  initialised = true;

  posthog.init(TOKEN, {
    api_host: HOST,
    defaults: "2026-05-30",
    capture_pageview: false, // we send pageviews manually on route change
    capture_pageleave: true,
    autocapture: true,
    disable_session_recording: true, // keep it lightweight & privacy-first
    loaded: (ph) => {
      ph.register({ app: APP_ID });
      if (isOptedOut()) ph.opt_out_capturing();
    },
  });

  // Register the super-property immediately as well, so autocapture events
  // fired before `loaded` still carry the app identifier.
  posthog.register({ app: APP_ID });

  client = posthog;
}

export function optInAnalytics(): void {
  try {
    window.localStorage.setItem(OPT_OUT_KEY, "false");
  } catch {
    /* ignore */
  }
  client?.opt_in_capturing();
  capture("analytics_opt_in", {});
}

export function optOutAnalytics(): void {
  capture("analytics_opt_out", {});
  try {
    window.localStorage.setItem(OPT_OUT_KEY, "true");
  } catch {
    /* ignore */
  }
  client?.opt_out_capturing();
}

/** Capture a custom event. Safe to call even when analytics is disabled. */
export function capture(event: string, properties: Record<string, unknown> = {}): void {
  if (!client || !isAnalyticsEnabled()) return;
  client.capture(event, {
    app: APP_ID,
    env: process.env.NODE_ENV,
    ...properties,
  });
}

/** Record a virtual pageview for the App Router. */
export function capturePageview(path: string, properties: Record<string, unknown> = {}): void {
  capture("$pageview", { $current_url: path, path, ...properties });
}

/** Associate subsequent events with a user (use an opaque id, never PII). */
export function identify(distinctId: string, properties: Record<string, unknown> = {}): void {
  if (!client || !isAnalyticsEnabled()) return;
  client.identify(distinctId, { app: APP_ID, ...properties });
}

export function resetAnalytics(): void {
  client?.reset();
}

/** Convenience helper for the many "user did X on cluster Y" events. */
export function captureClusterEvent(
  event: string,
  cluster: { id: string; name: string; kind?: string; regionId?: string },
  properties: Record<string, unknown> = {}
): void {
  capture(event, {
    cluster_id: cluster.id,
    cluster_name: cluster.name,
    cluster_kind: cluster.kind,
    region_id: cluster.regionId,
    ...properties,
  });
}
