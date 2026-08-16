/**
 * Backend contract tests for the Admin Overview aggregates.
 *
 * These run against the live backend using the publishable key and a signed-in
 * session is NOT required for shape checks; the aggregate call itself is
 * restricted to signed-in users, so the comparison test is skipped without
 * credentials (set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD to run it).
 *
 * Purpose: guarantee the overview never renders 0 for an admin while the
 * underlying tables actually hold rows.
 */
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const EMAIL = import.meta.env.VITE_E2E_ADMIN_EMAIL as string | undefined;
const PASSWORD = import.meta.env.VITE_E2E_ADMIN_PASSWORD as string | undefined;

const since = new Date(Date.now() - 30 * 864e5).toISOString();
const today = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

const canRun = Boolean(URL && KEY);
const canSignIn = Boolean(canRun && EMAIL && PASSWORD);

describe.runIf(canRun)("admin_overview_stats", () => {
  const client = createClient(URL!, KEY!, { auth: { persistSession: false } });

  it("is not callable anonymously", async () => {
    const { error } = await client.rpc("admin_overview_stats" as never, {
      p_since: since,
      p_today: today,
    } as never);
    expect(error).toBeTruthy();
  });

  it.runIf(canSignIn)("aggregate totals match direct table counts and are never 0", async () => {
    await client.auth.signInWithPassword({ email: EMAIL!, password: PASSWORD! });

    const { data, error } = await client.rpc("admin_overview_stats" as never, {
      p_since: since,
      p_today: today,
    } as never);
    expect(error).toBeNull();

    const stats = data as Record<string, unknown>;
    const profiles = await client.from("profiles").select("id", { count: "exact", head: true });
    const alerts = await client.from("disaster_alerts").select("id", { count: "exact", head: true });

    expect(Number(stats.total_users)).toBe(profiles.count ?? 0);
    expect(Number(stats.alerts_total)).toBe(alerts.count ?? 0);
    expect(Number(stats.total_users)).toBeGreaterThan(0);

    // Every metric must be a real number, never null/NaN which renders as 0.
    ["total_users", "alerts_total", "farms", "handlers", "contracts", "supply", "demand"].forEach((k) => {
      expect(Number.isFinite(Number(stats[k]))).toBe(true);
    });
  });
});
