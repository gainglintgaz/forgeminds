# Vercel cutover runbook (host fix — supersedes railway-cutover.md)

> **Status:** prepared 2026-07-03. Founder decision 2026-07-03: host = **Vercel** (deploy later).
> **This is the single most important open action.** The AI pipeline is NOT firing in production
> (`ai_calls_made=0` on every step; briefs empty since 06-29) because the dispatcher invokes a
> Cloudflare Worker that (a) can't run the heavy AI routes (ERR-026) and (b) runs a pre-06-15 bundle
> with dead keys (ERR-029). No code change fixes this — it is a deploy + secrets + one-UPDATE task,
> and it is **founder-only** (Vercel login + secret values). Everything downstream (S4/S5, the
> substring-validation gate, the S7 dogfood) is blocked until step 6 verifies `ai_calls_made>0`.
> Reference: `docs/reviews/2026-07-03-comprehensive-review.md` §3; `NEXT_SESSION.md` header.

## Why Vercel (verified 2026-07-03)

- **$0** on Hobby; Railway killed its free tier; Cloudflare proven unfit (ERR-026).
- **Next.js-native full Node** — removes the OpenNext translation layer and the whole ERR-026 class.
- **300s function duration** on Hobby (Fluid) — the routes declare `maxDuration=120`, 2.5× headroom.
- **1M invocations/mo free**; the dispatcher is ~6 routes × 60 × 24 × 30 ≈ **260k/mo** — fits. Fluid
  bills only active CPU (~4 CPU-hr/mo free); AI-wait is I/O, not CPU.
- **Cron:** Vercel Hobby caps cron at 1/day — **irrelevant**: pg_cron in Supabase does all scheduling
  via HTTP to `forgeminds_base_url`. The architecture already sidesteps the one Hobby limit that hurts.
- **⚠ The one catch:** Hobby is **non-commercial-use only** (Vercel fair-use). Dogfood + free closed
  alpha = fine. The moment payments/ads go live → **Vercel Pro $20/mo is mandatory.** Budget it as a
  launch-day line item, not a today cost.
- **Fallbacks** if Vercel misbehaves: Fly.io (~$3–5/mo small VM) or Render ($7/mo starter). Do NOT
  revisit Cloudflare for the app tier. Supabase stays the host-independent brain — this decision is
  reversible (that's why the dispatcher reads `forgeminds_base_url` from the DB).

---

## FOUNDER steps (creds / secrets / deploy) — ~60–90 min

1. **Install + login (once):** `npm i -g vercel && vercel login`.
2. **Link + first deploy** from the project root: `vercel` (link the repo), then `vercel --prod`.
   Note the production URL, e.g. `https://forgeminds-<hash>.vercel.app`.
   - Nixpacks/Vercel auto-detects Next.js. Build = `next build` (the repo `build` script is
     `tsc --noEmit && next build`, fine). The `opennextjs-cloudflare` scripts are Cloudflare-only and
     are NOT used by Vercel.
3. **Set Production env vars** (Vercel → Project → Settings → Environment Variables; mark every secret
   **Sensitive**). Required:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public, by design)
   - `SUPABASE_SERVICE_ROLE_KEY` (secret)
   - `CRON_SECRET` — **must EXACTLY equal** the Supabase vault secret the dispatcher signs with
     (`private.app_config` / vault `cron_secret`). A mismatch = every route 401s. This is the #1 gotcha.
   - `ANTHROPIC_API_KEY` — the current live key. **The core loop is Anthropic-only** (Haiku scores,
     Sonnet writes) since `b8ff95d`; **`GEMINI_API_KEY` is NOT needed** (retired).
   - Market data (enrich): `FINNHUB_API_KEY`, `ALPACA_API_KEY`, `ALPACA_SECRET_KEY`, `ALPHA_VANTAGE_KEY`
     (and `BENZINGA_API_KEY` if used).
   - Email: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_TEST_RECIPIENT` (test-mode scaffold until E2).
   - `NEXT_PUBLIC_APP_URL` = the `vercel.app` URL from step 2.
   - Confirm the Anthropic key sits in a workspace with a **spend cap** (BRIEF.md Key Registry).
4. **Redeploy** if env vars were added after the first deploy: `vercel --prod` (env applies on next build).
5. **Smoke test the route + auth:**
   `curl -H "Authorization: Bearer <CRON_SECRET>" https://<vercel-url>/api/cron/score`
   → expect `200` with a JSON body (or an explicit AI error — either proves routing + auth work).
   A `401` means the `CRON_SECRET` doesn't match the Supabase side (fix step 3).
