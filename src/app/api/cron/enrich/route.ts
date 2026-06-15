import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { resolveUserId, loadPrefs, SYSTEM_USER_ID } from "@/lib/pipeline/user-prefs";
import { routeAIRequest } from "@/lib/ai/router";
import {
  fetchStockData,
  fetchCryptoData,
  fetchIntradayAlpaca,
  type StockQuote,
} from "@/lib/pipeline/market-data";

export const maxDuration = 120;

const MARKET_READ_PROMPT_VERSION = "market-read-v0.1";
// API-cost guard: never enrich more than this many tickers in one run (Finnhub
// free tier 60/min; we make up to 3 calls/stock). Refuse above the cap.
const MAX_TICKERS_PER_RUN = 30;

const CRYPTO = new Set(["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "BNB", "AVAX", "DOT", "LTC", "LINK"]);
const ETF = new Set(["SPY", "QQQ", "DIA", "IWM", "VOO", "VTI", "VEA", "VWO", "GLD", "TLT"]);

// Money is BIGINT cents in DB (VIBE Rule 14). Convert at the boundary.
function toCents(usd: number | null | undefined): number | null {
  if (usd == null || Number.isNaN(usd)) return null;
  return Math.round(usd * 100);
}

function assetType(symbol: string): "crypto" | "etf" | "stock" {
  const s = symbol.toUpperCase();
  if (CRYPTO.has(s)) return "crypto";
  if (ETF.has(s)) return "etf";
  return "stock";
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const finnhubKey = process.env.FINNHUB_API_KEY;
  if (!finnhubKey) {
    return NextResponse.json({ error: "FINNHUB_API_KEY not configured" }, { status: 500 });
  }
  const alpacaKey = process.env.ALPACA_API_KEY;
  const alpacaSecret = process.env.ALPACA_SECRET_KEY;

  const startTime = Date.now();
  const supabase = await createServiceClient();
  const userId = resolveUserId(request);
  const prefs = await loadPrefs(supabase, userId);
  const auditUserId = userId === SYSTEM_USER_ID ? null : userId;

  const { data: run, error: runErr } = await supabase
    .from("pipeline_runs")
    .insert({ step_name: "enrich", status: "running", user_id: auditUserId })
    .select("id")
    .single();
  if (runErr || !run?.id) {
    console.error(`[enrich] pipeline_runs insert failed for user=${userId.slice(0, 8)}: ${runErr?.message ?? "no row returned"}`);
    return NextResponse.json({ error: "audit_write_failed", step: "enrich", detail: runErr?.message ?? "no row returned" }, { status: 400 });
  }

  try {
    // Symbols to enrich = the user's tracked tickers (ALWAYS) ∪ the resolved
    // tickers from today's brief stories. Tracked-always means the user's
    // watchlist is fresh even on a thin news day.
    const localToday = new Date(new Date().toLocaleString("en-US", { timeZone: prefs.timezone }));
    localToday.setHours(0, 0, 0, 0);
    const { data: briefs } = await supabase
      .from("briefs")
      .select("ticker_symbols")
      .gte("brief_date", localToday.toISOString().split("T")[0])
      .eq("user_id", userId);

    const storyTickers = (briefs ?? []).flatMap((b) => (b.ticker_symbols ?? []) as string[]);
    let symbols = Array.from(
      new Set(
        [...(prefs.tracked_tickers ?? []), ...storyTickers]
          .map((t) => String(t).trim().toUpperCase().replace(/^\$/, ""))
          .filter((t) => /^[A-Z]{1,6}$/.test(t)) // drop ^-indices (no free quote) + junk
      )
    );

    if (symbols.length === 0) {
      if (run?.id) {
        await supabase.from("pipeline_runs").update({
          status: "completed", items_processed: 0, items_created: 0,
          duration_ms: Date.now() - startTime, completed_at: new Date().toISOString(),
          metadata: { note: "no tracked or story tickers to enrich" },
        }).eq("id", run.id);
      }
      return NextResponse.json({ message: "No tickers to enrich", enriched: 0 });
    }

    // Cost guard: cap the per-run ticker count (refuse the overflow, log it).
    let dropped = 0;
    if (symbols.length > MAX_TICKERS_PER_RUN) {
      dropped = symbols.length - MAX_TICKERS_PER_RUN;
      console.warn(`[enrich] ticker count ${symbols.length} > cap ${MAX_TICKERS_PER_RUN}; enriching first ${MAX_TICKERS_PER_RUN}, dropping ${dropped}`);
      symbols = symbols.slice(0, MAX_TICKERS_PER_RUN);
    }

    let enrichedCount = 0;
    let failedCount = 0;
    let intradayCount = 0;
    const enriched: Array<{ symbol: string; type: string; q: StockQuote }> = [];

    for (const symbol of symbols) {
      const type = assetType(symbol);
      const q = type === "crypto" ? await fetchCryptoData(symbol) : await fetchStockData(symbol, finnhubKey);
      if (!q) { failedCount++; continue; }

      // Intraday series (stocks/ETFs only) via Alpaca IEX — best effort.
      let intraday: object | null = null;
      if (type !== "crypto" && alpacaKey && alpacaSecret) {
        const series = await fetchIntradayAlpaca(symbol, alpacaKey, alpacaSecret);
        if (series) { intraday = series; intradayCount++; }
      }

      const { error: upsertErr } = await supabase.from("ticker_data").upsert(
        {
          user_id: userId,
          symbol,
          name: q.name,
          asset_type: type,
          price_cents: toCents(q.priceUsd),
          change_cents: toCents(q.changeUsd),
          change_percent: q.changePct,
          volume: q.volume,
          market_cap_cents: toCents(q.marketCapUsd),
          high_52w_cents: toCents(q.high52wUsd),
          low_52w_cents: toCents(q.low52wUsd),
          pe_ratio: q.peRatio,
          intraday_json: intraday,
          data_source: q.source,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "user_id,symbol,fetched_date" }
      );
      if (upsertErr && upsertErr.code !== "23505") {
        console.error(`[enrich] upsert ${symbol} failed:`, upsertErr.message);
        failedCount++;
        continue;
      }
      enriched.push({ symbol, type, q });
      enrichedCount++;
    }

    // ── NL market read (one cheap router call for all enriched tickers) ──
    let aiCallsMade = 0;
    let aiTokensUsed = 0;
    let interpretedCount = 0;
    if (enriched.length > 0) {
      const facts = enriched.map((e) => ({
        symbol: e.symbol,
        type: e.type,
        price: e.q.priceUsd,
        change_pct: e.q.changePct,
        high_52w: e.q.high52wUsd,
        low_52w: e.q.low52wUsd,
        pe: e.q.peRatio,
      }));
      const prompt = `You are a markets analyst. For EACH ticker below, write ONE plain-English sentence interpreting the data (price, % change, position in the 52-week range, P/E if present). Be specific, no hype, NO investment advice. Example: "NVDA $920, +2.1%, near its 52-wk high, P/E 55 — priced for continued growth."

Return JSON only: {"reads":{"<SYMBOL>":"<one sentence>", ...}}

Data:
${JSON.stringify(facts)}`;
      try {
        const res = await routeAIRequest({ task: "categorize", prompt, jsonMode: true, maxTokens: 2048 });
        aiCallsMade = 1;
        aiTokensUsed = (res.inputTokens || 0) + (res.outputTokens || 0);
        let cleaned = res.content.trim();
        if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
        const reads = JSON.parse(cleaned)?.reads ?? {};
        const today = new Date().toISOString().split("T")[0];
        for (const e of enriched) {
          const text = reads[e.symbol];
          if (typeof text !== "string" || !text.trim()) continue;
          await supabase
            .from("ticker_data")
            .update({ interpretation: text.trim(), interpretation_prompt_version: MARKET_READ_PROMPT_VERSION })
            .eq("user_id", userId)
            .eq("symbol", e.symbol)
            .eq("fetched_date", today);
          interpretedCount++;
        }
      } catch (err) {
        console.error(`[enrich] NL market read failed:`, (err as Error).message);
      }
    }

    const executionTime = Date.now() - startTime;
    if (run?.id) {
      await supabase.from("pipeline_runs").update({
        status: "completed",
        items_processed: symbols.length,
        items_created: enrichedCount,
        items_failed: failedCount,
        ai_calls_made: aiCallsMade,
        ai_tokens_used: aiTokensUsed,
        duration_ms: executionTime,
        completed_at: new Date().toISOString(),
        metadata: {
          source: "finnhub+coingecko+alpaca",
          enriched: enrichedCount,
          intraday: intradayCount,
          interpreted: interpretedCount,
          dropped_over_cap: dropped,
          ai_tokens_used: aiTokensUsed,
        },
      }).eq("id", run.id);
    }

    return NextResponse.json({
      tickersAttempted: symbols.length,
      enriched: enrichedCount,
      failed: failedCount,
      intraday: intradayCount,
      interpreted: interpretedCount,
      droppedOverCap: dropped,
      executionTimeMs: executionTime,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    if (run?.id) {
      await supabase.from("pipeline_runs").update({
        status: "failed", error_message: err.message,
        duration_ms: Date.now() - startTime, completed_at: new Date().toISOString(),
      }).eq("id", run.id);
    }
    console.error(`[Enrich] Pipeline failed: ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
