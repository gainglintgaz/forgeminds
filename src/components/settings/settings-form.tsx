"use client";

import { useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

/**
 * Editable Settings (design doc §R2.2). A form over the EXISTING user_preferences columns —
 * no new schema. Posts the whole form to /api/settings, which validates + partial-applies.
 * Per VIBE Rule 55 these knobs already live in the DB; this is the promised "form over existing
 * schema", not a rewrite. Source management + conversational config stay Phase 1b.
 */

export interface SettingsValues {
  timezone: string;
  cadence_minutes: number;
  active_hours_start: number;
  active_hours_end: number;
  active_days: string[];
  recency_window_minutes: number;
  score_lookback_minutes: number;
  min_composite_score: number;
  max_articles_per_brief: number;
  max_per_category: number;
  max_per_entity: number;
  weight_relevance: number;
  weight_impact: number;
  weight_novelty: number;
  weight_credibility: number;
  delivery_email: boolean;
  delivery_push: boolean;
  auto_generate_content: boolean;
  social_platforms: string[];
  social_tone: string;
  topics: string[];
  excluded_topics: string[];
  tracked_tickers: string[];
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const TONES = ["professional", "casual", "analytical", "conversational", "investigative"];

const inputClass =
  "h-8 w-full rounded-lg border border-zinc-200 bg-transparent px-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300";

export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const [form, setForm] = useState<SettingsValues>(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  function set<K extends keyof SettingsValues>(field: K, value: SettingsValues[K]) {
    setForm((f) => ({ ...f, [field]: value }));
    setSavedAt(null);
  }
  function num<K extends keyof SettingsValues>(field: K, raw: string) {
    set(field, Number(raw) as unknown as SettingsValues[K]);
  }

  async function handleSave() {
    setSaving(true);
    setErrors([]);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = (await res.json().catch(() => ({}))) as { details?: string[]; error?: string };
      if (!res.ok) {
        setErrors(json.details ?? [json.error ?? `Save failed (${res.status})`]);
        return;
      }
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e) {
      setErrors([(e as Error).message]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline schedule</CardTitle>
          <CardDescription>When and how often your news pipeline runs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row label="Timezone">
            <input
              className={inputClass}
              value={form.timezone}
              onChange={(e) => set("timezone", e.target.value)}
              placeholder="America/New_York"
            />
          </Row>
          <Row label="Cadence (minutes)">
            <input type="number" min={5} max={10080} className={inputClass} value={form.cadence_minutes} onChange={(e) => num("cadence_minutes", e.target.value)} />
          </Row>
          <Row label="Active hours (start–end, 0–23)">
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={23} className={inputClass} value={form.active_hours_start} onChange={(e) => num("active_hours_start", e.target.value)} />
              <span className="text-zinc-400">–</span>
              <input type="number" min={0} max={23} className={inputClass} value={form.active_hours_end} onChange={(e) => num("active_hours_end", e.target.value)} />
            </div>
          </Row>
          <Row label="Active days">
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d) => {
                const on = form.active_days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() =>
                      set("active_days", on ? form.active_days.filter((x) => x !== d) : [...form.active_days, d])
                    }
                    className={
                      "rounded-md border px-2 py-1 text-xs capitalize transition-colors " +
                      (on ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 text-zinc-600 hover:bg-zinc-100")
                    }
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </Row>
        </CardContent>
      </Card>

      {/* Windows */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline windows</CardTitle>
          <CardDescription>How far back each step looks, and the score floor for the brief.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row label="Recency window (minutes)">
            <input type="number" min={1} className={inputClass} value={form.recency_window_minutes} onChange={(e) => num("recency_window_minutes", e.target.value)} />
          </Row>
          <Row label="Score lookback (minutes)">
            <input type="number" min={1} className={inputClass} value={form.score_lookback_minutes} onChange={(e) => num("score_lookback_minutes", e.target.value)} />
          </Row>
          <Row label="Min composite score (0–1)">
            <input type="number" min={0} max={1} step={0.05} className={inputClass} value={form.min_composite_score} onChange={(e) => num("min_composite_score", e.target.value)} />
          </Row>
        </CardContent>
      </Card>

      {/* Density */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Brief density</CardTitle>
          <CardDescription>How big and diverse each brief is.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row label="Max articles per brief">
            <input type="number" min={1} max={200} className={inputClass} value={form.max_articles_per_brief} onChange={(e) => num("max_articles_per_brief", e.target.value)} />
          </Row>
          <Row label="Max per category">
            <input type="number" min={1} max={100} className={inputClass} value={form.max_per_category} onChange={(e) => num("max_per_category", e.target.value)} />
          </Row>
          <Row label="Max per entity">
            <input type="number" min={1} max={100} className={inputClass} value={form.max_per_entity} onChange={(e) => num("max_per_entity", e.target.value)} />
          </Row>
        </CardContent>
      </Card>

      {/* Scoring weights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scoring weights</CardTitle>
          <CardDescription>Your per-user ranking knobs (≥ 0).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row label="Relevance">
            <input type="number" min={0} step={0.05} className={inputClass} value={form.weight_relevance} onChange={(e) => num("weight_relevance", e.target.value)} />
          </Row>
          <Row label="Impact">
            <input type="number" min={0} step={0.05} className={inputClass} value={form.weight_impact} onChange={(e) => num("weight_impact", e.target.value)} />
          </Row>
          <Row label="Novelty">
            <input type="number" min={0} step={0.05} className={inputClass} value={form.weight_novelty} onChange={(e) => num("weight_novelty", e.target.value)} />
          </Row>
          <Row label="Credibility">
            <input type="number" min={0} step={0.05} className={inputClass} value={form.weight_credibility} onChange={(e) => num("weight_credibility", e.target.value)} />
          </Row>
        </CardContent>
      </Card>

      {/* Delivery + content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Delivery &amp; content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row label="Email digests">
            <Switch checked={form.delivery_email} onCheckedChange={(v) => set("delivery_email", v)} />
          </Row>
          <Row label="Push notifications">
            <Switch checked={form.delivery_push} onCheckedChange={(v) => set("delivery_push", v)} />
          </Row>
          <Row label="Auto-generate content">
            <Switch checked={form.auto_generate_content} onCheckedChange={(v) => set("auto_generate_content", v)} />
          </Row>
          <Row label="Social tone">
            <select className={inputClass} value={form.social_tone} onChange={(e) => set("social_tone", e.target.value)}>
              {(TONES.includes(form.social_tone) ? TONES : [form.social_tone, ...TONES]).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Social platforms">
            <ChipEditor items={form.social_platforms} placeholder="add platform" onChange={(v) => set("social_platforms", v)} />
          </Row>
        </CardContent>
      </Card>

      {/* Tracking */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Topics &amp; tickers</CardTitle>
          <CardDescription>Add or remove what you track.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row label="Topics">
            <ChipEditor items={form.topics} placeholder="add topic" onChange={(v) => set("topics", v)} />
          </Row>
          <Row label="Tracked tickers">
            <ChipEditor items={form.tracked_tickers} placeholder="add ticker" upper onChange={(v) => set("tracked_tickers", v)} />
          </Row>
          <Row label="Excluded topics">
            <ChipEditor items={form.excluded_topics} placeholder="add exclusion" onChange={(v) => set("excluded_topics", v)} />
          </Row>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="sticky bottom-4 flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          {savedAt && <span className="text-emerald-700">Saved ✓ {savedAt}</span>}
          {errors.length > 0 && (
            <ul className="list-disc pl-5 text-xs text-red-600">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[200px_1fr] items-center gap-4">
      <span className="text-sm text-zinc-500">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function ChipEditor({
  items,
  onChange,
  placeholder,
  upper,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  upper?: boolean;
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const t = (upper ? draft.toUpperCase() : draft).trim();
    if (!t || items.includes(t)) {
      setDraft("");
      return;
    }
    onChange([...items, t]);
    setDraft("");
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 && <span className="text-xs text-zinc-400">none yet</span>}
        {items.map((it) => (
          <Badge key={it} variant="secondary" className="gap-1">
            {it}
            <button type="button" onClick={() => onChange(items.filter((x) => x !== it))} className="text-zinc-400 hover:text-zinc-700" aria-label={`Remove ${it}`}>
              ×
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className={inputClass}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" size="sm" variant="outline" onClick={add}>
          Add
        </Button>
      </div>
    </div>
  );
}
