/**
 * dashboard.spec.ts — authenticated dashboard renders without errors
 *
 * Confirms the dashboard route loads after login and emits no console errors.
 * In Phase 0 the dashboard may show an empty state — that's fine. What we
 * forbid is white-screen, runtime errors, or 500 responses.
 */

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (key && value && !process.env[key]) process.env[key] = value;
    }
  } catch {
    // ignore
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

test("dashboard loads after login with zero console errors", async ({ page }) => {
  test.skip(!SUPABASE_URL || !SERVICE_ROLE, "Supabase env vars missing");

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const email = `e2e-dash-${Date.now()}@forgeminds.local`;
  const password = "Test-Password-1234!";

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  expect(createErr).toBeNull();
  const userId = created.user!.id;

  try {
    const errors: string[] = [];
    const failed: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 500) failed.push(`${r.status()} ${r.url()}`);
    });

    // log in
    await page.goto("/login");
    await page.fill('input[type="email"], input[name="email"]', email);
    await page.fill('input[type="password"], input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 10_000 });

    // give the dashboard a moment to settle
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    expect(failed, `5xx responses: ${failed.join(" | ")}`).toEqual([]);
    expect(
      errors.filter((e) => !e.includes("favicon")),
      `console errors: ${errors.join(" | ")}`
    ).toEqual([]);
  } finally {
    await admin.auth.admin.deleteUser(userId);
  }
});
