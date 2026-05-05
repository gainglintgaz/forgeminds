/**
 * verify-columns.ts — schema-drift static analysis
 *
 * Stringly-typed Supabase queries (`.from("foo").select("a, b, c")`) escape
 * TypeScript entirely. The Phase 0 audit (2026-04-29) found 6 broken API routes
 * that compiled cleanly but referenced columns that didn't exist on the live
 * schema. This script is the mechanical fix for that class of bug.
 *
 * What it does:
 *   1. Walks `src/` and extracts every `.from("table").select("col, col, ...")`
 *      invocation (handles single quotes, double quotes, template literals,
 *      multi-line .select chains, and `.update({ ... })` / `.insert({ ... })`
 *      object literals where keys are column names).
 *   2. Queries Supabase's `information_schema.columns` via service role for
 *      every public table; builds a {table → Set<column>} map.
 *   3. Cross-checks each (table, column) pair. Reports every mismatch with
 *      file:line.
 *   4. Exits non-zero if any mismatch is found.
 *
 * Usage:
 *   npx tsx scripts/verify-columns.ts
 *
 * Notes:
 *   - Reference column names like `"*"`, `"count"`, `"created_at"` are
 *     understood. `"*"` is always allowed; aggregate functions like
 *     `count(*)` are skipped.
 *   - Aliases (`col:other_col`) are normalized to `other_col`.
 *   - Embedded selects (`column ( inner )`) are split: the outer
 *     name must match the schema; the inner selects are resolved against the
 *     embedded relationship's table when possible (best-effort: if we can't
 *     resolve, we skip the inner block — better to under-report than block
 *     a legitimate join).
 */

import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync, statSync } from "fs";
import { resolve, join, relative } from "path";

