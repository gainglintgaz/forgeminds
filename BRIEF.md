# Project Brief — ForgeMinds

## Overview
- **Project Name:** ForgeMinds
- **Type:** SaaS — Personal Intelligence OS
- **One-sentence goal:** Collect, score, and curate news, connect it to your life/work context, help you act on it, and get smarter over time.
- **Target users:** Consultants, content creators, investors, knowledge workers
- **Spec:** ../../docs/superpowers/specs/2026-04-13-forgeminds-design.md

## Current Phase
Plan 1: Foundation + Pipeline (replaces Pipedream $30/mo)

## Stack
- Next.js 16 App Router + Tailwind + shadcn/ui
- Supabase PostgreSQL + pgvector + pg_trgm + pg_cron
- Vercel Functions (Fluid Compute)
- Multi-model AI: Gemini Flash, Grok, Claude Haiku, OpenAI, Perplexity
- Supabase Auth + Stripe

---

## Key Registry (NAMES + locations ONLY — never values) — updated 2026-07-01

> Per `SECRETS_INCIDENT_RUNBOOK.md` §8. The **"Used where"** column is the one that prevents downtime: before rotating any key, read its row to know every place to update *first* (create-new → place → verify → revoke-old). Values live ONLY in Proton Pass + `.env.local` (local, git-ignored) + the host env — never in this file, never in git, never in a chat.
> Host env = **Railway (target, cutover pending)**; **Cloudflare Worker secrets (current)** until the cutover.

### Active — required for the current pipeline
| Key name | Provider | Secret? | Used where (env locations) | Created | Rotate by |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | public | `.env.local`, host env, browser | — | n/a (URL) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | **public** | `.env.local`, host env, browser | pre-existing | n/a (RLS-gated; not rotated — clean) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | **secret** | `.env.local`, host env (server only) | pre-existing | not rotated (clean; dev) |
| `CRON_SECRET` | internal (self-generated) | **secret** | host env **+** Supabase vault `cron_secret` (must match) | pre-existing | set in Railway at cutover |
| `GEMINI_API_KEY` | Google AI Studio (GCP `premium-highway-391317`) | **secret** | `.env.local`, host env | 2026-07-01 | 2026-09-29 |
| `ANTHROPIC_API_KEY` | Anthropic | **secret** | `.env.local`, host env | 2026-07-01 | 2026-09-29 |
| `FINNHUB_API_KEY` | Finnhub | **secret** | `.env.local`, host env | pre-existing | next quarterly |
| `ALPACA_API_KEY` / `ALPACA_SECRET_KEY` | Alpaca | **secret** | `.env.local`, host env | pre-existing | next quarterly |
| `ALPHA_VANTAGE_KEY` | Alpha Vantage | **secret** | `.env.local`, host env | pre-existing | next quarterly |
| `RESEND_API_KEY` | Resend | **secret** | `.env.local`, host env | pre-existing | ⚠️ shared with FinKeel — replace at Email-E2 (PENDING_APPROVALS §7.1) |

### Config (not secrets — no dashboard rotation)
`RESEND_FROM_EMAIL` · `RESEND_TEST_RECIPIENT` · `NEXT_PUBLIC_APP_URL` · model overrides (`GROK_MODEL`, `GEMINI_MODEL`, `CLAUDE_SONNET_MODEL`, `CLAUDE_HAIKU_MODEL`, `PERPLEXITY_MODEL`).

### Tooling (NOT the app — MCP/CLI only, never in `.env.local`)
| Token | Provider | Used where | Notes |
|---|---|---|---|
| Supabase account access token (`cli_HPHOME12…`) | Supabase | Supabase MCP config / CLI `SUPABASE_ACCESS_TOKEN` | live (used 2026-07-01); expires Never → 90-day rotation reminder. `finkeel-cli-mcp-2026-06` = stale cross-project leftover → revoke. |

### Deferred — NOT recreated (recreate only when the phase lights up)
| Key name | Provider | Needed for | Phase |
|---|---|---|---|
| `OPENAI_API_KEY` | OpenAI | embeddings (deep research / dot-connector) | P2 |
| `PERPLEXITY_API_KEY` | Perplexity | live web research | P2 |
| `XAI_API_KEY` | xAI (Grok) | social posts / action engine | P3 |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | Reddit | OAuth source import | P1.5 |
| `X_CLIENT_ID` / `X_CLIENT_SECRET` | X/Twitter | OAuth | P3 |
| `GOOGLE_OAUTH_CLIENT_ID` / `_SECRET` | Google | YouTube subs | P3 |
| `DISCORD_CLIENT_ID` / `_SECRET` | Discord | OAuth/bot | P3 |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe | billing | P3 |
| `BENZINGA_API_KEY` | Benzinga | paid finance feed | when a benzinga source row exists |
| `IFTTT_KEY` | IFTTT | social posting bridge | P3 |

### Spend caps set (per runbook §4)
- **Gemini:** API restriction (Gemini API only) ✅ + billing budget + alerts ✅ (2026-07-01).
- **Anthropic:** confirm the key sits in a Workspace with a per-workspace spend limit.
- Deferred providers get their cap **when recreated**, not before.
