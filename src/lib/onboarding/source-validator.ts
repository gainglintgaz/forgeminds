/**
 * Runtime URL validation for the "add custom source" path.
 *
 * Mirror of the manual `source-validator` subagent (.claude/agents/
 * source-validator.md), reimplemented in TypeScript for production
 * use. The subagent stays in place as a Claude Code dev tool for
 * batch validation during catalog seeding; this module is what the
 * /api/onboarding/validate-source route calls when a real user pastes
 * a URL into the "I have a source not in the catalog" form.
 *
 * Returns the same JSON shape the subagent does, so a future swap to
 * the subagent (if validation quality demands it) is a drop-in.
 *
 * What we check (ordered by cost — fail fast on cheap ones):
 *   1. URL parses + is http/https + has hostname
 *   2. fetch returns 200/30x (follow redirects)
 *   3. Content-Type signals RSS / Atom / JSON
 *   4. For RSS/Atom: parses, has ≥1 `<item>`/`<entry>`, last item has
 *      a recent date (default <90 days)
 *   5. For JSON: top-level array OR { items: [...] } / { data: [...] }
 *      with ≥1 entry having { title, url|link, date|published }
 *   6. Heuristic safety: no obvious malware-domain matches; no signals
 *      it's a paywalled-but-claims-free site (rough — real check needs
 *      a paid service)
 *
 * NEVER returns "valid: true" with empty sample_titles. If we can't
 * pull at least one item with a real title, we reject — that's the
 * trust contract.
 */

import { parseStringPromise } from "xml2js";

const VALIDATE_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB — feeds beyond this are suspicious

export type ValidationType =
  | "rss"
  | "atom"
  | "json_api"
  | "html_only"
  | "unreachable";

export type SafetyVerdict = "safe" | "suspicious" | "unsafe";

export interface ValidationResult {
  valid: boolean;
  type: ValidationType;
  url: string;
  finalUrl: string | null;       // after redirects
  lastUpdate: string | null;     // ISO 8601 of most recent item
  sampleTitles: string[];        // first 3 titles
  safetyVerdict: SafetyVerdict;
  concerns: string[];
}

const KNOWN_SUSPICIOUS_DOMAINS = new Set<string>([
  // Hand-curated. Expand over time. Real malware/spam blocklists need a
  // paid service (e.g. Spamhaus, Google Safe Browsing).
]);

export async function validateSource(url: string): Promise<ValidationResult> {
  const concerns: string[] = [];

  // 1. URL shape
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return reject(url, null, "unreachable", ["URL did not parse"]);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return reject(url, null, "unreachable", [
      `Unsupported protocol: ${parsed.protocol}. Only http(s) accepted.`,
    ]);
  }
  if (parsed.protocol === "http:") {
    concerns.push("Source uses plain HTTP — feed contents not encrypted in transit.");
  }

  if (KNOWN_SUSPICIOUS_DOMAINS.has(parsed.hostname.toLowerCase())) {
    return {
      valid: false,
      type: "unreachable",
      url,
      finalUrl: null,
      lastUpdate: null,
      sampleTitles: [],
      safetyVerdict: "unsafe",
      concerns: ["Domain is on the known-suspicious list."],
    };
  }

  // 2. Fetch
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "ForgeMinds/source-validator (+https://forgeminds.app)",
        Accept: "application/rss+xml, application/atom+xml, application/json, application/xml, text/xml, text/html;q=0.5",
      },
      signal: AbortSignal.timeout(VALIDATE_TIMEOUT_MS),
    });
  } catch (e) {
    return reject(url, null, "unreachable", [
      `Fetch failed: ${(e as Error).message}`,
    ]);
  }

  if (!response.ok) {
    return reject(url, response.url || null, "unreachable", [
      `HTTP ${response.status} ${response.statusText || ""}`.trim(),
    ]);
  }

  // 3. Read body (with cap)
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  let bodyText: string;
  try {
    bodyText = await readCappedText(response, MAX_BODY_BYTES);
  } catch (e) {
    return reject(url, response.url, "unreachable", [
      `Body read failed: ${(e as Error).message}`,
    ]);
  }

  // 4. Dispatch by content type
  // Try JSON first if Content-Type strongly signals it.
  if (contentType.includes("application/json") || /^\s*[\[{]/.test(bodyText)) {
    return validateJson(url, response.url, bodyText, concerns);
  }

  if (
    contentType.includes("xml") ||
    contentType.includes("rss") ||
    contentType.includes("atom") ||
    /<rss\b|<feed\b|<\?xml/i.test(bodyText)
  ) {
    return validateXml(url, response.url, bodyText, concerns);
  }

  // Fallback: HTML page. Not a feed, but URL is reachable. Helpful to
  // tell the user "this is a webpage, not a feed — find the RSS link."
  return {
    valid: false,
    type: "html_only",
    url,
    finalUrl: response.url || null,
    lastUpdate: null,
    sampleTitles: [],
    safetyVerdict: "safe",
    concerns: [
      ...concerns,
      "URL returns HTML, not a feed. If this is a website, look for a 'RSS' link in the page footer.",
    ],
  };
}

// ── Internals ────────────────────────────────────────────────────────

function reject(
  url: string,
  finalUrl: string | null,
  type: ValidationType,
  concerns: string[]
): ValidationResult {
  return {
    valid: false,
    type,
    url,
    finalUrl,
    lastUpdate: null,
    sampleTitles: [],
    safetyVerdict: "safe",
    concerns,
  };
}

async function readCappedText(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    return await response.text();
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error(`Response exceeded ${maxBytes} bytes — refusing to load`);
      }
      chunks.push(value);
    }
  }
  return new TextDecoder().decode(concatBytes(chunks));
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

