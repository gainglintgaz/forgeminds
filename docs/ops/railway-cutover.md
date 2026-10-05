# Railway cutover runbook (S3.1 / Appendix B S6)

> **🔴 SUPERSEDED 2026-07-03 — DO NOT USE.** The host decision changed to **Vercel** (Railway
> discontinued its free tier). Follow **`docs/ops/vercel-cutover.md`** instead. This file is kept
> for history only. See `DECISIONS.md` (2026-07-03 host entry) + review §3.1.

> **Status:** prepared 2026-06-15. The code hardening that makes the pipeline robust on ANY host is
> DONE + verified (batch score, stale-run sweep, curate consistency invariant). **The actual Railway
> deploy + secret-setting + dispatcher cutover below is a founder action** — it needs your Railway
> account, the real secret values, and a one-time DB flip. PS Claude cannot perform it from the build
> environment (no Railway credentials; secrets are never handled by the agent).

## Why
The pg_cron dispatcher invokes `forgeminds_base_url` = `https://forgeminds.vctrbbnv.workers.dev`
(Cloudflare Workers). Heavy AI routes (score/generate) get killed mid-run by the Workers CPU/chunk
limit (ERR-026) → the run dangles in `status='running'` → enrich/generate no-op. Root fix: host the
Next.js app as a **standard Node container on Railway**; keep Supabase as the host-independent brain.

## Steps (founder)
1. **Create a Railway project** from this repo (Railway → New → Deploy from GitHub repo).
2. **Build/start:** Railway/Nixpacks auto-detects Next.js. Confirm build = `next build`, start =
   `next start` (Next binds `$PORT` automatically). NOTE: the repo's `build` script is
   `tsc --noEmit && next build` (fine). The `opennextjs-cloudflare` scripts are Cloudflare-only and
   are NOT used by Railway. If the build fails on the OpenNext adapter, verify `next.config` has no
   hard Cloudflare-only `output` requirement (standard `next start` is the target).
3. **Set env vars** on Railway (Variables tab) — names only, paste YOUR values; **no `NEXT_PUBLIC_`
   secrets**:
   `CRON_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY`, `ANTHROPIC_API_KEY`,
   `FINNHUB_API_KEY`, `ALPACA_API_KEY`, `ALPACA_SECRET_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
   (+ `RESEND_TEST_RECIPIENT` while in test mode). `CRON_SECRET` must equal the one in the Supabase
   vault (`select decrypted_secret from vault.decrypted_secrets where name='cron_secret'`).
4. **Deploy**; note the public URL, e.g. `https://forgeminds-production.up.railway.app`.
5. **Smoke-test each cron route returns 200** (use your real CRON_SECRET):
   ```bash
   for s in ingest score curate enrich generate deliver; do
     curl -s -o /dev/null -w "$s %{http_code}\n" \
       -H "Authorization: Bearer $CRON_SECRET" \
       "https://<railway-url>/api/cron/$s?user_id=3707759d-9863-4f69-a6d8-f40036fa15f1"
   done
   ```
6. **Flip the dispatcher** to Railway (one DB statement — the dispatcher reads this on its next tick):
   ```sql
   UPDATE private.app_config SET value = 'https://<railway-url>' WHERE key = 'forgeminds_base_url';
   ```
7. **Verify an UNATTENDED cycle** (wait ~one cadence, then):
   ```sql
   SELECT step_name, status, items_processed, ai_calls_made, ai_tokens_used
   FROM pipeline_runs WHERE started_at > now() - interval '15 min' ORDER BY started_at DESC;
   ```
   Expect: score `completed` (not `running`), `ai_calls_made > 0`; enrich + generate ran; no dangling
   `running` rows. The new `forgeminds_sweep_stale_runs` pg_cron job marks any stale `running` row
   `failed` within ~10 min as a safety net regardless.

## Rollback
`UPDATE private.app_config SET value = 'https://forgeminds.vctrbbnv.workers.dev' WHERE key='forgeminds_base_url';`
(Pipedream stays ON throughout — zero-risk cutover.)

## Now-due follow-up — P7 off-platform backup (architecture §6)
Once on the new host (real users imminent), the single-Supabase-project, no-off-platform-backup gap
(`data-protection.md` §2.2) is due: add a daily `pg_dump` to a different vendor (B2/S3/GCS) before the
first external pilot user. Tracked in PENDING_APPROVALS.
