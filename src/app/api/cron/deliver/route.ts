import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/server";
import { DailyBriefEmail } from "@/lib/email/templates/daily-brief";
import type { ReactElement } from "react";

export const maxDuration = 60;

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";

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
 * Resolve recipient(s) for a brief. Phase 1: brief.user_id is the SYSTEM_USER_ID
 * pipeline; the recipient is whoever subscribes to "system" briefs (currently
 * only Victor). For Phase 2 (per-user briefs), brief.user_id IS the recipient.
 *
 * For Phase 1 we look up users with `delivery_email = true` in user_preferences
 * and email them the system brief. If no real users exist, we fall back to
 * RESEND_FROM_EMAIL itself (Victor's address per .env.local) so deliveries
 * are testable without onboarding flow being live yet.
 */
async function resolveRecipients(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  brief: BriefForDelivery
): Promise<RecipientProfile[]> {
  if (brief.user_id !== SYSTEM_USER_ID) {
    // Phase 2 path — per-user brief, look up that one user.
    const { data: user } = await supabase.auth.admin.getUserById(brief.user_id);
    if (!user?.user?.email) return [];
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", brief.user_id)
      .single();
    return [
      {
        user_id: brief.user_id,
        email: user.user.email,
        display_name: profile?.display_name ?? null,
      },
    ];
  }

  // Phase 1 path — system brief broadcast to opted-in users.
  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("user_id")
    .eq("delivery_email", true);

  const recipients: RecipientProfile[] = [];
  for (const p of prefs ?? []) {
    const { data: u } = await supabase.auth.admin.getUserById(p.user_id);
    if (!u?.user?.email) continue;
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", p.user_id)
      .single();
    recipients.push({
      user_id: p.user_id,
      email: u.user.email,
      display_name: profile?.display_name ?? null,
    });
  }

  // Phase 1 fallback — no users yet → send to RESEND_FROM_EMAIL so Victor
  // can verify delivery before the onboarding flow ships.
  if (recipients.length === 0) {
    const fallback = process.env.RESEND_FROM_EMAIL;
    if (fallback) {
      // Strip "Name <email@addr>" → "email@addr" if formatted that way.
      const email = fallback.match(/<([^>]+)>/)?.[1] ?? fallback;
      recipients.push({ user_id: SYSTEM_USER_ID, email, display_name: "Victor" });
    }
  }

  return recipients;
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

  const { data: run } = await supabase
    .from("pipeline_runs")
    .insert({ step_name: "deliver", status: "running" })
    .select("id")
    .single();

  try {
    // Briefs ready to deliver: summary_html generated AND not yet delivered.
    const { data: briefs, error: briefErr } = await supabase
      .from("briefs")
      .select(
        "id, user_id, title, brief_date, summary_html, summary_text, article_ids, ticker_symbols, article_count, categories_covered"
      )
      .not("summary_html", "is", null)
      .eq("is_delivered", false)
      .order("brief_date", { ascending: false })
      .limit(20);

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
      const recipients = await resolveRecipients(supabase, brief);
      if (recipients.length === 0) {
        console.warn(`[Deliver] Brief ${brief.id}: no recipients resolved, skipping`);
        continue;
      }

      // Track if at least one recipient succeeded — if so we mark the brief delivered.
      let anySuccess = false;

      for (const r of recipients) {
        try {
          const subject = `${brief.title} — ${brief.brief_date}`;

          // Render the React Email template. The Resend SDK accepts a React
          // element via `react:` and renders to MIME on the wire.
          const reactEl = DailyBriefEmail({
            recipientName: r.display_name ?? "there",
            briefTitle: brief.title,
            briefDate: brief.brief_date,
            summaryHtml: brief.summary_html ?? "",
            articleCount: brief.article_count ?? 0,
            tickerSymbols: brief.ticker_symbols ?? [],
            categoriesCovered: brief.categories_covered ?? [],
            briefUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://forgeminds.app"}/briefs/${brief.id}`,
          }) as ReactElement;

          const { data: sendData, error: sendErr } = await resend.emails.send({
            from: fromAddr,
            to: r.email,
            subject,
            react: reactEl,
            // Plain-text fallback for clients that strip HTML.
            text: brief.summary_text ?? brief.title,
          });

          if (sendErr) {
            console.error(`[Deliver] Resend error for ${r.email}:`, sendErr.message);
            await supabase.from("delivery_log").insert({
              user_id: r.user_id,
              brief_id: brief.id,
              delivery_type: "email_digest",
              recipient: r.email,
              status: "failed",
              provider: "resend",
              error_message: sendErr.message,
            });
            failedCount++;
            continue;
          }

          await supabase.from("delivery_log").insert({
            user_id: r.user_id,
            brief_id: brief.id,
            delivery_type: "email_digest",
            recipient: r.email,
            status: "sent",
            provider: "resend",
            provider_message_id: sendData?.id ?? null,
          });

          sentCount++;
          anySuccess = true;
        } catch (err) {
          console.error(`[Deliver] Send failed for ${r.email}:`, (err as Error).message);
          failedCount++;
        }
      }

      if (anySuccess) {
        await supabase
          .from("briefs")
          .update({
            is_delivered: true,
            delivered_at: new Date().toISOString(),
            delivery_method: "email",
          })
          .eq("id", brief.id);
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
