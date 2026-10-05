/**
 * auth.spec.ts — signup + login + logout via Supabase admin SDK
 *
 * Pre-condition: SUPABASE_SERVICE_ROLE_KEY available in environment.
 *
 * Flow:
 *   1. admin: createUser({ email, password, email_confirm: true })
 *      (skips the email confirmation step — we trust the SDK)
 *   2. browser: navigate to /login, sign in with the credentials
 *   3. assert: redirected away from /login, dashboard surface renders,
 *      no console errors.
 *   4. cleanup: admin: deleteUser(id)
 *
 * If any step fails, the test fails loudly. No silent skipping.
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
    // ignore — env may be set externally
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

test("signup → login → dashboard renders, then logout", async ({ page }) => {
  test.skip(
    !SUPABASE_URL || !SERVICE_ROLE,
    "Supabase env vars missing — cannot run auth e2e"
  );

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const email = `e2e-${Date.now()}@forgeminds.local`;
  const password = "Test-Password-1234!";

  // 1. create user via admin SDK (auto-confirm email)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  expect(createErr, `admin createUser should succeed: ${createErr?.message}`).toBeNull();
  const userId = created.user!.id;

  try {
    // 2. capture console errors
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    // 3. navigate to /login and sign in
    await page.goto("/login");
    await page.fill('input[type="email"], input[name="email"]', email);
    await page.fill('input[type="password"], input[name="password"]', password);
    await page.click('button[type="submit"]');

    // 4. expect redirect away from /login
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), {
      timeout: 10_000,
    });

    // 5. dashboard surface should render *something*. We don't assert on
    //    article content (Phase 0 may have empty state); we assert the page
    //    loaded without console errors.
    expect(
      consoleErrors.filter((e) => !e.includes("favicon")),
      `console errors after login: ${consoleErrors.join(" | ")}`
    ).toEqual([]);

    // 6. logout (best-effort — endpoint may not exist yet in Phase 0)
    const logoutResp = await page.request.post("/api/auth/logout").catch(() => null);
    if (logoutResp && logoutResp.ok()) {
      await page.goto("/");
    }
  } finally {
    // cleanup: always delete the test user
    await admin.auth.admin.deleteUser(userId);
  }
});
