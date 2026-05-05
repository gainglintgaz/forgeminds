/**
 * onboarding.spec.ts — Phase 1.5 wizard skeleton smoke tests
 *
 * Goals:
 *   - /onboarding/intake renders the textarea + submit button (auth-gated;
 *     unauthenticated users redirect to /login).
 *   - /api/onboarding/validate-source rejects unauthenticated requests
 *     and known-bad inputs (empty body, malformed URL).
 *
 * NOT in scope for this skeleton:
 *   - Full conversation flow (intake → refine → confirm) — needs catalog
 *     seed + signed-in test user.
 *   - Real LLM round-trip — would burn tokens on every CI run.
 *
 * Both tests are designed to PASS even when the catalog is empty (Phase
 * 1.5 close dependency) — they only verify the skeleton routes exist
 * and apply auth correctly.
 */

import { test, expect } from "@playwright/test";

test("GET /onboarding/intake unauthenticated → redirects to /login", async ({
  page,
}) => {
  // No session cookies in this fresh context. The layout's auth gate
  // should redirect.
  const response = await page.goto("/onboarding/intake");
  // Either the redirect happens server-side (status 200 on /login) or
  // client-side after a brief render. We check the final URL.
  expect(page.url()).toMatch(/\/login(\?.*)?$/);
  // If a response object was returned, ensure it wasn't a 5xx.
  if (response) {
    expect(response.status()).toBeLessThan(500);
  }
});

test("POST /api/onboarding/validate-source unauthenticated → 401", async ({
  request,
}) => {
  const res = await request.post("/api/onboarding/validate-source", {
    data: { url: "https://example.com/feed.rss" },
  });
  expect(res.status(), "must reject anonymous").toBe(401);
});

test("POST /api/onboarding/chat unauthenticated → 401", async ({ request }) => {
  const res = await request.post("/api/onboarding/chat", {
    data: { description: "I want news about biotech." },
  });
  expect(res.status(), "must reject anonymous").toBe(401);
});

test("POST /api/onboarding/finalize unauthenticated → 401", async ({
  request,
}) => {
  const res = await request.post("/api/onboarding/finalize", {
    data: { acceptedCatalogIds: ["bogus-id"] },
  });
  expect(res.status(), "must reject anonymous").toBe(401);
});
