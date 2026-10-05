# PS Claude task — Email delivery fix (Phases E0+E1)

> Run in `C:\Users\vtbsj\victor-ai-factory\projects\forgeminds`. Recommended model: Sonnet 4.6.
> Design doc: `docs/architecture/email-delivery.md` — read §2 (root cause) + §3 (phases) first.
> Founder needed once at step 4 (types one value + confirms one URL).
> Commit this file TOGETHER with the design doc in your fix commit (step 6).
> NEVER read `.env.local` or echo any secret value (factory secrets-handling.md §2).

## Context in one paragraph

Deliver fails `{"sent":0,"failed":2}` with `delivery_log` EMPTY. Root cause (verified by the desktop session against the live DB + SDK source): `@react-email/render` is not installed at top level, so `resend.emails.send({react})` THROWS pre-network (SDK shared render helper, `node_modules/resend/dist/index.mjs:210-217`); the throw lands in the route's catch which logs nothing (D3). Behind that: Resend is in testing mode (no ForgeMinds domain) and only delivers to the account owner `vctrbbnv@gmail.com`, while the pipeline recipient is `vctrbbnv@pm.me` (D2). The hostile review also found the send loop has no double-send protection (D4). Fix all four below. Domain purchase is deliberately deferred (design doc §3 Phase E2). The desktop session has ALREADY: (a) verified all `delivery_log` insert columns against live `information_schema` (column-drift gate closed), and (b) applied the partial unique index to the live DB (`delivery_log_sent_once on (brief_id, delivery_type) where status='sent'`, advisors clean) — you only add the migration file for parity (step 3).

## Steps (in order)

### 1. Preflight
- `git status` clean-ish on `master`; `git log --oneline -3` includes `5248cd2`.
- `npm install @react-email/render@1.0.4` — **pinned**: matches the version `@react-email/components@0.0.32` was built against (verified at `node_modules/@react-email/components/node_modules/@react-email/render/package.json`). Do NOT install unpinned latest; render internals drifted across 1.x.

### 2. Edit `src/app/api/cron/deliver/route.ts` (one file, five changes)

**(a) Explicit static-import rendering (D1).** Add import; render to html; pass `html:` not `react:`; add idempotency key (D4 layer 1).

```ts
import { render } from "@react-email/render";   // static — unresolvable = BUILD failure, not silent runtime throw
```

In the send block (~line 169-191): keep building `reactEl` exactly as now, but UPDATE the stale comment above it (lines 172-173 — it claims "Resend renders the React tree server-side", which becomes false) to:

```ts
// Render the React Email template to html in-route (static import — build fails
// if unresolvable). Resend receives pre-rendered html, never a react payload.
```

then:

```ts
const html = await render(reactEl);

const { data: sendData, error: sendErr } = await resend.emails.send(
  {
    from: fromAddr,
    to: recipient.email,
    subject,
    html,
    text: brief.summary_text ?? brief.title,
  },
  { idempotencyKey: `brief/${brief.id}` }  // provider-side dedup, 24h window (SDK v6 supports this)
);
```

(`react:` key removed. `ReactElement` import stays — `reactEl` is still typed.)

**(b) Error-check the success path + briefs.update (D4 layers 2-3, VIBE 52).** Replace the sent-row insert + briefs.update block (~line 208-227) with:

```ts
const { error: sentLogErr } = await supabase.from("delivery_log").insert({
  user_id: recipient.user_id,
  brief_id: brief.id,
  delivery_type: "email_digest",
  recipient: recipient.email,
  status: "sent",
  provider: "resend",
  provider_message_id: sendData?.id ?? null,
});
if (sentLogErr) {
  if (sentLogErr.code === "23505") {
    // unique index delivery_log_sent_once — this brief already has a sent row
    // (e.g. prior tick crashed between send and update). Treat as already-sent (VIBE 37).
    console.warn(`[Deliver] brief ${brief.id}: sent row already exists — continuing to is_delivered update`);
  } else {
    console.error(`[Deliver] delivery_log sent-row write failed for brief ${brief.id}:`, sentLogErr.message);
  }
}

const { error: updErr } = await supabase
  .from("briefs")
  .update({
    is_delivered: true,
    delivered_at: new Date().toISOString(),
    delivery_method: "email",
  })
  .eq("id", brief.id);
if (updErr) {
  // CRITICAL path: email is out but the gate didn't flip. Next tick retries the brief;
  // the idempotency key makes the re-send a provider no-op and the unique index makes
  // the re-log a 23505. No duplicate email can reach the inbox.
  console.error(`[Deliver] brief ${brief.id}: sent but is_delivered update FAILED — will retry next tick:`, updErr.message);
  failedCount++;
  continue;
}

sentCount++;
```

