# PS Claude task — Cloudflare/OpenNext repo prep (code only; NO deploy, NO Cloudflare account)

> Hand to a PowerShell Claude session in
> `C:\Users\vtbsj\victor-ai-factory\projects\forgeminds`.
> Generated 2026-06-05 by the orchestration session. Do NOT commit this file.
> (The earlier `NEXT_PS_PROMPT.md` reconcile task is DONE — ignore it.)

## CONTEXT (you have no memory — here it is)

Decision locked: ForgeMinds deploys to **Cloudflare Workers via the OpenNext adapter**
(`@opennextjs/cloudflare`), NOT Vercel. The automated pipeline is currently dead because
`private.app_config.forgeminds_base_url = 'https://forgeminds.app'` (a placeholder that doesn't
resolve) and the app isn't deployed anywhere. This task does the **repo-side prep** so a deploy
becomes possible. **You do NOT deploy, do NOT run `wrangler login`, do NOT set secrets, do NOT
touch any Cloudflare account or any database.** The deploy + secrets + DNS happen later in a
separate session where the founder authorizes Cloudflare auth.

Stack: Next.js 16 (App Router, Turbopack), Supabase (DB/auth + pg_cron). Verified-current
OpenNext steps: https://opennext.js.org/cloudflare/get-started

## TASKS (code only; master branch; run the verify gates)

### 1. Install adapter + wrangler
```
npm install @opennextjs/cloudflare@latest
npm install --save-dev wrangler@latest   # need >= 3.99.0
```

### 2. Create `wrangler.jsonc` (project root)
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "main": ".open-next/worker.js",
  "name": "forgeminds",
  "compatibility_date": "2026-06-01",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "assets": { "directory": ".open-next/assets", "binding": "ASSETS" },
  "services": [{ "binding": "WORKER_SELF_REFERENCE", "service": "forgeminds" }]
}
```

### 3. Create `open-next.config.ts` — MINIMAL (no R2 cache for the first deploy)
```typescript
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Minimal config for first deploy. NOT using r2IncrementalCache yet — that
// needs an R2 bucket binding (a Cloudflare-account step we're deferring).
// ForgeMinds is mostly dynamic SSR + API routes, so ISR cache is not needed
// for the alpha. Add r2IncrementalCache later if/when ISR pages appear.
export default defineCloudflareConfig({});
```

### 4. Create `public/_headers`
```
/_next/static/*
  Cache-Control: public,max-age=31536000,immutable
```

### 5. Create `.dev.vars` (local only — must be gitignored)
```
NEXTJS_ENV=development
```

### 6. Update `next.config.ts` — add the dev shim (additive; keep everything else)
```typescript
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
```
(Add near the top; keep all existing config exports intact.)

### 7. Update `package.json` scripts — ADD these; do NOT change the existing `build`
Keep `"build": "tsc --noEmit && next build"` exactly as-is (husky/CI depend on it). Add:
```jsonc
"preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
"deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
"upload": "opennextjs-cloudflare build && opennextjs-cloudflare upload",
"cf-typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts"
```

### 8. `.gitignore` — add
```
.open-next
.dev.vars
cloudflare-env.d.ts
```

### 9. AUDIT + FIX: edge-runtime incompatibility
Grep the whole `src/` for `export const runtime = "edge"` (and `'edge'`). OpenNext/Workers uses
the Node runtime — remove every such export (the routes run on Node-compat Workers). Report each
file you changed. If a route genuinely needs edge, STOP and flag it instead of guessing.

### 10. AUDIT (report only — do NOT change): Workers-fit concerns
- Cron routes set `export const maxDuration = 120` (and 500 on enrich). Note this in your report:
  Workers request limits differ from Vercel functions; flag for the deploy session to verify long
  runs don't get cut. Do not change values.
- Confirm Next middleware exists (Supabase session refresh) and note its path; OpenNext supports
  middleware but the deploy session must verify it runs on Workers.

### 11. VERIFY (the key de-risk — local build, NO deploy)
Ensure NO `next dev` is running (it collides on `.next/`). Then run:
```
npx opennextjs-cloudflare build
```
This compiles the app to a `.open-next/worker.js` bundle WITHOUT deploying. If it succeeds, the
app is Workers-deployable. If it fails, capture the errors and report them — DO NOT attempt to
deploy or work around with hacks; surface the incompatibilities for review.

### 12. Gates + commit
- `npx tsc --noEmit`, `npm run lint` green.
- Commit (master), scoping `git add` to ONLY the files you created/changed (wrangler.jsonc,
  open-next.config.ts, public/_headers, next.config.ts, package.json, package-lock.json,
  .gitignore + any route files you edited in step 9). Do NOT `git add` the uncommitted
  `docs/decisions/2026-05-31-ai-model-ab.md` (another session owns it) and do NOT commit this
  prompt file, `.dev.vars`, or `.open-next/`.
- Commit subject: `chore(deploy): add OpenNext Cloudflare adapter + config [discovery-skipped] reason: deployment infra config, no feature/schema change`

## CONSTRAINTS
- NO deploy, NO `wrangler login`, NO `wrangler secret`, NO Cloudflare account, NO DB writes.
- Stay on master (project rule: no worktrees).
- If `npx opennextjs-cloudflare build` fails, that's a REPORT, not a blocker to work around.

## REPORT BACK
- Commit hash.
- Result of `npx opennextjs-cloudflare build` (success → bundle size if shown; or the errors).
- Step 9 findings (files with edge runtime removed, if any).
- Step 10 findings (maxDuration routes + middleware path) for the deploy session.
