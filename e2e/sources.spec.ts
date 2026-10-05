/**
 * sources.spec.ts — add an RSS source, verify it lands in DB
 *
 * Full UI → DB round-trip:
 *   1. Login as a fresh test user
 *   2. Navigate to /sources
 *   3. Click "Add RSS Feed" and submit a valid URL
 *   4. Wait for success indicator
 *   5. Query the `sources` table directly via service role and confirm
 *      the row exists with `is_active = true`
 *   6. Cleanup the row + delete the user
 *
 * This is the test that would have caught the Phase 0 column-name failure:
 * if the route inserts using `enabled` instead of `is_active`, the DB row
 * either fails to insert (NOT NULL constraint) or the SELECT in step 5
 * filters wrongly. Either way: red.
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

test("user adds an RSS source and the row appears in DB with is_active=true", async ({
  page,
}) => {
  test.skip(!SUPABASE_URL || !SERVICE_ROLE, "Supabase env vars missing");

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const email = `e2e-src-${Date.now()}@forgeminds.local`;
  const password = "Test-Password-1234!";
  const testFeedUrl = `https://example.com/feed-${Date.now()}.xml`;
  const testFeedName = `E2E Feed ${Date.now()}`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  expect(createErr).toBeNull();
  const userId = created.user!.id;

  try {
    // login
    await page.goto("/login");
    await page.fill('input[type="email"], input[name="email"]', email);
    await page.fill('input[type="password"], input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 10_000 });

    // navigate to sources
    await page.goto("/sources");

    // add an RSS feed (selectors are best-effort — adjust as UI evolves)
    const addBtn = page.getByRole("button", { name: /add (rss|source|feed)/i }).first();
    if (!(await addBtn.isVisible().catch(() => false))) {
      test.fail(true, "Add RSS Feed button not visible — UI not ready");
      return;
    }
    await addBtn.click();
    await page.fill('input[name="name"], input[placeholder*="name" i]', testFeedName);
    await page.fill('input[name="url"], input[placeholder*="url" i]', testFeedUrl);
    await page.click('button[type="submit"]');

    // wait for either toast or list re-render
    await page.waitForTimeout(1500);

    // verify in DB
    const { data: rows, error: qErr } = await admin
      .from("sources")
      .select("id, user_id, name, url, is_active, type")
      .eq("url", testFeedUrl);
    expect(qErr, `select error: ${qErr?.message}`).toBeNull();
    expect(rows, "sources row should exist after add").toHaveLength(1);
    const row = rows![0];
    expect(row.user_id).toBe(userId);
    expect(row.is_active).toBe(true);
    expect(row.name).toBe(testFeedName);
  } finally {
    // cleanup
    await admin.from("sources").delete().eq("url", testFeedUrl);
    await admin.auth.admin.deleteUser(userId);
  }
});