6. **Cut the dispatcher over** (Supabase SQL editor, dev project `ymgbjtgczgnooscigplb`):
   ```sql
   UPDATE private.app_config SET value='https://<vercel-url>' WHERE key='forgeminds_base_url';
   ```
   (Ping the agent with the URL and the agent can run this via MCP instead.)
7. **Watch 2–3 dispatcher ticks** (~2–3 min), then hand off to the agent's verification battery below.
   Leave the Cloudflare Worker up but orphaned; delete its secrets (incl. the retired `GEMINI_API_KEY`)
   after 48h clean.

---

## AGENT steps (after the founder's steps land)

**Verification battery (the proof the fix is live — run against the live DB, lesson #108):**

```sql
-- 1. Telemetry is REAL now (gate 1). Expect ai_calls_made>0 on score AND generate.
select step_name, count(*) runs, sum(ai_calls_made) ai_calls, sum(ai_tokens_used) tokens,
       to_char(max(started_at),'MM-DD HH24:MI') last
from pipeline_runs where started_at > now()-interval '2 hours' group by 1 order by 1;

-- 2. A fresh brief is real Claude output with HTML (not heuristic/NULL).
select brief_date, generation_model, (summary_html is not null) has_html
from briefs order by brief_date desc limit 3;

-- 3. The fail-loud guard is deployed: if a key is wrong, score/generate throw AI_ZERO_CALL.
--    (During the key-swap window, expect to SEE at least one such 'failed' row — proves the
--     instrument catches a known-true failure, lesson #111 — then 'completed' once keys are right.)
select to_char(started_at,'HH24:MI') t, step_name, status,
       left(coalesce(error_message,''),60) err
from pipeline_runs where started_at > now()-interval '2 hours'
  and (status='failed' or error_message ilike '%AI_ZERO_CALL%') order by started_at desc;

-- 4. Strict resolution (gate 2): zero invented UUIDs.
select count(*) bad_category from scored_articles sa
  where sa.category_id is not null
    and not exists (select 1 from categories c where c.id = sa.category_id);

-- 5. The substring-validation gate (d46cac0) is live: persisted briefs carry validation metadata
--    with claims_unvalidated=0. Check a recent generate run's metadata.
select to_char(started_at,'MM-DD HH24:MI') t, metadata->'validation' as validation
from pipeline_runs where step_name='generate' and started_at > now()-interval '2 hours'
order by started_at desc limit 3;
```

Pass = gates 1+2 green for **5 consecutive business days**, with ≥1 provoked `AI_ZERO_CALL` observed
during the key swap. Then: P7 off-platform backup (`docs/ops/` — to be written) → S7 dogfood week.

**Agent also does (post-cutover):** the stale-doc purge (review §6.1–6.6), the S4/S5 slices, the
security/hygiene batch (C-4 `last_fetched_at`, C-7 RLS initplan), cost caps (§5D).

---

## Rollback

The cutover is a single DB value. To revert to the (broken but known) Cloudflare host:
`UPDATE private.app_config SET value='https://forgeminds.vctrbbnv.workers.dev' WHERE key='forgeminds_base_url';`
Supabase is untouched by the host swap; no data risk.