**(c) Log failures in the catch path (D3 — permanent, VIBE 52). No raw email addresses in console output** (observability.md §2 — the address belongs only in the RLS-protected DB row). Replace the per-brief catch (~line 228-231):

```ts
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[Deliver] send failed for brief ${brief.id} user ${recipient.user_id.slice(0, 8)}:`, msg);
  const { error: logErr } = await supabase.from("delivery_log").insert({
    user_id: recipient.user_id,
    brief_id: brief.id,
    delivery_type: "email_digest",
    recipient: recipient.email,
    status: "failed",
    provider: "resend",
    error_message: msg.slice(0, 500),
  });
  if (logErr) console.error(`[Deliver] delivery_log write failed for brief ${brief.id}:`, logErr.message);
  failedCount++;
}
```

Also adjust the structured-error path's existing console line (~line 194) the same way: log `brief.id` + `recipient.user_id.slice(0,8)`, not the email.

**(d) Dev-only recipient override, SCOPED to the test user (D2).** In `resolveRecipient()`, real-user branch, AFTER the `delivery_email` opt-out check and AFTER the auth email lookup succeeds (~line 76-80):

```ts
// DEV-ONLY override — REMOVE at launch (tracked: PENDING_APPROVALS "Email E2 launch checklist",
// design doc docs/architecture/email-delivery.md §9). Resend testing mode (no verified ForgeMinds
// domain) only delivers to the Resend account owner's address. SCOPED to the founder test user:
// a global override would redirect other users' brief content to a personal inbox (leak class).
const TEST_USER_ID = "3707759d-9863-4f69-a6d8-f40036fa15f1";
const testRecipient = process.env.RESEND_TEST_RECIPIENT;
if (testRecipient && brief.user_id !== TEST_USER_ID) {
  console.error(
    `[Deliver] RESEND_TEST_RECIPIENT is set but brief ${brief.id} belongs to a different user — skipping (fail-closed)`
  );
  return null;
}

return {
  user_id: brief.user_id,
  email: testRecipient && brief.user_id === TEST_USER_ID ? testRecipient : user.user.email,
  display_name: profile?.display_name ?? null,
};
```

**(e) SYSTEM_USER_ID branch hygiene (~line 48-54).** This branch is currently unreachable (`briefs.user_id` is NOT NULL FK to auth.users; the pseudo-user has no auth row) but its fallback recipient is `RESEND_FROM_EMAIL` — which is now `onboarding@resend.dev`, i.e. it would address mail TO Resend's own test sender. Make it honor the override and fix the stale comment:

```ts
// System pseudo-user (unreachable today — briefs.user_id is a NOT NULL FK to auth.users;
// kept for the legacy system-pipeline path). RESEND_FROM_EMAIL is currently
// onboarding@resend.dev (NOT a real inbox), so prefer the test override when set.
if (brief.user_id === SYSTEM_USER_ID) {
  const fallback = process.env.RESEND_TEST_RECIPIENT ?? process.env.RESEND_FROM_EMAIL;
  if (!fallback) return null;
  const email = fallback.match(/<([^>]+)>/)?.[1] ?? fallback;
  return { user_id: SYSTEM_USER_ID, email, display_name: "there" };
}
```

### 3. Migration file (parity only — already applied to live DB)
Create `supabase/migrations/<timestamp>_add_delivery_log_sent_once_unique.sql`:

```sql
-- Prevent duplicate provider sends per brief per channel (hostile-architect review 2026-06-11,
-- docs/architecture/email-delivery.md §5). Partial unique: only 'sent' rows conflict; failed
-- retries may accumulate freely. Code treats 23505 on the sent-row insert as already-sent (VIBE 37).
create unique index if not exists delivery_log_sent_once
  on public.delivery_log (brief_id, delivery_type)
  where status = 'sent';