// ── env loader (same pattern as verify-db.ts) ─────────────────────────
function loadEnvLocal() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (key && value && !process.env[key]) process.env[key] = value;
    }
  } catch (err) {
    console.error("⚠ Could not read .env.local:", (err as Error).message);
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── walk src/ and collect candidate query call sites ──────────────────
type CallSite = {
  file: string;
  line: number;
  table: string;
  columns: string[];
  kind: "select" | "insert" | "update" | "upsert";
};

const SRC_ROOT = resolve(process.cwd(), "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(full, out);
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

// Captures `.from("table")` — `.select` and `.insert`/`.update`/`.upsert` are
// scanned globally below and attached to the nearest preceding `.from()`.
const FROM_RE = /\.from\(\s*["'`]([a-zA-Z_][a-zA-Z0-9_]*)["'`]\s*\)/g;

function lineOfOffset(src: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < src.length; i++) {
    if (src.charCodeAt(i) === 10) line++;
  }
  return line;
}

function parseSelectColumns(raw: string): string[] {
  // Strip whitespace and embedded relationship blocks for the top level.
  // For the outer scan we only care about top-level identifiers.
  const cols: string[] = [];
  let depth = 0;
  let buf = "";
  for (const ch of raw) {
    if (ch === "(") {
      depth++;
      buf += ch;
    } else if (ch === ")") {
      depth--;
      buf += ch;
    } else if (ch === "," && depth === 0) {
      const c = buf.trim();
      if (c) cols.push(c);
      buf = "";
    } else {
      buf += ch;
    }
  }
  const last = buf.trim();
  if (last) cols.push(last);

  return cols
    .map((c) => {
      // Strip embedded join: "ticker_symbols ( inner )" → "ticker_symbols"
      const parenIdx = c.indexOf("(");
      const head = parenIdx === -1 ? c : c.slice(0, parenIdx).trim();
      // Strip alias: "alias:real_name" → "real_name"
      const colonIdx = head.indexOf(":");
      const name = colonIdx === -1 ? head : head.slice(colonIdx + 1).trim();
      // Strip ! modifier (Supabase relationship hint): "rel!fk_name"
      const bangIdx = name.indexOf("!");
      const clean = bangIdx === -1 ? name : name.slice(0, bangIdx).trim();
      return clean.trim();
    })
    .filter(Boolean);
}

/**
 * Extract TOP-LEVEL object keys from a balanced `{ ... }` literal body.
 *
 * Naive regex matchers flatten nested objects (e.g. `{ metadata: { rss_ok: 1 } }`
 * yields both `metadata` AND `rss_ok` as keys). The schema only cares about
 * top-level columns; nested keys live inside jsonb columns and are app-defined.
 *
 * Strategy: walk the body character-by-character, track brace depth, and only
 * emit identifiers immediately followed by `:` when depth === 0. Skips strings,
 * template literals, and single/multi-line comments.
 */
function extractObjectKeys(body: string): string[] {
  const keys: string[] = [];
  let i = 0;
  let depth = 0;
  let parenDepth = 0;
  let bracketDepth = 0;
  const n = body.length;

  while (i < n) {
    const ch = body[i];

    // string literals — skip until closing quote
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i++;
      while (i < n && body[i] !== quote) {
        if (body[i] === "\\") i++; // skip escaped char
        i++;
      }
      i++;
      continue;
    }

    // line comment
    if (ch === "/" && body[i + 1] === "/") {
      while (i < n && body[i] !== "\n") i++;
      continue;
    }
    // block comment
    if (ch === "/" && body[i + 1] === "*") {
      i += 2;
      while (i < n && !(body[i] === "*" && body[i + 1] === "/")) i++;
      i += 2;
      continue;
    }

    if (ch === "{") {
      depth++;
      i++;
      continue;
    }
    if (ch === "}") {
      depth--;
      i++;
      continue;
    }
    if (ch === "(") {
      parenDepth++;
      i++;
      continue;
    }
    if (ch === ")") {
      parenDepth--;
      i++;
      continue;
    }
    if (ch === "[") {
      bracketDepth++;
      i++;
      continue;
    }
    if (ch === "]") {
      bracketDepth--;
      i++;
      continue;
    }

    // Only consider top-level keys: depth === 0 (relative to the body) AND
    // not inside nested parens/brackets (those are computed values or arrays).
    if (depth === 0 && parenDepth === 0 && bracketDepth === 0) {
      // unquoted identifier key: `\b ident \s* :`
      const idMatch = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(body.slice(i));
      if (idMatch) {
        const after = i + idMatch[0].length;
        // skip whitespace
        let j = after;
        while (j < n && /\s/.test(body[j])) j++;
        if (body[j] === ":") {
          keys.push(idMatch[0]);
          i = j + 1;
          continue;
        }
      }
    }

    i++;
  }
  return Array.from(new Set(keys));
}

// Global-scan regexes: collect every .from(), every .select(), every
// .insert/.update/.upsert in the whole file. Then attach each operation to
// the NEAREST PRECEDING .from() — that matches actual Supabase chain semantics
// (within a single chain there's only one .from()).
const SELECT_GLOBAL_RE =
  /\.select\(\s*(?:`([^`]*)`|"([^"]*)"|'([^']*)')(?:\s*,\s*\{[^}]*\})?\s*\)/g;

// MUTATE_RE only catches the `.insert(` / `.update(` / `.upsert(` token + the
// opening `{`. The full balanced body is extracted by walkBalancedBraces below.
const MUTATE_GLOBAL_RE = /\.(insert|update|upsert)\(\s*\{/g;

/**
 * Given a position in `src` immediately AFTER an opening `{`, walk forward
 * until the matching `}`. Returns the body between (exclusive of braces),
 * or null if no matching brace was found.
 *
 * Tracks string/template/comment context so braces inside them don't count.
 */
function walkBalancedBraces(src: string, startInsideBrace: number): string | null {
  let depth = 1;
  let i = startInsideBrace;
  const n = src.length;
  while (i < n && depth > 0) {
    const ch = src[i];

    // strings
    if (ch === '"' || ch === "'" || ch === "`") {
      const q = ch;
      i++;
      while (i < n && src[i] !== q) {
        if (src[i] === "\\") i++;
        i++;
      }
      i++;
      continue;
    }
    // line comment
    if (ch === "/" && src[i + 1] === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    // block comment
    if (ch === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) return src.slice(startInsideBrace, i);
    }
    i++;
  }
  return null;
}

type FromMarker = { idx: number; table: string };

function nearestFrom(froms: FromMarker[], pos: number): FromMarker | null {
  // froms is sorted ascending by idx. Return the last one whose idx < pos.
  let lo = 0;
  let hi = froms.length - 1;
  let best: FromMarker | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (froms[mid].idx < pos) {
      best = froms[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

function scanFile(file: string): CallSite[] {
  const src = readFileSync(file, "utf-8");
  const out: CallSite[] = [];

  // Pass 1: collect every .from("table") position and table name
  const froms: FromMarker[] = [];
  FROM_RE.lastIndex = 0;
  let fm: RegExpExecArray | null;
  while ((fm = FROM_RE.exec(src)) !== null) {
    froms.push({ idx: fm.index, table: fm[1] });
  }
  if (froms.length === 0) return out;

  // Pass 2: every .select(...) — attach to nearest preceding .from()
  SELECT_GLOBAL_RE.lastIndex = 0;
  let sm: RegExpExecArray | null;
  while ((sm = SELECT_GLOBAL_RE.exec(src)) !== null) {
    const owner = nearestFrom(froms, sm.index);
    if (!owner) continue;
    const raw = sm[1] ?? sm[2] ?? sm[3] ?? "";
    const cols = parseSelectColumns(raw);
    if (cols.length === 0) continue;
    out.push({
      file,
      line: lineOfOffset(src, sm.index),
      table: owner.table,
      columns: cols,
      kind: "select",
    });
  }

  // Pass 3: every .insert/.update/.upsert({...}) — attach to nearest preceding .from()
  // Use brace-balanced walker so nested objects (jsonb metadata) don't truncate.
  MUTATE_GLOBAL_RE.lastIndex = 0;
  let mm: RegExpExecArray | null;
  while ((mm = MUTATE_GLOBAL_RE.exec(src)) !== null) {
    const owner = nearestFrom(froms, mm.index);
    if (!owner) continue;
    const kind = mm[1] as "insert" | "update" | "upsert";
    // mm[0] ends right after the opening `{`. Walk from there.
    const bodyStart = mm.index + mm[0].length;
    const body = walkBalancedBraces(src, bodyStart);
    if (body === null) continue; // unmatched braces — skip rather than misreport
    const keys = extractObjectKeys(body);
    if (keys.length === 0) continue;
    out.push({
      file,
      line: lineOfOffset(src, mm.index),
      table: owner.table,
      columns: keys,
      kind,
    });
  }

  return out;
}

// ── pull live schema ──────────────────────────────────────────────────
type SchemaMap = Map<string, Set<string>>;

async function loadLiveSchema(): Promise<SchemaMap> {
  const map: SchemaMap = new Map();
  // information_schema is exposed via PostgREST? No — query via RPC instead.
  // We use a tiny SQL passthrough: list_tables MCP isn't available here, so
  // use Supabase's `pg_meta`-equivalent: query `pg_tables` and `pg_attribute`
  // through a custom RPC OR fall back to the REST `information_schema` view.
  //
  // Easiest portable path: a one-shot SQL query via the management endpoint
  // is not available here. Instead, we issue a SELECT via PostgREST against
  // a tiny SQL function we expect to exist OR we walk migrations directory.
  //
  // Pragmatic approach: query each table's columns by selecting LIMIT 0 with
  // `*` and inspecting the returned shape. PostgREST returns the column list
  // in the response headers (via `Content-Range` / `Preferer: representation`)
  // but the JS SDK exposes it via `.select('*').limit(0)` returning an empty
  // array — to get column names we use a different trick: HEAD request + the
  // OPTIONS response's `Access-Control-Allow-Headers` does NOT include
  // columns. So we use `select=*&limit=0` but that doesn't give us names.
  //
  // Reliable path: rely on a SECURITY DEFINER SQL function we install once.
  // For now, fall back to issuing `select *` LIMIT 1 and reading keys of the
  // returned row (works only if at least one row exists).
  //
  // BETTER: use Supabase's RPC `pg_meta_columns` if available. It is not in
  // public projects by default. So we install a tiny helper if missing.

  // Strategy:
  //   1. Try an RPC `forgeminds_columns()` we'll create in a future migration.
  //   2. If absent, fall back to the `pg_catalog`-backed Supabase REST endpoint
  //      via the dashboard auth — not available here.
  //   3. Final fallback: per-table HEAD requests using PostgREST's
  //      `Prefer: count=exact` only confirms existence, not column list.
  //
  // For maximum portability without requiring a new migration, we read the
  // column list directly from the DB via the supabase-js SDK's
  // `rpc("forgeminds_columns")` helper if present, else FAIL LOUDLY with
  // a paste-able SQL snippet the user can run.

  const { data, error } = await supabase.rpc("forgeminds_columns");
  if (error || !data) {
    console.error(
      "\n❌ Schema introspection helper missing.\n" +
        "   Run this SQL in the Supabase SQL editor (one-time setup):\n\n" +
        "   create or replace function public.forgeminds_columns()\n" +
        "     returns table(table_name text, column_name text)\n" +
        "     language sql security definer set search_path = public\n" +
        "     as $$\n" +
        "       select c.table_name::text, c.column_name::text\n" +
        "       from information_schema.columns c\n" +
        "       where c.table_schema = 'public';\n" +
        "     $$;\n" +
        "   grant execute on function public.forgeminds_columns() to service_role;\n\n" +
        `   SDK error: ${error?.message ?? "no data returned"}\n`
    );
    process.exit(2);
  }

  for (const row of data as Array<{ table_name: string; column_name: string }>) {
    let set = map.get(row.table_name);
    if (!set) {
      set = new Set();
      map.set(row.table_name, set);
    }
    set.add(row.column_name);
  }
  return map;
}

// ── main ──────────────────────────────────────────────────────────────
const ALWAYS_OK = new Set(["*", "count", "exact", "head"]);

/**
 * Tables defined in committed migrations but not yet applied to the live
 * dev DB. Code referencing these is allowed — verify-columns warns
 * (visible in CI logs) but doesn't fail. Once the migration is applied,
 * the table appears in `forgeminds_columns()` output and the entry should
 * be removed from this list.
 *
 * If you add a table here, also add it to ARCHITECTURE_NOTES.md under
 * "Pending migrations" so the unblocking step is documented.
 */
const PENDING_MIGRATION_TABLES = new Set<string>([
  // 20260510000000_source_catalog.sql — APPLIED 2026-05-05 to ymgbjtgczgnooscigplb
  // 20260510000001_source_suggestions.sql — APPLIED 2026-05-05 to ymgbjtgczgnooscigplb
  "article_outcomes",    // 20260601000000_article_outcomes.sql (Phase 2 prep — not applied yet)
]);

async function main() {
  console.log("🔍 verify-columns: scanning src/ for Supabase query call sites…");
  const files = walk(SRC_ROOT);
  const sites: CallSite[] = [];
  for (const f of files) sites.push(...scanFile(f));
  console.log(`   ${sites.length} call sites across ${files.length} files`);

  console.log("🔍 verify-columns: loading live schema…");
  const schema = await loadLiveSchema();
  console.log(`   ${schema.size} public tables found`);

  let mismatches = 0;
  const reported: string[] = [];
  const pendingWarnings: string[] = [];

  for (const s of sites) {
    const cols = schema.get(s.table);
    if (!cols) {
      if (PENDING_MIGRATION_TABLES.has(s.table)) {
        pendingWarnings.push(
          `   ⚠ ${relative(process.cwd(), s.file)}:${s.line}  table "${s.table}" not in live schema (pending migration — allowed)`
        );
        continue;
      }
      mismatches++;
      reported.push(
        `   ✗ ${relative(process.cwd(), s.file)}:${s.line}  table "${s.table}" not found in schema`
      );
      continue;
    }
    for (const c of s.columns) {
      if (ALWAYS_OK.has(c)) continue;
      if (!cols.has(c)) {
        mismatches++;
        reported.push(
          `   ✗ ${relative(process.cwd(), s.file)}:${s.line}  ${s.kind}("${s.table}").${s.kind === "select" ? "select" : "object"} → "${c}" not a column of "${s.table}"`
        );
      }
    }
  }

  if (pendingWarnings.length > 0) {
    console.log(
      `   ${pendingWarnings.length} reference(s) to pending-migration tables — allowed:`
    );
    for (const w of pendingWarnings) console.log(w);
  }

  if (mismatches === 0) {
    console.log("✅ verify-columns: 0 mismatches — schema and code agree");
    return;
  }
  console.log("");
  console.log(`❌ verify-columns: ${mismatches} mismatch(es) found:`);
  for (const r of reported) console.log(r);
  console.log("");
  console.log("   Schema canonical names live in ARCHITECTURE_NOTES.md");
  process.exit(1);
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
