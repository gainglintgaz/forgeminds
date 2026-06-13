"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AiOutputDisclaimer } from "@/components/ai/ai-output-disclaimer";
import { LENS_OPTIONS } from "@/lib/actions/lenses";
import type {
  ActDepth,
  ActFlavor,
  AiOutputMeta,
  AnalyzeDepth,
  AnalyzeLens,
  AnalyzeStance,
  DraftLength,
  DraftPlatform,
  DraftStance,
} from "@/lib/actions/types";

/**
 * The wired feed actions (Phase 1): Save / Analyze / Draft / Act, each with a per-click
 * selector bar so a single click = "use my defaults" and changing a chip = override
 * (VIBE Rule 55, not-one-size-fits-all). All AI output renders inside AiOutputDisclaimer
 * (the source-traceable, grounding-gated wrapper). Replaces the disabled placeholder buttons.
 *
 * Rule 56: the structured selector controls are the sanctioned Phase-1 fallback;
 * conversational config ("draft this for Reddit, casual, facts only") is tracked for Phase 2.
 */

type Panel = "analyze" | "draft" | "act" | null;
type SaveState = "idle" | "saving" | "saved" | "already" | "error";
interface AiResult {
  output: string;
  meta: AiOutputMeta;
}

const DEPTHS = [
  { value: "brief", label: "Brief" },
  { value: "standard", label: "Standard" },
  { value: "deep", label: "Deep" },
];
const ANALYZE_STANCES = [
  { value: "facts_only", label: "Facts only" },
  { value: "facts_plus_opinion", label: "Facts + opinion" },
];
const PLATFORMS = [
  { value: "x", label: "X" },
  { value: "reddit", label: "Reddit" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "generic", label: "Generic" },
];
const LENGTHS = [
  { value: "short", label: "Short" },
  { value: "standard", label: "Standard" },
  { value: "long", label: "Long" },
];
const DRAFT_STANCES = [
  { value: "facts_only", label: "Facts only" },
  { value: "facts_plus_analysis", label: "Facts + analysis" },
  { value: "facts_plus_opinion", label: "Facts + opinion" },
];
const TONES = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "analytical", label: "Analytical" },
  { value: "conversational", label: "Conversational" },
  { value: "investigative", label: "Investigative" },
];
const FLAVORS = [
  { value: "research", label: "Research brief" },
  { value: "plan", label: "Action plan" },
  { value: "draft_brief", label: "Content brief" },
  { value: "code_kickoff", label: "Code kickoff" },
];

const selectClass =
  "h-8 rounded-lg border border-zinc-200 bg-transparent px-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300";
const inputClass =
  "h-8 rounded-lg border border-zinc-200 bg-transparent px-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-zinc-500">
      <span>{label}</span>
      {children}
    </label>
  );
}

async function callAction<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const detail = (json.detail as string) || (json.error as string) || `Request failed (${res.status})`;
    throw new Error(detail);
  }
  return json as T;
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "forgeminds-brief";
}

