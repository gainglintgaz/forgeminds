/**
 * health.spec.ts — /api/health smoke test
 *
 * The simplest possible end-to-end gate: hit the health endpoint, confirm 200
 * + `ok: true`. If this fails the entire app is down, no point running other
 * tests.
 */

import { test, expect } from "@playwright/test";

test("GET /api/health returns 200 with ok:true", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status(), "health endpoint should return 200").toBe(200);
  const body = await res.json();
  expect(body.ok, "health endpoint must return ok:true").toBe(true);
});
