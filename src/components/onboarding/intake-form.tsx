"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const PLACEHOLDER = `e.g. I'm a clinician interested in oncology breakthroughs and clinical trial readouts. I want depth, not headlines — peer-reviewed sources are great. Daily updates are fine. I also want to keep up with monetary policy at a global level (Fed, ECB, BoJ) — willing to pay for FT or Bloomberg if it's worth it.`;

const MIN_LENGTH = 30;

export function IntakeForm() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = description.trim().length < MIN_LENGTH;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (tooShort || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/onboarding/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim() }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        setError(data.error ?? `Server returned ${response.status}`);
        setSubmitting(false);
        return;
      }

      // Hand off to /refine — the page reads proposals from
      // source_suggestions for the current user.
      router.push("/onboarding/refine");
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={PLACEHOLDER}
        rows={8}
        className="text-base"
        disabled={submitting}
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          {description.trim().length} / {MIN_LENGTH} chars minimum
        </p>
        <Button type="submit" disabled={tooShort || submitting} size="lg">
          {submitting ? "Thinking…" : "Find me sources"}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t generate proposals</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}
