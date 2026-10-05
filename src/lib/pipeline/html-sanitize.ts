/**
 * html-sanitize.ts — server-side sanitizer for AI-generated brief HTML (review C-6).
 *
 * `briefs.summary_html` is produced by the LLM and rendered via
 * `dangerouslySetInnerHTML` on the dashboard AND embedded in delivery email. The
 * generate prompt asks for a tiny tag set ("<h2>, <p>, <ul>/<li>, no <script>, no
 * <style>, no inline styles") — but a prompt is a request, not a guarantee. One
 * prompt-injection-shaped source article could smuggle <script>/onerror/iframe into
 * every reader's dashboard (stored XSS). This strips everything outside an explicit
 * allowlist at the single persist choke point (generate route, before the UPDATE),
 * so every consumer (dashboard + email) reads already-safe HTML.
 *
 * We use the battle-tested `sanitize-html` (allowlist model) rather than a hand-rolled
 * stripper — HTML sanitization is a classic security footgun to reinvent (VIBE Rule 24,
 * reuse-before-build).
 */
import sanitizeHtml from "sanitize-html";

// The allowlist mirrors the generate prompt's declared tag set (headings, paragraphs,
// lists, inline emphasis, links) — nothing that can execute or restyle the page. Any
// tag/attribute not named here (script, style, iframe, img, on* handlers, inline
// `style`) is dropped; disallowed-tag CONTENTS for script/style are dropped too.
const BRIEF_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h2", "h3", "h4",
    "p", "br",
    "ul", "ol", "li",
    "strong", "em", "b", "i",
    "blockquote", "a",
  ],
  allowedAttributes: {
    a: ["href", "title"],
  },
  // Only linkable, non-executable schemes. `javascript:` (and data:) are dropped.
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: {},
  disallowedTagsMode: "discard",
  // Harden every surviving link (external, in email + dashboard).
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      rel: "noopener noreferrer nofollow",
      target: "_blank",
    }),
  },
};

/**
 * Return a sanitized copy of AI-generated brief HTML, safe to persist + render.
 * Non-string input yields "" (never throws — the caller persists this directly).
 */
export function sanitizeBriefHtml(html: string): string {
  if (typeof html !== "string" || html.length === 0) return "";
  return sanitizeHtml(html, BRIEF_SANITIZE_OPTIONS);
}
