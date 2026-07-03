/**
 * test-html-sanitize.ts — unit test for the brief HTML sanitizer (review C-6).
 *
 * Brief HTML is AI-generated and rendered via dangerouslySetInnerHTML on the
 * dashboard AND emailed. Prompt rules alone are not a guarantee — one
 * prompt-injection-shaped article could inject <script>/onerror/etc. This gate
 * strips everything outside a tiny allowlist at the persist choke point.
 *
 * Convention: tsx-runnable script with node:assert (the project has no unit
 * runner). Run: npx tsx scripts/test-html-sanitize.ts
 */
import assert from "node:assert/strict";
import { sanitizeBriefHtml } from "../src/lib/pipeline/html-sanitize";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failed++;
    console.log(`  [FAIL] ${name}\n         ${(err as Error).message.split("\n").join("\n         ")}`);
  }
}

console.log("test-html-sanitize: brief HTML sanitizer\n");

test("strips <script> tags and their contents", () => {
  const out = sanitizeBriefHtml('<p>ok</p><script>alert("xss")</script>');
  assert.ok(!/script/i.test(out), out);
  assert.ok(!/alert/.test(out), out);
  assert.ok(out.includes("ok"), out);
});

test("strips <style> tags and their contents", () => {
  const out = sanitizeBriefHtml("<style>body{display:none}</style><p>hi</p>");
  assert.ok(!/style/i.test(out), out);
  assert.ok(out.includes("hi"), out);
});

test("strips inline event handlers (onclick/onerror)", () => {
  const out = sanitizeBriefHtml('<p onclick="steal()">hi</p>');
  assert.ok(!/onclick/i.test(out), out);
  assert.ok(out.includes("hi"), out);
});

test("strips inline style attributes", () => {
  const out = sanitizeBriefHtml('<p style="position:fixed">t</p>');
  assert.ok(!/style=/i.test(out), out);
  assert.ok(out.includes("t"), out);
});

test("removes <iframe> entirely", () => {
  const out = sanitizeBriefHtml('<iframe src="https://evil.example"></iframe><p>x</p>');
  assert.ok(!/iframe/i.test(out), out);
});

test("removes <img> with onerror (img not in allowlist)", () => {
  const out = sanitizeBriefHtml('<img src="x" onerror="alert(1)"><p>x</p>');
  assert.ok(!/onerror/i.test(out), out);
  assert.ok(!/<img/i.test(out), out);
});

test("drops javascript: hrefs but keeps the link text", () => {
  const out = sanitizeBriefHtml('<a href="javascript:alert(1)">click</a>');
  assert.ok(!/javascript:/i.test(out), out);
  assert.ok(out.includes("click"), out);
});

test("keeps safe https links with href", () => {
  const out = sanitizeBriefHtml('<a href="https://example.com/x">src</a>');
  assert.ok(/href="https:\/\/example\.com\/x"/.test(out), out);
  assert.ok(out.includes("src"), out);
});

test("preserves the allowed brief tag set + text", () => {
  const html =
    "<h2>Today</h2><p>Markets <strong>rose</strong> and <em>fell</em>.</p><ul><li>A</li><li>B</li></ul>";
  const out = sanitizeBriefHtml(html);
  for (const frag of ["<h2>", "Today", "<p>", "<strong>", "rose", "<em>", "<ul>", "<li>", "A", "B"]) {
    assert.ok(out.includes(frag), `expected ${frag} in: ${out}`);
  }
});

test("null/empty input returns empty string, never throws", () => {
  assert.equal(sanitizeBriefHtml(""), "");
  // @ts-expect-error — exercise the runtime guard against non-string null input
  assert.equal(sanitizeBriefHtml(null), "");
  // @ts-expect-error — exercise the runtime guard against undefined input
  assert.equal(sanitizeBriefHtml(undefined), "");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("[OK] all assertions passed");
