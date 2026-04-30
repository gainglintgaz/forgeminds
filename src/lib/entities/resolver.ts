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
}

// Singleton instance for the pipeline
let resolverInstance: EntityResolver | null = null;

export function getResolver(): EntityResolver {
  if (!resolverInstance) {
    resolverInstance = new EntityResolver();
  }
  return resolverInstance;
}