export function ArticleActions({ articleId }: { articleId: string }) {
  const [panel, setPanel] = useState<Panel>(null);

  // Save
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Analyze config + result
  const [aLens, setALens] = useState<AnalyzeLens>("key_facts");
  const [aCustom, setACustom] = useState("");
  const [aDepth, setADepth] = useState<AnalyzeDepth>("standard");
  const [aStance, setAStance] = useState<AnalyzeStance>("facts_only");
  const [analyzeResult, setAnalyzeResult] = useState<AiResult | null>(null);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // Draft config + result
  const [dPlatform, setDPlatform] = useState<DraftPlatform>("x");
  const [dTone, setDTone] = useState("professional");
  const [dLength, setDLength] = useState<DraftLength>("standard");
  const [dStance, setDStance] = useState<DraftStance>("facts_only");
  const [dHashtags, setDHashtags] = useState(true);
  const [draftResult, setDraftResult] = useState<(AiResult & { draftId: string; status: string }) | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Act config + result
  const [actFlavor, setActFlavor] = useState<ActFlavor>("research");
  const [actTarget, setActTarget] = useState("generic LLM");
  const [actDepth, setActDepth] = useState<ActDepth>("standard");
  const [actResult, setActResult] = useState<(AiResult & { planId: string; title: string }) | null>(null);
  const [actLoading, setActLoading] = useState(false);
  const [actError, setActError] = useState<string | null>(null);

  function togglePanel(p: Exclude<Panel, null>) {
    setPanel((cur) => (cur === p ? null : p));
  }

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard?.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      /* clipboard unavailable — no-op; button stays "Copy" */
    }
  }

  async function handleSave() {
    setSaveState("saving");
    setSaveError(null);
    try {
      const r = await callAction<{ alreadySaved?: boolean }>("/api/actions/save", { articleId });
      setSaveState(r.alreadySaved ? "already" : "saved");
    } catch (e) {
      setSaveError((e as Error).message);
      setSaveState("error");
    }
  }

  async function handleAnalyze() {
    setAnalyzeLoading(true);
    setAnalyzeError(null);
    try {
      const r = await callAction<AiResult>("/api/actions/analyze", {
        articleId,
        overrides: { lens: aLens, depth: aDepth, stance: aStance, custom_lens: aLens === "custom" ? aCustom : null },
      });
      setAnalyzeResult({ output: r.output, meta: r.meta });
      setPanel(null);
    } catch (e) {
      setAnalyzeError((e as Error).message);
    } finally {
      setAnalyzeLoading(false);
    }
  }

  async function handleDraft() {
    setDraftLoading(true);
    setDraftError(null);
    try {
      const r = await callAction<AiResult & { draftId: string; status: string }>("/api/actions/draft", {
        articleId,
        overrides: { platform: dPlatform, tone: dTone, length: dLength, stance: dStance, hashtags: dHashtags },
      });
      setDraftResult({ output: r.output, meta: r.meta, draftId: r.draftId, status: r.status });
      setPanel(null);
    } catch (e) {
      setDraftError((e as Error).message);
    } finally {
      setDraftLoading(false);
    }
  }

  async function handleApprove() {
    if (!draftResult) return;
    setApproving(true);
    setDraftError(null);
    try {
      const r = await callAction<{ status: string }>("/api/actions/draft/approve", { draftId: draftResult.draftId });
      setDraftResult({ ...draftResult, status: r.status });
    } catch (e) {
      setDraftError((e as Error).message);
    } finally {
      setApproving(false);
    }
  }

  async function handleAct() {
    setActLoading(true);
    setActError(null);
    try {
      const r = await callAction<AiResult & { planId: string; title: string }>("/api/actions/act", {
        articleId,
        overrides: { flavor: actFlavor, target: actTarget, depth: actDepth },
      });
      setActResult({ output: r.output, meta: r.meta, planId: r.planId, title: r.title });
      setPanel(null);
    } catch (e) {
      setActError((e as Error).message);
    } finally {
      setActLoading(false);
    }
  }

  const saveLabel =
    saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : saveState === "already" ? "Already saved ✓" : "Save to Brain";

  return (
    <div className="mt-4 space-y-3">
      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleSave}
          disabled={saveState === "saving" || saveState === "saved" || saveState === "already"}
        >
          {saveLabel}
        </Button>
        <Button size="sm" variant={panel === "analyze" ? "default" : "outline"} onClick={() => togglePanel("analyze")}>
          Analyze
        </Button>
        <Button size="sm" variant={panel === "draft" ? "default" : "outline"} onClick={() => togglePanel("draft")}>
          Draft Post
        </Button>
        <Button size="sm" variant={panel === "act" ? "default" : "outline"} onClick={() => togglePanel("act")}>
          Act / Hand to AI
        </Button>
      </div>
      {saveState === "error" && saveError && <p className="text-xs text-red-600">{saveError}</p>}

      {/* Analyze selector bar */}
      {panel === "analyze" && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
          <Field label="Lens">
            <select className={selectClass} value={aLens} onChange={(e) => setALens(e.target.value as AnalyzeLens)}>
              {LENS_OPTIONS.map((o) => (
                <option key={o.slug} value={o.slug}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          {aLens === "custom" && (
            <Field label="Your lens">
              <input
                className={inputClass}
                value={aCustom}
                placeholder="e.g. supply-chain risk"
                onChange={(e) => setACustom(e.target.value)}
              />
            </Field>
          )}
          <Field label="Depth">
            <select className={selectClass} value={aDepth} onChange={(e) => setADepth(e.target.value as AnalyzeDepth)}>
              {DEPTHS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Stance">
            <select className={selectClass} value={aStance} onChange={(e) => setAStance(e.target.value as AnalyzeStance)}>
              {ANALYZE_STANCES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Button size="sm" onClick={handleAnalyze} disabled={analyzeLoading}>
            {analyzeLoading ? "Analyzing…" : "Analyze"}
          </Button>
        </div>
      )}

      {/* Draft selector bar */}
      {panel === "draft" && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
          <Field label="Platform">
            <select className={selectClass} value={dPlatform} onChange={(e) => setDPlatform(e.target.value as DraftPlatform)}>
              {PLATFORMS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tone">
            <select className={selectClass} value={dTone} onChange={(e) => setDTone(e.target.value)}>
              {TONES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Length">
            <select className={selectClass} value={dLength} onChange={(e) => setDLength(e.target.value as DraftLength)}>
              {LENGTHS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Stance">
            <select className={selectClass} value={dStance} onChange={(e) => setDStance(e.target.value as DraftStance)}>
              {DRAFT_STANCES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Hashtags">
            <Switch checked={dHashtags} onCheckedChange={setDHashtags} />
          </Field>
          <Button size="sm" onClick={handleDraft} disabled={draftLoading}>
            {draftLoading ? "Drafting…" : "Draft"}
          </Button>
        </div>
      )}

      {/* Act selector bar */}
      {panel === "act" && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
          <Field label="Flavor">
            <select className={selectClass} value={actFlavor} onChange={(e) => setActFlavor(e.target.value as ActFlavor)}>
              {FLAVORS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Target">
            <input
              className={inputClass}
              value={actTarget}
              placeholder="e.g. Claude Code session"
              onChange={(e) => setActTarget(e.target.value)}
            />
          </Field>
          <Field label="Depth">
            <select className={selectClass} value={actDepth} onChange={(e) => setActDepth(e.target.value as ActDepth)}>
              {DEPTHS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Button size="sm" onClick={handleAct} disabled={actLoading}>
            {actLoading ? "Generating…" : "Generate brief"}
          </Button>
        </div>
      )}

      {/* Results */}
      {analyzeError && <p className="text-xs text-red-600">{analyzeError}</p>}
      {analyzeResult && (
        <AiOutputDisclaimer meta={analyzeResult.meta}>{analyzeResult.output}</AiOutputDisclaimer>
      )}

      {draftError && <p className="text-xs text-red-600">{draftError}</p>}
      {draftResult && (
        <div className="space-y-2">
          <AiOutputDisclaimer meta={draftResult.meta}>{draftResult.output}</AiOutputDisclaimer>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => copy("draft", draftResult.output)}>
              {copied === "draft" ? "Copied ✓" : "Copy"}
            </Button>
            {draftResult.status === "approved" ? (
              <span className="text-xs font-medium text-emerald-700">Approved ✓</span>
            ) : (
              <Button size="sm" onClick={handleApprove} disabled={approving}>
                {approving ? "Approving…" : "Approve"}
              </Button>
            )}
          </div>
        </div>
      )}

      {actError && <p className="text-xs text-red-600">{actError}</p>}
      {actResult && (
        <div className="space-y-2">
          <AiOutputDisclaimer meta={actResult.meta}>{actResult.output}</AiOutputDisclaimer>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => copy("act", actResult.output)}>
              {copied === "act" ? "Copied ✓" : "Copy"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                download(
                  `${slugify(actResult.title)}.md`,
                  `# ${actResult.title}\n\nSource: ${actResult.meta.source.label}` +
                    `${actResult.meta.source.url ? ` (${actResult.meta.source.url})` : ""}\n` +
                    `Model: ${actResult.meta.model} · ${actResult.meta.promptVersion}\n\n${actResult.output}\n`,
                  "text/markdown"
                )
              }
            >
              Export .md
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                download(
                  `${slugify(actResult.title)}.json`,
                  JSON.stringify(
                    {
                      title: actResult.title,
                      planId: actResult.planId,
                      output: actResult.output,
                      source: actResult.meta.source,
                      model: actResult.meta.model,
                      prompt_version: actResult.meta.promptVersion,
                      grounding: actResult.meta.grounding,
                    },
                    null,
                    2
                  ),
                  "application/json"
                )
              }
            >
              Export .json
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
