# Deploy-readiness audit — cron routes + env contract

> Audited 2026-06-05 (stalled-loop reconcile session). Code-only audit — no
> deploy, no DB writes. Companion to the pg_cron reconcile migration
> `supabase/migrations/20260604000000_reconcile_cron_app_config.sql`.
>
> Context: the automated pipeline has been dead since 2026-05-17 because
> `private.app_config.forgeminds_base_url` points at the placeholder
> `https://forgeminds.app` (unresolvable) and the app is not deployed.
> This doc answers: **when the app IS deployed and base_url repointed,
> will the cron routes work?**

## 1. Route audit — all 6 cron routes

Checks: **(a)** rejects requests where `Authorization != Bearer ${CRON_SECRET}`
with 401; **(b)** resolves `?user_id=` via the shared
`resolveUserId()` (`src/lib/pipeline/user-prefs.ts:98`).

| Route | Auth 401 | ?user_id | Evidence (auth / user_id) | Notes |
|---|---|---|---|---|
| `api/cron/ingest` | ✅ Y | ✅ Y | `route.ts:20-23` / `:30` | maxDuration 120s. Per-user source gating (only invokes fetchers for source types the user has). Writes mandatory `pipeline_runs` audit row; 400 if audit insert fails. |
| `api/cron/score` | ✅ Y | ✅ Y | `route.ts:29-32` / `:37` | maxDuration 120s. Per-user lookback + batch size from prefs. `prompt_version` + cost logged in run metadata. |
| `api/cron/curate` | ✅ Y | ✅ Y | `route.ts:12-15` / `:20` | maxDuration 60s. "Today" computed in user timezone. |
| `api/cron/generate` | ✅ Y | ✅ Y | `route.ts:157-160` / `:165` | maxDuration 120s. Voice DNA style prefix (generate-v0.2). |
| `api/cron/deliver` | ✅ Y | ✅ Y | `route.ts:84-87` / `:102` | maxDuration 60s. Also requires `RESEND_API_KEY` + `RESEND_FROM_EMAIL`; SYSTEM_USER briefs fall back to `RESEND_FROM_EMAIL` as recipient; respects `delivery_email=false` opt-out. |
| `api/cron/enrich` | ✅ Y | ✅ Y | `route.ts:49-52` / `:65` | maxDuration 60s. Additionally 500s if `FINNHUB_API_KEY` unset (checked after auth). |

**Verdict: all 6 routes pass both checks.** Auth is uniform (exact-match
strict inequality on the `authorization` header); user resolution is uniform
(shared helper, `?user_id=` → validated 36-char hex/hyphen string →
fallback `SYSTEM_USER_ID` sentinel for manual curl).

## 2. Findings beyond the two checks (ranked)

| # | Severity | Finding | Detail / suggested fix |
|---|---|---|---|
| F1 | **HIGH (was a deploy blocker)** | `.env.example` named the Gemini var `GOOGLE_AI_API_KEY`, but code reads `GEMINI_API_KEY` (`src/lib/ai/providers/gemini.ts:11`) | Anyone provisioning a host from the example file would deploy with a dead score pipeline ("GEMINI_API_KEY not set"). **Fixed in this commit** — example renamed to `GEMINI_API_KEY`. |
| F2 | MEDIUM | Unset `CRON_SECRET` ⇒ auth compares against the literal `"Bearer undefined"` | All 6 routes use `` authHeader !== `Bearer ${process.env.CRON_SECRET}` ``. If the env var is missing, a request with `Authorization: Bearer undefined` authenticates. Suggested (post-loop work, not this session): explicit `if (!process.env.CRON_SECRET) return 500` guard at the top of each route or in a shared helper. |
| F3 | MEDIUM | Dispatcher HTTP timeout (60s) < route maxDuration (120s) for ingest/score/generate | `private.invoke_forgeminds_cron` posts with `timeout_milliseconds := 60000`. A legitimate 61-119s run completes server-side but the dispatcher records a timeout failure — noisy `cron.job_run_details`, misleading health stats. Suggested: raise pg_net timeout to 120s to match, or accept and document the noise. |
| F4 | LOW | `resolveUserId` regex is loose | `/^[0-9a-f-]{36}$/i` accepts non-UUID-shaped 36-char strings and silently falls back to `SYSTEM_USER_ID` on anything else (no 400). Harmless today (dispatcher always sends real UUIDs); tighten to a structural UUID regex when convenient. |
| F5 | INFO | `api/seed/route.ts` also gates on `CRON_SECRET` | Same auth pattern; same F2 caveat applies. |

## 3. Env contract — server vars required at deploy

`.env.example` now lists every server env var the code reads (verified by
grepping `process.env.*` across `src/`):

| Var | Used by | Required for the loop (Phase 2.1)? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | all Supabase clients | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + SSR clients | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | `createServiceClient` (cron routes) | ✅ |
| `CRON_SECRET` | all 6 cron routes + `api/seed` | ✅ — **must equal Supabase vault `cron_secret` or every cron route 401s** |
| `GEMINI_API_KEY` | score/categorize (`providers/gemini.ts`) | ✅ |
| `XAI_API_KEY` | Grok provider | Only for generate-social tasks |
| `FINNHUB_API_KEY` | enrich route + finnhub fetcher | ✅ for enrich; ingest only if user has finnhub source |
| `ALPACA_API_KEY` / `ALPACA_SECRET_KEY` | alpaca fetcher | Only if a user has an alpaca source |
| `ALPHA_VANTAGE_KEY` | alpha-vantage fetcher | Only if a user has an alpha_vantage source |
| `BENZINGA_API_KEY` | benzinga fetcher | Only if a user has a benzinga source |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | deliver route | ✅ for deliver |
| `NEXT_PUBLIC_APP_URL` | deliver email links, OAuth redirects | ✅ |
| `ANTHROPIC_API_KEY` | Claude provider (generate/deep-research) | ✅ for generate |
| `OPENAI_API_KEY` | embeddings only | Source-catalog search |
| `PERPLEXITY_API_KEY` | research tasks | Optional Phase 2 |
| Model overrides (`GROK_MODEL`, `GEMINI_MODEL`, `CLAUDE_SONNET_MODEL`, `CLAUDE_HAIKU_MODEL`, `PERPLEXITY_MODEL`, `PERPLEXITY_PRO_MODEL`) | `src/lib/ai/models.ts` | Optional — emergency rollback knobs, no defaults needed |

## 4. Deploy-day sequence (for the separate, interactive deploy fix)

1. Deploy app (Vercel) with the env vars above; verify `GET /` 200.
2. Confirm host `CRON_SECRET` == vault `cron_secret`
   (`select name from vault.decrypted_secrets where name='cron_secret'` — value compare done locally, never in logs).
3. Repoint `private.app_config.forgeminds_base_url` to the real deployment URL (founder-flagged DB write — NOT done by this session).
4. Smoke one manual tick: `curl -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/cron/ingest"` → expect 200 JSON, then SELECT the `pipeline_runs` row.
5. Watch `public.forgeminds_pg_cron_stats(10)` until all 6 jobs show recent `succeeded` runs.
