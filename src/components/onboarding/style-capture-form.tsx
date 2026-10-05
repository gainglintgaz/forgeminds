"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Tone = "concise" | "analytical" | "conversational" | "academic" | "investigative";
type Density = "telegraphic" | "paragraph" | "longform";

interface StyleAnchor {
  name: string;
  url?: string;
  why?: string;
  captured_at?: string;
}

interface Props {
  initialAnchors: StyleAnchor[];
  initialTone: string | null;
  initialDensity: string | null;
  alreadyCaptured: boolean;
}

const TONES: { value: Tone; label: string; hint: string }[] = [
  { value: "concise", label: "Concise", hint: "Tight sentences, low ceremony" },
  { value: "analytical", label: "Analytical", hint: "Numbers + structured reasoning" },
  { value: "conversational", label: "Conversational", hint: "Like a smart friend explaining" },
  { value: "academic", label: "Academic", hint: "Hedged, citation-heavy, careful" },
  { value: "investigative", label: "Investigative", hint: "Adversarial, names names, follows money" },
];

const DENSITIES: { value: Density; label: string; hint: string }[] = [
  { value: "telegraphic", label: "Telegraphic", hint: "Headlines + one-line summaries" },
  { value: "paragraph", label: "Paragraph", hint: "Standard reading — a paragraph per item" },
  { value: "longform", label: "Long-form", hint: "Multi-paragraph, full essay treatment" },
];

const MAX_ANCHORS = 5;
const MIN_ANCHORS = 3;

export function StyleCaptureForm({
  initialAnchors,
  initialTone,
  initialDensity,
  alreadyCaptured,
}: Props) {
  const router = useRouter();
  const [anchors, setAnchors] = useState<StyleAnchor[]>(
    initialAnchors.length > 0
      ? initialAnchors
      : [
          { name: "", url: "", why: "" },
          { name: "", url: "", why: "" },
          { name: "", url: "", why: "" },
        ]
  );
  const [tone, setTone] = useState<string>(initialTone ?? "");
  const [density, setDensity] = useState<string>(initialDensity ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateAnchor(i: number, field: keyof StyleAnchor, value: string) {
    setAnchors((prev) => prev.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)));
  }
  function addAnchor() {
    if (anchors.length >= MAX_ANCHORS) return;
    setAnchors((prev) => [...prev, { name: "", url: "", why: "" }]);
  }
  function removeAnchor(i: number) {
    if (anchors.length <= MIN_ANCHORS) return;
    setAnchors((prev) => prev.filter((_, idx) => idx !== i));
  }

  const filledAnchors = anchors.filter((a) => a.name.trim().length > 0);
  const canSubmit = filledAnchors.length >= MIN_ANCHORS && !!tone && !!density && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    const now = new Date().toISOString();
    const payload = {
      style_anchors: filledAnchors.map((a) => ({
        name: a.name.trim(),
        url: a.url?.trim() || undefined,
        why: a.why?.trim() || undefined,
        captured_at: now,
      })),
      style_tone: tone,
      style_density: density,
    };

    try {
      const res = await fetch("/api/onboarding/style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Save failed (${res.status})`);
      }
      router.push("/onboarding/confirm");
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Style anchors */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            Your style anchors
            <span className="ml-2 text-xs font-normal text-zinc-500">
              ({filledAnchors.length}/{MIN_ANCHORS}+ required, {MAX_ANCHORS} max)
            </span>
          </h2>
          <p className="text-sm text-zinc-500">
            Examples: <em>Matt Levine</em>, <em>Stratechery</em>, <em>The Pragmatic Engineer</em>,
            <em> Maggie Appleton</em>, <em>Patrick McKenzie</em>. Names you trust, not topics you follow.
          </p>
        </div>
        <ul className="space-y-3">
          {anchors.map((a, i) => (
            <li
              key={i}
              className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    placeholder="Name (writer / publication / blog)"
                    value={a.name}
                    onChange={(e) => updateAnchor(i, "name", e.target.value)}
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    required={i < MIN_ANCHORS}
                  />
                  <input
                    type="url"
                    placeholder="URL (optional)"
                    value={a.url ?? ""}
                    onChange={(e) => updateAnchor(i, "url", e.target.value)}
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  />
                  <input
                    type="text"
                    placeholder="What do you love about their style? (optional)"
                    value={a.why ?? ""}
                    onChange={(e) => updateAnchor(i, "why", e.target.value)}
                    maxLength={200}
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </div>
                {anchors.length > MIN_ANCHORS ? (
                  <button
                    type="button"
                    onClick={() => removeAnchor(i)}
                    className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        {anchors.length < MAX_ANCHORS ? (
          <button
            type="button"
            onClick={addAnchor}
            className="text-sm text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
          >
            + Add another
          </button>
        ) : null}
      </section>

      {/* Tone */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Tone</h2>
        <p className="text-sm text-zinc-500">Pick the voice that fits how you actually read.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {TONES.map((t) => (
            <label
              key={t.value}
              className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                tone === t.value
                  ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800"
                  : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
              }`}
            >
              <input
                type="radio"
                name="tone"
                value={t.value}
                checked={tone === t.value}
                onChange={(e) => setTone(e.target.value)}
                className="mt-0.5"
                required
              />
              <div>
                <div className="text-sm font-medium">{t.label}</div>
                <div className="text-xs text-zinc-500">{t.hint}</div>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Density */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Density</h2>
        <p className="text-sm text-zinc-500">How dense do you want each brief item?</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {DENSITIES.map((d) => (
            <label
              key={d.value}
              className={`flex cursor-pointer flex-col gap-1 rounded-md border p-3 transition-colors ${
                density === d.value
                  ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800"
                  : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="density"
                  value={d.value}
                  checked={density === d.value}
                  onChange={(e) => setDensity(e.target.value)}
                  required
                />
                <span className="text-sm font-medium">{d.label}</span>
              </div>
              <div className="text-xs text-zinc-500 pl-6">{d.hint}</div>
            </label>
          ))}
        </div>
      </section>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {alreadyCaptured ? (
        <p className="text-xs text-zinc-500">
          You captured these before — updating will overwrite the previous answers + reset
          the prompt_version tag on future briefs.
        </p>
      ) : null}

      <div className="flex items-center justify-between pt-2">
        <a
          href="/onboarding/refine"
          className="text-sm text-zinc-500 underline-offset-4 hover:underline"
        >
          ← Back
        </a>
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          {submitting ? "Saving…" : "Continue →"}
        </button>
      </div>
    </form>
  );
}
