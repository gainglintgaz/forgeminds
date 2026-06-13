# PS Claude task — Deploy ForgeMinds to Cloudflare Workers (founder present required)

> Run in `C:\Users\vtbsj\victor-ai-factory\projects\forgeminds`. Recommended model: Sonnet 4.6.
> The OpenNext adapter prep is ALREADY COMMITTED (`2887b0a`) — wrangler.jsonc, open-next.config.ts,
> and the `deploy` script all exist. Do NOT redo prep. Do NOT commit this file.
> **Founder must be at the keyboard**: step 2 needs his browser click, step 4 needs him pasting
> secret values. NEVER read `.env.local` or echo any secret value (factory secrets-handling.md).

## Steps (in order)

### 1. Preflight
- `git log --oneline -3` — confirm repo includes `2887b0a` (OpenNext prep).
- Ensure no `next dev` is running (kill any node on port 3000; it collides on `.next/`).
- `npx wrangler --version` (must be ≥ 3.99).

### 2. Cloudflare auth — FOUNDER ACTION
- Run `npx wrangler login`.
- Tell Victor: **"Your browser will open — click the blue 'Allow' button."** Wait for success.
- Verify: `npx wrangler whoami` shows his account.

### 3. Deploy
- Run `npm run deploy` (runs `opennextjs-cloudflare build && opennextjs-cloudflare deploy`).
- On success it prints the live URL, e.g. `https://forgeminds.<account>.workers.dev`.
- **Record that URL — it's the key deliverable.** (Routes will 500/401 until secrets are set — expected.)
- If the build fails: STOP, report errors verbatim, do not hack around.

### 4. Secrets — FOUNDER PASTES VALUES
- Get the canonical NAME list from `.env.example` (names only — NEVER open `.env.local` yourself).
  Tell Victor to open `.env.local` in Notepad himself to copy values from.
- For every server-side var (everything EXCEPT the two `NEXT_PUBLIC_*` ones, which were baked in
  at build time from `.env.local`), run one at a time:
  `npx wrangler secret put <NAME>` → prompt appears → **Victor pastes the value** → Enter.
  At minimum: SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, ANTHROPIC_API_KEY, GEMINI_API_KEY,
  OPENAI_API_KEY, XAI_API_KEY, PERPLEXITY_API_KEY, FINNHUB_API_KEY, ALPACA_API_KEY,
  ALPACA_SECRET_KEY, ALPHA_VANTAGE_KEY, BENZINGA_API_KEY (+ RESEND_API_KEY / FROM_EMAIL if present
  in .env.example). Skip any name not present in `.env.local` (Victor will say "skip").
- ⚠️ CRON_SECRET must be the SAME value as in `.env.local` (the Supabase vault `cron_secret`
  is assumed to match it; mismatch shows up as 401s in verification — see step 6).

### 5. Smoke test
- `curl https://<deploy-url>/api/health` → expect HTTP 200.
- `curl -H "Authorization: Bearer wrong" https://<deploy-url>/api/cron/ingest` → expect 401
  (proves auth gate is live).
- Open `https://<deploy-url>/` in a browser → landing page renders.

### 6. Report back (the desktop session takes over from here)
Report: the deploy URL, health-check result, list of secret NAMES set (never values).
The desktop Claude session will then:
- `UPDATE private.app_config SET value='<deploy-url>' WHERE key='forgeminds_base_url';`
- Watch `net._http_response` for status 200 (vs the old "Couldn't resolve host name")
  and `pipeline_runs` for fresh rows within ~30 min (Victor's cadence).
- **Contingency:** if responses show 401, the vault `cron_secret` ≠ worker CRON_SECRET —
  fix by re-running `npx wrangler secret put CRON_SECRET` with the vault's value
  (Victor can read it in Supabase Dashboard → Project Settings → Vault).

## Hard rules
- No `.env.local` reads, no secret values in output/logs/commits (secrets-handling.md §2).
- No DB writes — the app_config repoint is the desktop session's job.
- If anything fails twice, stop and report — don't improvise infra changes.
