import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 60;

// System UUID for shared pipeline writes (Phase 0/1). Per-user enrichment is Phase 2.
const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";

// Money is BIGINT cents in DB (VIBE Rule 14). Convert at the boundary.
function toCents(usd: number | null | undefined): number | null {
  if (usd == null || Number.isNaN(usd)) return null;
  return Math.round(usd * 100);
}

interface FinnhubQuote {
  c: number; // current price
  d: number | null; // change
  dp: number | null; // percent change
  h: number; // high of day
  l: number; // low of day
  o: number; // open
  pc: number; // previous close
  t: number; // unix timestamp
}

async function fetchFinnhubQuote(
  symbol: string,
  apiKey: string
): Promise<FinnhubQuote | null> {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) {
      console.error(`[Enrich] Finnhub /quote ${symbol} → HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as FinnhubQuote;
    // Finnhub returns { c: 0, d: null, ... } for unknown symbols. Treat as miss.
    if (!data.c || data.c === 0) return null;
    return data;
  } catch (err) {
    console.error(`[Enrich] Finnhub /quote ${symbol} failed:`, (err as Error).message);
    return null;
  }
}

export async function GET(request: Request) {
  // Auth check
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "FINNHUB_API_KEY not configured" },
      { status: 500 }
    );
  }

  const startTime = Date.now();
  const supabase = await createServiceClient();

  // Open pipeline run
  const { data: run } = await supabase
    .from("pipeline_runs")
    .insert({ step_name: "enrich", status: "running" })
    .select("id")
    .single();

  try {
    // Pull tickers from today's curated briefs. ticker_symbols is text[].
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: briefs, error: briefErr } = await supabase
      .from("briefs")
      .select("ticker_symbols")
      .gte("brief_date", today.toISOString().split("T")[0])
      .eq("user_id", SYSTEM_USER_ID);

    if (briefErr) throw briefErr;

    // Distinct, non-empty tickers across all briefs.
    const tickers = Array.from(
      new Set(
        (briefs ?? [])
          .flatMap((b) => (b.ticker_symbols ?? []) as string[])
          .filter((t): t is string => typeof t === "string" && t.length > 0)
      )
    );

    if (tickers.length === 0) {
      if (run?.id) {
        await supabase
          .from("pipeline_runs")
          .update({
            status: "completed",
            items_processed: 0,
            items_created: 0,
            duration_ms: Date.now() - startTime,
            completed_at: new Date().toISOString(),
            metadata: { note: "no tickers in today's briefs" },
          })
          .eq("id", run.id);
      }
      return NextResponse.json({ message: "No tickers to enrich", enriched: 0 });
    }

    // Fetch each ticker's quote (sequential to be polite to Finnhub free tier:
    // 60 calls/min limit). For 50 tickers @ 200ms each = 10s, well under maxDuration.
    let enrichedCount = 0;
    let failedCount = 0;
    for (const symbol of tickers) {
      const quote = await fetchFinnhubQuote(symbol, apiKey);
      if (!quote) {
        failedCount++;
        continue;
      }

      const { error: upsertErr } = await supabase.from("ticker_data").upsert(
        {
          user_id: SYSTEM_USER_ID,
          symbol,
          asset_type: "stock", // Phase 1 default; crypto/forex come with CoinGecko in Phase 1.5
          price_cents: toCents(quote.c),
          change_cents: toCents(quote.d ?? null),
          change_percent: quote.dp ?? null,
          // No volume/market_cap from /quote; would need /stock/profile2 for those (deferred)
          data_source: "finnhub",
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "user_id,symbol,fetched_date" }
      );

      if (upsertErr) {
        // 23505 (already saved today) is benign — silently skip per VIBE Rule 37
        if (upsertErr.code !== "23505") {
          console.error(`[Enrich] Upsert ${symbol} failed:`, upsertErr.message);
          failedCount++;
          continue;
        }
      }
      enrichedCount++;
    }

    const executionTime = Date.now() - startTime;

    if (run?.id) {
      await supabase
        .from("pipeline_runs")
        .update({
          status: "completed",
          items_processed: tickers.length,
          items_created: enrichedCount,
          items_failed: failedCount,
          duration_ms: executionTime,
          completed_at: new Date().toISOString(),
          metadata: { tickers_attempted: tickers, source: "finnhub" },
        })
        .eq("id", run.id);
    }

    return NextResponse.json({
      tickersAttempted: tickers.length,
      enriched: enrichedCount,
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
    console.error(`[Enrich] Pipeline failed: ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
