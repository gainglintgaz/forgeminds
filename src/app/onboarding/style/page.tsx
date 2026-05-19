import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StyleCaptureForm } from "@/components/onboarding/style-capture-form";

/**
 * /onboarding/style — third step (Voice DNA capture).
 *
 * The user declares 3-5 style anchors (writers / blogs / publications
 * whose voice they want briefs to read LIKE), plus tone + density
 * preferences. Submission writes to user_preferences (style_anchors
 * jsonb, style_tone, style_density, style_captured_at). The brief
 * generator (src/lib/ai/prompts/generate-brief) reads these on every
 * Claude Haiku call as a styled instruction prefix.
 *
 * Why a separate step (not folded into intake): the catalog-driven
 * intake captures TOPICS; this step captures STYLE. They're different
 * inputs that the AI router weighs separately. Splitting also lets
 * future users come back to /onboarding/style to recalibrate without
 * re-running the whole intake.
 */
export default async function OnboardingStylePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Pre-load existing values so a user re-entering this step sees
  // their prior answers instead of an empty form.
  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("style_anchors, style_tone, style_density, style_captured_at")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white dark:bg-zinc-50 dark:text-zinc-900">
          3 of 4
        </span>
        <span className="text-xs uppercase tracking-wide text-zinc-500">
          Style anchors
        </span>
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          How do you want your briefs to read?
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Topics tell us what to cover. <strong>Style</strong> tells us how. Name a
          few writers, publications, or blogs whose voice you actually enjoy
          reading — your briefs will adapt toward that voice.
        </p>
      </div>
      <StyleCaptureForm
        initialAnchors={(prefs?.style_anchors as StyleAnchor[]) ?? []}
        initialTone={prefs?.style_tone ?? null}
        initialDensity={prefs?.style_density ?? null}
        alreadyCaptured={!!prefs?.style_captured_at}
      />
    </div>
  );
}

interface StyleAnchor {
  name: string;
  url?: string;
  why?: string;
  captured_at?: string;
}