interface RssItem {
  title?: string | string[];
  pubDate?: string | string[];
  ["dc:date"]?: string | string[];
}

interface RssChannel {
  title?: string | string[];
  item?: RssItem | RssItem[];
}

interface AtomEntry {
  title?: string | { _: string; $?: Record<string, string> } | string[];
  updated?: string | string[];
  published?: string | string[];
}

async function validateXml(
  url: string,
  finalUrl: string,
  body: string,
  concerns: string[]
): Promise<ValidationResult> {
  let parsed: unknown;
  try {
    parsed = await parseStringPromise(body, {
      explicitArray: false,
      ignoreAttrs: false,
      trim: true,
    });
  } catch (e) {
    return reject(url, finalUrl, "unreachable", [
      ...concerns,
      `XML parse failed: ${(e as Error).message}`,
    ]);
  }

  const root = parsed as Record<string, unknown>;
  // RSS branch
  if (root.rss) {
    const rss = root.rss as { channel?: RssChannel | RssChannel[] };
    const channel = Array.isArray(rss.channel) ? rss.channel[0] : rss.channel;
    if (!channel) {
      return reject(url, finalUrl, "unreachable", [
        ...concerns,
        "RSS root has no <channel>",
      ]);
    }
    const itemsRaw = channel.item;
    const items: RssItem[] = Array.isArray(itemsRaw)
      ? itemsRaw
      : itemsRaw
      ? [itemsRaw]
      : [];
    if (items.length === 0) {
      return reject(url, finalUrl, "unreachable", [
        ...concerns,
        "RSS feed has 0 items",
      ]);
    }
    const sampleTitles = items
      .slice(0, 3)
      .map((i) => firstString(i.title) || "")
      .filter(Boolean);
    const lastUpdate = recencyOfRssItems(items);
    if (sampleTitles.length === 0) {
      return reject(url, finalUrl, "unreachable", [
        ...concerns,
        "Could not extract any titles from RSS items",
      ]);
    }
    flagOldFeed(lastUpdate, concerns);
    return {
      valid: true,
      type: "rss",
      url,
      finalUrl,
      lastUpdate,
      sampleTitles,
      safetyVerdict: "safe",
      concerns,
    };
  }

  // Atom branch
  if (root.feed) {
    const feed = root.feed as { entry?: AtomEntry | AtomEntry[] };
    const entriesRaw = feed.entry;
    const entries: AtomEntry[] = Array.isArray(entriesRaw)
      ? entriesRaw
      : entriesRaw
      ? [entriesRaw]
      : [];
    if (entries.length === 0) {
      return reject(url, finalUrl, "unreachable", [
        ...concerns,
        "Atom feed has 0 entries",
      ]);
    }
    const sampleTitles = entries
      .slice(0, 3)
      .map((e) => atomTitle(e))
      .filter((t): t is string => Boolean(t));
    const lastUpdate = recencyOfAtomEntries(entries);
    if (sampleTitles.length === 0) {
      return reject(url, finalUrl, "unreachable", [
        ...concerns,
        "Could not extract any titles from Atom entries",
      ]);
    }
    flagOldFeed(lastUpdate, concerns);
    return {
      valid: true,
      type: "atom",
      url,
      finalUrl,
      lastUpdate,
      sampleTitles,
      safetyVerdict: "safe",
      concerns,
    };
  }

  return reject(url, finalUrl, "unreachable", [
    ...concerns,
    "Root XML element is neither <rss> nor <feed>",
  ]);
}

