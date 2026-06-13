import { NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/render"; // static — unresolvable = BUILD failure, not silent runtime throw
import { createServiceClient } from "@/lib/supabase/server";
import { DailyBriefEmail } from "@/lib/email/templates/daily-brief";
import { resolveUserId, loadPrefs, SYSTEM_USER_ID } from "@/lib/pipeline/user-prefs";
import type { ReactElement } from "react";

export const maxDuration = 60;

interface BriefForDelivery {
  id: string;
  user_id: string;
  title: string;
  brief_date: string;
  summary_html: string | null;
  summary_text: string | null;
  article_ids: string[];
  ticker_symbols: string[] | null;
  article_count: number | null;
  categories_covered: string[] | null;
}

interface RecipientProfile {
  user_id: string;
  email: string;
  display_name: string | null;
}

/**
 * Resolve the recipient for a brief.
 *
 * Per-user-from-day-1 model: every brief belongs to ONE user (`brief.user_id`),
 * and that user is the recipient. We look up their auth.users email and their
 * display_name from profiles.
 *
 * Special case: the SYSTEM_USER_ID pseudo-user used by the legacy system
 * pipeline has no auth row. For that case we fall back to RESEND_FROM_EMAIL
 * (Victor's inbox per .env.local) so the system pipeline can still email
 * during dev / pre-onboarding.
 *
 * Each brief gets exactly one recipient. Multi-recipient broadcast (a Phase 8
 * Community Brain feature) goes through a separate flow with its own table.
 */
async function resolveRecipient(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  brief: BriefForDelivery
): Promise<RecipientProfile | null> {
  // System pseudo-user (unreachable today — briefs.user_id is a NOT NULL FK to auth.users;
  // kept for the legacy system-pipeline path). RESEND_FROM_EMAIL is currently
  // onboarding@resend.dev (NOT a real inbox), so prefer the test override when set.
  if (brief.user_id === SYSTEM_USER_ID) {
    const fallback = process.env.RESEND_TEST_RECIPIENT ?? process.env.RESEND_FROM_EMAIL;
    if (!fallback) return null;
    const email = fallback.match(/<([^>]+)>/)?.[1] ?? fallback;
    return { user_id: SYSTEM_USER_ID, email, display_name: "there" };
  }

  // Real user → look up their auth.users email + profile display name.
  // delivery_email=false means user opted out of email delivery.
  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("delivery_email")
    .eq("user_id", brief.user_id)
    .maybeSingle();
  if (prefs && prefs.delivery_email === false) {
    return null;
  }

  const { data: user } = await supabase.auth.admin.getUserById(brief.user_id);
  if (!user?.user?.email) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", brief.user_id)
    .maybeSingle();

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
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromAddr = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !fromAddr) {
    return NextResponse.json(
      { error: "RESEND_API_KEY or RESEND_FROM_EMAIL not configured" },
      { status: 500 }
    );
  }

  const startTime = Date.now();
  const supabase = await createServiceClient();
  const resend = new Resend(apiKey);

  const userId = resolveUserId(request);
  const prefs = await loadPrefs(supabase, userId);

  // SYSTEM_USER_ID → null in audit row (FK to auth.users). See ingest/route.ts.
  const auditUserId = userId === SYSTEM_USER_ID ? null : userId;

  // Audit row is mandatory (dormant-pipeline contract; VIBE Rule 52).
  const { data: run, error: runErr } = await supabase
    .from("pipeline_runs")
    .insert({ step_name: "deliver", status: "running", user_id: auditUserId })
    .select("id")
    .single();

  if (runErr || !run?.id) {
    console.error(
      `[deliver] pipeline_runs insert failed for user=${userId.slice(0, 8)}: ${runErr?.message ?? "no row returned"}`
    );
    return NextResponse.json(
      { error: "audit_write_failed", step: "deliver", detail: runErr?.message ?? "no row returned" },
      { status: 400 }
    );
  }

  try {
    // Briefs ready to deliver for this user: summary_html generated AND not
    // yet delivered. Scoped by user_id so each user's deliver tick only sends
    // their own briefs.
    const { data: briefs, error: briefErr } = await supabase
      .from("briefs")
      .select(
        "id, user_id, title, brief_date, summary_html, summary_text, article_ids, ticker_symbols, article_count, categories_covered"
      )
      .eq("user_id", userId)
      .not("summary_html", "is", null)
      .eq("is_delivered", false)
      .order("brief_date", { ascending: false })
      .limit(prefs.deliver_batch_size);

    if (briefErr) throw briefErr;

    if (!briefs || briefs.length === 0) {
      if (run?.id) {
        await supabase
          .from("pipeline_runs")
          .update({
            status: "completed",
            items_processed: 0,
            items_created: 0,
            duration_ms: Date.now() - startTime,
            completed_at: new Date().toISOString(),
            metadata: { note: "no briefs pending delivery" },
          })
          .eq("id", run.id);
      }
      return NextResponse.json({ message: "No briefs to deliver", delivered: 0 });
    }

    let sentCount = 0;
    let failedCount = 0;

    for (const brief of briefs as BriefForDelivery[]) {
      const recipient = await resolveRecipient(supabase, brief);
      if (!recipient) {
        console.warn(`[Deliver] Brief ${brief.id}: no recipient resolved (user opted out or missing), skipping`);
        continue;
      }

      try {
        const subject = `${brief.title} — ${brief.brief_date}`;

        // Render the React Email template to html in-route (static import — build fails
        // if unresolvable). Resend receives pre-rendered html, never a react payload.
        const reactEl = DailyBriefEmail({
          recipientName: recipient.display_name ?? "there",
          briefTitle: brief.title,
          briefDate: brief.brief_date,
          summaryHtml: brief.summary_html ?? "",
          articleCount: brief.article_count ?? 0,
          tickerSymbols: brief.ticker_symbols ?? [],
          categoriesCovered: brief.categories_covered ?? [],
          // E1: host hardcoded to the live Worker URL — no NEXT_PUBLIC_APP_URL dependency
          // (skips the .env.local gate; can't ship a dead localhost link). Per founder + desktop
          // session. E2 swaps this to the real domain (design doc §3.E2).
          briefUrl: `https://forgeminds.vctrbbnv.workers.dev/briefs/${brief.id}`,
        }) as ReactElement;

        const html = await render(reactEl);

        const { data: sendData, error: sendErr } = await resend.emails.send(
          {
            from: fromAddr,
            to: recipient.email,
            subject,
            html,
            text: brief.summary_text ?? brief.title,
          },
          { idempotencyKey: `brief/${brief.id}` } // provider-side dedup, 24h window (SDK v6 supports this)
        );

        if (sendErr) {
          console.error(`[Deliver] Resend error for brief ${brief.id} user ${recipient.user_id.slice(0, 8)}:`, sendErr.message);
          await supabase.from("delivery_log").insert({
            user_id: recipient.user_id,
            brief_id: brief.id,
            delivery_type: "email_digest",
            recipient: recipient.email,
            status: "failed",
            provider: "resend",
            error_message: sendErr.message,
          });
          failedCount++;
          continue;
        }

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
    }

    const executionTime = Date.now() - startTime;

    if (run?.id) {
      await supabase
        .from("pipeline_runs")
        .update({
          status: "completed",
          items_processed: briefs.length,
          items_created: sentCount,
          items_failed: failedCount,
          duration_ms: executionTime,
          completed_at: new Date().toISOString(),
          metadata: { provider: "resend" },
        })
        .eq("id", run.id);
    }

    return NextResponse.json({
      briefsPending: briefs.length,
      sent: sentCount,
      failed: failedCount,
      executionTimeMs: executionTime,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    if (run?.id) {
      await supabase
        .from("pipeline_runs")
        .update({
          status: "failed",
          error_message: err.message,
          duration_ms: Date.now() - startTime,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);
    }
    console.error(`[Deliver] Pipeline failed: ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
