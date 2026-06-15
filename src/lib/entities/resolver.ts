import { type SupabaseClient } from "@supabase/supabase-js";
import { ENTITY_BLACKLIST } from "./seed-data";
import type { ResolvedEntity } from "@/lib/types/entities";

const TICKER_LIMIT = 5;

// Canonical schema names (per ARCHITECTURE_NOTES Schema Canonical Names Reference):
//   entities.ticker_symbol  (NOT 'symbol')
//   entity_aliases.alias_text (NOT 'alias')

export class EntityResolver {
  private aliasMap: Map<string, ResolvedEntity> = new Map();
  private symbolMap: Map<string, ResolvedEntity> = new Map();
  private loaded = false;

  async load(supabase: SupabaseClient): Promise<void> {
    if (this.loaded) return;

    const { data: entities } = await supabase
      .from("entities")
      .select("id, name, type, ticker_symbol");

    const { data: aliases } = await supabase
      .from("entity_aliases")
      .select("entity_id, alias_text");

    if (!entities) return;

    for (const entity of entities) {
      const ticker: string | null = entity.ticker_symbol ?? null;
      const resolved: ResolvedEntity = {
        entityId: entity.id,
        symbol: ticker || "",
        name: entity.name,
        type: entity.type,
        matchedAlias: "",
      };

      if (ticker) {
        this.symbolMap.set(ticker.toUpperCase(), resolved);
        this.aliasMap.set(ticker.toLowerCase(), resolved);
      }
      this.aliasMap.set(entity.name.toLowerCase(), resolved);
    }

    if (aliases) {
      for (const alias of aliases) {
        const aliasText: string = alias.alias_text;
        const entity = entities.find((e) => e.id === alias.entity_id);
        if (entity && !ENTITY_BLACKLIST.has(aliasText.toLowerCase())) {
          this.aliasMap.set(aliasText.toLowerCase(), {
            entityId: entity.id,
            symbol: entity.ticker_symbol || "",
            name: entity.name,
            type: entity.type,
            matchedAlias: aliasText,
          });
        }
      }
    }

    this.loaded = true;
  }

  resolve(text: string): ResolvedEntity[] {
    if (!text || !this.loaded) return [];

    const found = new Map<string, ResolvedEntity>();
    const textLower = text.toLowerCase();

    // 1. Explicit ticker patterns: $AAPL, NASDAQ:GOOG, NYSE:JPM
    const tickerMatches = text.match(/(?:\$|(?:NYSE|NASDAQ|AMEX)[:\s])([A-Z]{1,6})\b/g) || [];
    for (const match of tickerMatches) {
      const sym = match.replace(/[$\s]|(?:NYSE|NASDAQ|AMEX)[:\s]?/g, "").toUpperCase();
      const entity = this.symbolMap.get(sym);
      if (entity && !ENTITY_BLACKLIST.has(sym.toLowerCase())) {
        found.set(entity.entityId, { ...entity, matchedAlias: sym });
      }
    }

    // 2. Alias matches (longest first to avoid partial matches)
    const sortedAliases = [...this.aliasMap.keys()].sort((a, b) => b.length - a.length);
    for (const alias of sortedAliases) {
      if (alias.length < 3) continue;
      if (found.size >= TICKER_LIMIT) break;

      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "i");
      if (regex.test(textLower)) {
        const entity = this.aliasMap.get(alias)!;
        if (!found.has(entity.entityId)) {
          found.set(entity.entityId, { ...entity, matchedAlias: alias });
        }
      }
    }

    return Array.from(found.values()).slice(0, TICKER_LIMIT);
  }

  /**
   * Strict ticker resolution (lessons.md #105, VIBE Rule 24). A ticker SYMBOL is
   * a canonical market identifier — if it's a well-formed symbol we resolve to
   * the existing entity or CREATE one (the symbol IS the canonical key). Anything
   * that isn't a well-formed symbol returns null (flag/skip — never invent an
   * entity from ambiguous free text). Safe to call repeatedly (caches in maps).
   */
  async resolveOrCreateTicker(
    supabase: SupabaseClient,
    rawSymbol: string
  ): Promise<string | null> {
    const sym = (rawSymbol ?? "").trim().toUpperCase().replace(/^\$/, "");
    // Well-formed equity/crypto (AAPL, BTC) or index (^GSPC). Reject junk so a
    // hallucinated phrase never becomes an entity row.
    if (!/^\^?[A-Z]{1,6}$/.test(sym)) return null;
    if (ENTITY_BLACKLIST.has(sym.toLowerCase())) return null;

    const existing = this.symbolMap.get(sym);
    if (existing) return existing.entityId;

    const type: ResolvedEntity["type"] = CRYPTO_SYMBOLS.has(sym) ? "crypto" : "company";
    const { data, error } = await supabase
      .from("entities")
      .insert({ name: sym, type, ticker_symbol: sym })
      .select("id")
      .single();

    let entityId: string | null = data?.id ?? null;
    if (error) {
      // Race: another run created it first (unique ticker_symbol). Re-read.
      if (error.code === "23505") {
        const { data: row } = await supabase
          .from("entities")
          .select("id")
          .eq("ticker_symbol", sym)
          .maybeSingle();
        entityId = row?.id ?? null;
      } else {
        console.error(`[EntityResolver] create ${sym} failed: ${error.message}`);
        return null;
      }
    }
    if (!entityId) return null;

    const resolved: ResolvedEntity = { entityId, symbol: sym, name: sym, type, matchedAlias: sym };
    this.symbolMap.set(sym, resolved);
    this.aliasMap.set(sym.toLowerCase(), resolved);
    return entityId;
  }
}

// Common crypto symbols → create as type 'crypto' (everything else defaults to
// 'company'). Small on purpose; expand as the catalog grows.
const CRYPTO_SYMBOLS = new Set([
  "BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "BNB", "AVAX", "DOT", "MATIC", "LTC", "LINK",
]);

// Singleton instance for the pipeline
let resolverInstance: EntityResolver | null = null;

export function getResolver(): EntityResolver {
  if (!resolverInstance) {
    resolverInstance = new EntityResolver();
  }
  return resolverInstance;
}
