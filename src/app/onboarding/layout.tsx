import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Onboarding wizard shell.
 *
 * Auth-gated like the dashboard — anonymous users get redirected to
 * /login. After signup (auth callback), new users SHOULD land here
 * before the dashboard so we can populate their `sources` table via
 * the conversational agent. Existing users with sources can skip.
 *
 * The progress indicator + cross-step navigation are delegated to
 * client components that consume the URL pathname (each step page is
 * its own route segment).
 */
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-3xl px-4 py-10 md:py-16">
        <header className="mb-10">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            ForgeMinds setup
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-3xl">
            Tell me what you want to follow
          </h1>
          <p className="mt-2 max-w-prose text-sm text-zinc-600 dark:text-zinc-400">
            Instead of asking you to paste a list of RSS URLs, I&apos;ll ask you
            what you care about and propose sources. You decide what makes
            it through.
          </p>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