```

(Desktop session applied this exact SQL via MCP on 2026-06-11; advisors scan after: no new findings. This file is migration-parity per the `5248cd2` pattern.)

### 4. Secret + URL check — FOUNDER PRESENT
- `npx wrangler secret put RESEND_TEST_RECIPIENT` → Victor enters: `vctrbbnv@gmail.com`
  (Value written here ONLY because it is non-credential routing config — **never replicate this pattern for real secrets** like API keys/tokens.)
- **briefUrl integrity:** `NEXT_PUBLIC_*` values are inlined at BUILD time from `.env.local` (not runtime secrets). Ask Victor to confirm in his own editor that `.env.local`'s `NEXT_PUBLIC_APP_URL` equals `https://forgeminds.vctrbbnv.workers.dev` (the live app). Independently, change the route's fallback at ~line 182 — `"https://forgeminds.app"` is a domain Victor does NOT own; dead/squattable links must not ship in email:

```ts
briefUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://forgeminds.vctrbbnv.workers.dev"}/briefs/${brief.id}`,
// fallback = live Worker URL until E2 buys the real domain (design doc §3.E2)
```

### 5. Gates (all must pass before deploy)
- `npx tsc --noEmit` → 0 errors
- `npm run lint` → 0 errors
- Read the full edited file end-to-end once (Code Read Test).
- (Column-drift gate: already closed by the desktop session against live `information_schema` — noted in design doc §1 row 11.)

### 6. Deploy
- `npm run deploy` (opennextjs-cloudflare build && deploy). If the build fails on `@react-email/render` / react-dom-server resolution: STOP, report verbatim — the fallback variant (install-only, keep `react:`) is documented in design doc §3.E1.1, but report before switching.

### 7. Commit (after successful deploy)
- One commit: `fix(deliver): render email via static import, idempotent sends, log all failure paths, scoped test-recipient override`
- Body must include:
  - `Design doc: docs/architecture/email-delivery.md (committed with this change)`
  - the literal line `Wiring-tracked: PENDING_APPROVALS "Email E2 launch checklist"` (the DEV-ONLY override is a proven-not-wired scaffold; this marker is what the wiring-debt tripwire greps for)
  - `Migration parity: delivery_log_sent_once already applied to live DB via MCP 2026-06-11. Advisors: clean (no new findings)`
- Do NOT add `[no-arch: …]` — this is a `fix(` commit (the arch gate fires on `feat(` only) and the architecture doc ships in the same commit; a spurious marker logs a false override event to factory metrics.
- Include in the commit: the route edit, the migration file, `package.json`/lock, `docs/architecture/email-delivery.md`, `docs/ops/PS_PROMPT_email-fix.md`, and `PENDING_APPROVALS.md` (the "Email E2 launch checklist" entry the desktop session appended).

### 8. Optional but valuable: capture runtime proof
- `npx wrangler tail forgeminds --format pretty` in a second terminal while the desktop session re-fires deliver — capture `[Deliver]` lines for the report (they contain brief ids, no email addresses).

### 9. Report back (desktop session takes over)
Report: gates output, deploy success, secret NAME set (never values), tail excerpt if captured.
The desktop session will then:
- `select private.invoke_forgeminds_cron('deliver','3707759d-9863-4f69-a6d8-f40036fa15f1');`
- Verify `net._http_response` shows `sent:2 / failed:0`; `delivery_log` has exactly 2 `sent` rows with `provider_message_id`; both briefs `is_delivered=true`.
- Victor confirms 2 emails in the **gmail** inbox (both pending briefs send — expected), links resolving to the live workers.dev app.
- Then watch one full unattended cron cycle deliver the next brief with zero manual firing (execution.md A.4).

## Hard rules
- No `.env.local` reads; no secret values in output/logs/commits (the one documented routing-config value above is the sole, flagged exception).
- No DB writes — all SQL verification is the desktop session's job (the migration is already live; you only commit the parity file).
- If anything fails twice, stop and report — don't improvise (3-prompt revert rule).
