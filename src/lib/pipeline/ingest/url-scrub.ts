/**
 * url-scrub.ts — API-key-leak prevention for fetch-request URLs and
 * fetch-error strings (H1 fix 6, docs/architecture/curation-hardening-vra.md
 * §7 assumption 10).
 *
 * Strips the VALUE of any `token=`, `apikey=`, `api_key=`, `key=`, or
 * `secret=` query parameter before a string is logged or persisted — e.g.
 * `sources.last_error`, `pipeline_runs.metadata.*_error`. Applied at the 4
 * finance ingest fetchers (finnhub.ts, benzinga.ts, alpha-vantage.ts) and
 * market-data.ts's 3 `token=` call sites (quote/profile2/metric). Alpaca is
 * EXPLICITLY EXEMPT — its key travels via HTTP headers, never a URL, so this
 * function has nothing to scrub there (verified by the permanent grep
 * tripwire in scripts/verify-alpaca-header-auth.ts: alpaca.ts's catch block
 * never serializes headers into a logged string).
 *
 * NEVER apply this to `raw_articles.url` — that's a legitimate published
 * article link that could coincidentally carry an unrelated `?token=`
 * reader-auth param belonging to the PUBLISHER, not ForgeMinds. Scope is
 * strictly fetch-request URLs and fetch-error strings.
 *
 * No backfill needed (architecture §7 assumption 11): `sources.last_error`
 * has never been written to before H1, so this is purely forward-looking
 * prevention, not a redaction of existing leaked data.
 */

const SENSITIVE_PARAM_RE = /\b(token|apikey|api_key|key|secret)=([^&\s"'`]+)/gi;

export function scrubUrl(input: string | null | undefined): string {
  if (!input) return input ?? "";
  return input.replace(SENSITIVE_PARAM_RE, (_match, param: string) => `${param}=[REDACTED]`);
}
