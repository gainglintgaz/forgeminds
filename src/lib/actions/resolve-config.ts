/**
 * resolveActionConfig — the load-bearing configuration contract (VIBE Rule 55).
 *
 * Three tiers merge into ONE resolved config, persisted on the run/draft/plan row
 * (the "what settings produced this" audit trait):
 *
 *   hardcoded safe defaults  ←  per-user saved defaults (user_preferences)  ←  per-click overrides
 *
 * The hardcoded defaults below are the resolver's tier-1 fallback AND are kept in
 * sync with the column DEFAULTs in migration 20260613000004. Reading user_preferences
 * with `select("*")` + per-field `??` makes the resolver work BEFORE the migration is
 * applied (missing columns → undefined → fallback) and after (DB defaults win).
 *
 * Every override value is validated against an allow-set before it is accepted — a bad
 * enum never reaches the DB (lesson #93: never guess/let through an enum value).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ActConfig,
  ActDepth,
  ActFlavor,
  AnalyzeConfig,
  AnalyzeDepth,
  AnalyzeLens,
  AnalyzeStance,
  DraftConfig,
  DraftLength,
  DraftPlatform,
  DraftStance,
  PlatformCap,
  SaveConfig,
} from "./types";

// ── Allow-sets (the anti-invention wall) ─────────────────────────────────
const ANALYZE_LENSES: AnalyzeLens[] = [
  "key_facts",
  "market_implications",
  "political_angle",
  "what_should_i_do",
  "risks",
  "explain_simply",
  "custom",
];
const ANALYZE_DEPTHS: AnalyzeDepth[] = ["brief", "standard", "deep"];
const ANALYZE_STANCES: AnalyzeStance[] = ["facts_only", "facts_plus_opinion"];
const DRAFT_PLATFORMS: DraftPlatform[] = ["x", "reddit", "facebook", "linkedin", "generic"];
const DRAFT_LENGTHS: DraftLength[] = ["short", "standard", "long"];
const DRAFT_STANCES: DraftStance[] = ["facts_only", "facts_plus_analysis", "facts_plus_opinion"];
const ACT_FLAVORS: ActFlavor[] = ["research", "plan", "draft_brief", "code_kickoff"];
const ACT_DEPTHS: ActDepth[] = ["brief", "standard", "deep"];

const DEFAULT_PLATFORM_CAPS: Record<string, PlatformCap> = {
  x: { max_chars: 280, hashtags_default: true },
  reddit: { max_chars: 4000, hashtags_default: false },
  facebook: { max_chars: 2000, hashtags_default: false },
  linkedin: { max_chars: 3000, hashtags_default: true },
  generic: { max_chars: 1000, hashtags_default: false },
};

export const DEFAULT_ANALYZE_CONFIG: AnalyzeConfig = {
  lens: "key_facts",
  depth: "standard",
  stance: "facts_only",
  custom_lens: null,
};
export const DEFAULT_DRAFT_CONFIG: DraftConfig = {
  platform: "x",
  tone: "professional",
  length: "standard",
  stance: "facts_only",
  hashtags: true,
  platform_caps: DEFAULT_PLATFORM_CAPS,
};
export const DEFAULT_ACT_CONFIG: ActConfig = {
  flavor: "research",
  target: "generic LLM",
  depth: "standard",
};
export const DEFAULT_SAVE_CONFIG: SaveConfig = { tags: [], note: null };

// ── helpers ──────────────────────────────────────────────────────────────
type Json = Record<string, unknown>;
function asObject(v: unknown): Json {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {};
}
function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}
function pickString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}
function pickBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}
function pickTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((t): t is string => typeof t === "string" && t.trim().length > 0).slice(0, 12);
}

async function loadPrefRow(supabase: SupabaseClient, userId: string): Promise<Json | null> {
  // select("*") tolerates columns that don't exist yet (pre-migration → simply absent).
  const { data } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as Json) ?? null;
}

// ── per-action resolvers ─────────────────────────────────────────────────
export async function resolveAnalyzeConfig(
  supabase: SupabaseClient,
  userId: string,
  overrides: Json
): Promise<AnalyzeConfig> {
  const prefs = await loadPrefRow(supabase, userId);
  const saved = asObject(prefs?.analyze_defaults);
  const lens = pick<AnalyzeLens>(
    overrides.lens ?? saved.lens,
    ANALYZE_LENSES,
    DEFAULT_ANALYZE_CONFIG.lens
  );
  const customRaw = overrides.custom_lens ?? saved.custom_lens;
  return {
    lens,
    depth: pick<AnalyzeDepth>(overrides.depth ?? saved.depth, ANALYZE_DEPTHS, DEFAULT_ANALYZE_CONFIG.depth),
    stance: pick<AnalyzeStance>(overrides.stance ?? saved.stance, ANALYZE_STANCES, DEFAULT_ANALYZE_CONFIG.stance),
    custom_lens: lens === "custom" && typeof customRaw === "string" ? customRaw.slice(0, 280) : null,
  };
}

export async function resolveDraftConfig(
  supabase: SupabaseClient,
  userId: string,
  overrides: Json
): Promise<DraftConfig> {
  const prefs = await loadPrefRow(supabase, userId);
  const saved = asObject(prefs?.draft_defaults);
  const caps = asObject(saved.platform_caps);
  const platformCaps: Record<string, PlatformCap> =
    Object.keys(caps).length > 0 ? (caps as unknown as Record<string, PlatformCap>) : DEFAULT_PLATFORM_CAPS;

  const platform = pick<DraftPlatform>(
    overrides.platform ?? saved.platform,
    DRAFT_PLATFORMS,
    DEFAULT_DRAFT_CONFIG.platform
  );

  // Tone REUSES social_tone (Rule 59 — no duplicate tone column). Override > saved social_tone > default.
  const tone = pickString(overrides.tone ?? prefs?.social_tone, DEFAULT_DRAFT_CONFIG.tone);

  // Hashtag default is per-platform DATA; an explicit override wins.
  const platformDefaultHashtags = platformCaps[platform]?.hashtags_default ?? DEFAULT_DRAFT_CONFIG.hashtags;
  const hashtags = pickBool(overrides.hashtags, pickBool(saved.hashtags, platformDefaultHashtags));

  return {
    platform,
    tone,
    length: pick<DraftLength>(overrides.length ?? saved.length, DRAFT_LENGTHS, DEFAULT_DRAFT_CONFIG.length),
    stance: pick<DraftStance>(overrides.stance ?? saved.stance, DRAFT_STANCES, DEFAULT_DRAFT_CONFIG.stance),
    hashtags,
    platform_caps: platformCaps,
  };
}

export async function resolveActConfig(
  _supabase: SupabaseClient,
  _userId: string,
  overrides: Json
): Promise<ActConfig> {
  // Rule 55: Act saved-defaults column is a tracked fast-follow; per-click overrides
  // ship full now, which is what makes Act not-one-size-fits-all in Phase 1.
  return {
    flavor: pick<ActFlavor>(overrides.flavor, ACT_FLAVORS, DEFAULT_ACT_CONFIG.flavor),
    target: pickString(overrides.target, DEFAULT_ACT_CONFIG.target).slice(0, 120),
    depth: pick<ActDepth>(overrides.depth, ACT_DEPTHS, DEFAULT_ACT_CONFIG.depth),
  };
}

export async function resolveSaveConfig(
  _supabase: SupabaseClient,
  _userId: string,
  overrides: Json
): Promise<SaveConfig> {
  const note = overrides.note;
  return {
    tags: pickTags(overrides.tags),
    note: typeof note === "string" && note.trim().length > 0 ? note.slice(0, 500) : null,
  };
}

/** Dispatcher form named in the design doc: resolveActionConfig(action, userId, overrides). */
export async function resolveActionConfig(
  action: "analyze",
  supabase: SupabaseClient,
  userId: string,
  overrides: Json
): Promise<AnalyzeConfig>;
export async function resolveActionConfig(
  action: "draft",
  supabase: SupabaseClient,
  userId: string,
  overrides: Json
): Promise<DraftConfig>;
export async function resolveActionConfig(
  action: "act",
  supabase: SupabaseClient,
  userId: string,
  overrides: Json
): Promise<ActConfig>;
export async function resolveActionConfig(
  action: "save",
  supabase: SupabaseClient,
  userId: string,
  overrides: Json
): Promise<SaveConfig>;
export async function resolveActionConfig(
  action: "analyze" | "draft" | "act" | "save",
  supabase: SupabaseClient,
  userId: string,
  overrides: Json
): Promise<AnalyzeConfig | DraftConfig | ActConfig | SaveConfig> {
  switch (action) {
    case "analyze":
      return resolveAnalyzeConfig(supabase, userId, overrides);
    case "draft":
      return resolveDraftConfig(supabase, userId, overrides);
    case "act":
      return resolveActConfig(supabase, userId, overrides);
    case "save":
      return resolveSaveConfig(supabase, userId, overrides);
  }
}