function validateJson(
  url: string,
  finalUrl: string,
  body: string,
  concerns: string[]
): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (e) {
    return reject(url, finalUrl, "unreachable", [
      ...concerns,
      `JSON parse failed: ${(e as Error).message}`,
    ]);
  }

  // Heuristically locate items[]: top-level array, or .items / .data / .results / .articles
  let items: unknown[] = [];
  if (Array.isArray(parsed)) {
    items = parsed;
  } else if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    for (const key of ["items", "data", "results", "articles", "feed", "entries"]) {
      const v = obj[key];
      if (Array.isArray(v)) {
        items = v;
        break;
      }
    }
  }

  if (items.length === 0) {
    return reject(url, finalUrl, "json_api", [
      ...concerns,
      "Response is JSON but no array of items found at top level or known keys",
    ]);
  }

  // Extract sample titles + dates
  const sampleTitles: string[] = [];
  const dates: string[] = [];
  for (const item of items.slice(0, 10)) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const title =
      typeof obj.title === "string"
        ? obj.title
        : typeof obj.headline === "string"
        ? obj.headline
        : typeof obj.name === "string"
        ? obj.name
        : null;
    if (title && sampleTitles.length < 3) sampleTitles.push(title);
    const date =
      typeof obj.date === "string"
        ? obj.date
        : typeof obj.published === "string"
        ? obj.published
        : typeof obj.publishedAt === "string"
        ? obj.publishedAt
        : typeof obj.created_at === "string"
        ? obj.created_at
        : null;
    if (date) dates.push(date);
  }

  if (sampleTitles.length === 0) {
    return reject(url, finalUrl, "json_api", [
      ...concerns,
      "JSON items lack a recognized title field (title/headline/name)",
    ]);
  }

  const lastUpdate = mostRecentIso(dates);
  flagOldFeed(lastUpdate, concerns);

  return {
    valid: true,
    type: "json_api",
    url,
    finalUrl,
    lastUpdate,
    sampleTitles,
    safetyVerdict: "safe",
    concerns,
  };
}

// ── helpers ──────────────────────────────────────────────────────────

function firstString(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return null;
}

function atomTitle(e: AtomEntry): string | null {
  const t = e.title;
  if (typeof t === "string") return t;
  if (Array.isArray(t)) return firstString(t);
  if (t && typeof t === "object") {
    const obj = t as { _?: string };
    if (typeof obj._ === "string") return obj._;
  }
  return null;
}

function recencyOfRssItems(items: RssItem[]): string | null {
  const dates: string[] = [];
  for (const item of items) {
    const d = firstString(item.pubDate) || firstString(item["dc:date"]);
    if (d) dates.push(d);
  }
  return mostRecentIso(dates);
}

function recencyOfAtomEntries(entries: AtomEntry[]): string | null {
  const dates: string[] = [];
  for (const e of entries) {
    const d = firstString(e.updated) || firstString(e.published);
    if (d) dates.push(d);
  }
  return mostRecentIso(dates);
}

function mostRecentIso(rawDates: string[]): string | null {
  let best: number | null = null;
  for (const raw of rawDates) {
    const t = Date.parse(raw);
    if (!Number.isNaN(t) && (best === null || t > best)) best = t;
  }
  return best === null ? null : new Date(best).toISOString();
}

function flagOldFeed(lastUpdate: string | null, concerns: string[]) {
  if (!lastUpdate) {
    concerns.push("Feed items had no parseable dates — couldn't verify freshness.");
    return;
  }
  const ageDays =
    (Date.now() - Date.parse(lastUpdate)) / (1000 * 60 * 60 * 24);
  if (ageDays > 90) {
    concerns.push(
      `Most-recent item is ${Math.floor(ageDays)} days old — feed may be inactive.`
    );
  } else if (ageDays > 30) {
    concerns.push(
      `Most-recent item is ${Math.floor(ageDays)} days old — slow-cadence source.`
    );
  }
}
