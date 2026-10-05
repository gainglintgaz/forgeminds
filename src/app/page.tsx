import Link from "next/link";
import {
  Brain,
  Search,
  PenTool,
  TrendingUp,
  Shield,
  ArrowRight,
  Sparkles,
  Network,
  Target,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

function FeatureCard({
  icon: Icon,
  title,
  description,
  color,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-primary/30 hover:shadow-lg">
      <CardContent className="p-6">
        <div
          className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${color}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="mb-2 text-lg font-semibold tracking-tight">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}

export default async function LandingPage() {
  // Auth-aware landing: if the user is already signed in, the CTAs route
  // straight into the app instead of forcing them through login again.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAuthed = !!user;

  // Where each CTA should route based on auth state.
  const ctaPrimary = isAuthed ? "/dashboard" : "/signup";   // "Start Free", pricing primary CTAs
  const ctaSecondary = isAuthed ? "/dashboard" : "/login";  // "Sign In" header link
  const headerPrimaryLabel = isAuthed ? "Open Dashboard" : "Get Started";
  const headerSecondaryLabel = isAuthed ? user?.email ?? "Account" : "Sign In";

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold tracking-tight">ForgeMinds</span>
          </div>
          <nav className="hidden items-center gap-6 md:flex">
            <Link href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Features
            </Link>
            <Link href="#how-it-works" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              How It Works
            </Link>
            <Link href="#pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Pricing
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href={ctaSecondary} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              {headerSecondaryLabel}
            </Link>
            <Link href={isAuthed ? "/dashboard" : "/signup"} className={cn(buttonVariants({ size: "sm" }))}>
              {headerPrimaryLabel} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
        </div>

        <Badge variant="secondary" className="mb-6">
          <Sparkles className="mr-1.5 h-3 w-3" />
          Not another news reader
        </Badge>

        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          Your Intelligence,{" "}
          <span className="text-primary">Amplified</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          ForgeMinds reads the market, learns your mind, and helps you act.
          Collect knowledge from any source. Let AI score and curate what matters
          to <em>you</em>. Then turn insight into action — blog posts, social
          content, investment plans, podcast scripts — all in your voice.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href={ctaPrimary} className={cn(buttonVariants({ size: "lg" }))}>
            {isAuthed ? "Open Dashboard" : "Start Free"} <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
          <Link href="#how-it-works" className={cn(buttonVariants({ size: "lg", variant: "outline" }))}>
            See How It Works
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          {isAuthed ? "Welcome back." : "Free tier. No credit card required. Cancel anytime."}
        </p>
      </section>

      {/* The Story: Not Just Read — Act */}
      <section id="how-it-works" className="border-t bg-card/30 px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <Badge variant="secondary" className="mb-4">
              <Network className="mr-1.5 h-3 w-3" />
              The Full Loop
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              From Noise to Knowledge to Action
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Other tools stop at reading. ForgeMinds takes you through the
              entire intelligence cycle — and learns what works for you.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-5">
            {[
              { step: "1", label: "Discover", desc: "RSS, APIs, social — scored by AI against YOUR interests", color: "bg-primary/10 text-primary" },
              { step: "2", label: "Understand", desc: "Dot Connector links new intel to your past research", color: "bg-primary/10 text-primary" },
              { step: "3", label: "Archive", desc: "Save to Brain. Nothing important is ever lost or forgotten", color: "bg-insight/10 text-insight" },
              { step: "4", label: "Create", desc: "Blog posts, social, podcasts — written in YOUR voice", color: "bg-insight/10 text-insight" },
              { step: "5", label: "Grow", desc: "Track outcomes. System learns. Gets smarter every day", color: "bg-growth/10 text-growth" },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold ${item.color}`}>
                  {item.step}
                </div>
                <h3 className="mb-1 font-semibold">{item.label}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Built for People Who Act on What They Learn
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Whether you are growing a business, improving your health,
              deepening a hobby, or building a side hustle — ForgeMinds turns
              scattered information into structured progress.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard icon={Brain} title="Knowledge Base + Long Memory" description="Save anything to your Brain. Semantic search finds it months later. The Dot Connector resurfaces forgotten research when today's news makes it relevant again." color="bg-primary/10 text-primary" />
            <FeatureCard icon={PenTool} title="Voice DNA" description="Connect your blog or upload writing samples. ForgeMinds learns your style — sentence length, tone, vocabulary. Generated content sounds like you wrote it." color="bg-insight/10 text-insight" />
            <FeatureCard icon={Target} title="Action Engine" description="Every insight comes with 'Here is what to do about it.' Action plans matched to your goals. Trust escalation lets the system earn autonomy over time." color="bg-insight/10 text-insight" />
            <FeatureCard icon={TrendingUp} title="Investment Signals" description="Real-time market data, ticker enrichment, professional charts. Actionable analysis with your risk tolerance in mind." color="bg-growth/10 text-growth" />
            <FeatureCard icon={Search} title="Multi-Model Intelligence" description="Five AI models, each where it is strongest. Gemini for speed. Grok for social context. Claude for depth. Costs drop as the system learns you." color="bg-primary/10 text-primary" />
            <FeatureCard icon={Shield} title="Your Data, Your Brain" description="Export everything anytime. Anonymized collective insights help everyone while your personal data stays private. GDPR and CCPA compliant by design." color="bg-muted text-muted-foreground" />
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="border-t bg-card/30 px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">One Platform, Your Way</h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">ForgeMinds adapts to how you think, work, and create.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              { title: "Freelancers and Consultants", desc: "Turn industry news into client outreach. Track trends in your niche. Auto-draft proposals when opportunities surface." },
              { title: "Content Creators", desc: "Curated inspiration becomes blog posts, podcast scripts, and social threads — all in your voice, ready to publish." },
              { title: "Investors and Traders", desc: "Multi-source market intelligence with real data. Watchlists, sentiment analysis, and action plans — not just headlines." },
              { title: "Lifelong Learners", desc: "Whether it is health, spirituality, sports analytics, or a new hobby — build a knowledge base that compounds and connects." },
            ].map((uc) => (
              <Card key={uc.title} className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardContent className="p-6">
                  <h3 className="mb-2 font-semibold">{uc.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{uc.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Simple Pricing. Real Value.</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">Start free. Upgrade when ForgeMinds proves its worth.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="border-border/50">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold">Explorer</h3>
                <div className="mt-2 mb-4">
                  <span className="text-3xl font-bold">$0</span>
                  <span className="text-muted-foreground">/mo</span>
                </div>
                <p className="mb-6 text-sm text-muted-foreground">Feel the value. 3 briefs per week, 1 topic, 3 sources.</p>
                <Link href={ctaPrimary} className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
                  {isAuthed ? "Open Dashboard" : "Start Free"}
                </Link>
                <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
                  <li>3 intelligence briefs per week</li>
                  <li>1 topic, 3 sources</li>
                  <li>30-day read-only archive</li>
                  <li>Keyword search</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="relative border-primary/50 shadow-lg">
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most Popular</Badge>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold">Builder</h3>
                <div className="mt-2 mb-4">
                  <span className="text-3xl font-bold">$14.99</span>
                  <span className="text-muted-foreground">/mo</span>
                </div>
                <p className="mb-6 text-sm text-muted-foreground">The working professional. Create, publish, grow.</p>
                <Link href={ctaPrimary} className={cn(buttonVariants(), "w-full")}>
                  {isAuthed ? "Open Dashboard" : "Start Building"}
                </Link>
                <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
                  <li>Unlimited briefs</li>
                  <li>10 topics, 25 sources</li>
                  <li>Full Knowledge Base + Dot Connector</li>
                  <li>Content creation + Draftpad</li>
                  <li>Voice DNA (web upload)</li>
                  <li>Semantic search</li>
                  <li>1-year archive</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold">Architect</h3>
                <div className="mt-2 mb-4">
                  <span className="text-3xl font-bold">$34.99</span>
                  <span className="text-muted-foreground">/mo</span>
                </div>
                <p className="mb-6 text-sm text-muted-foreground">Full autonomy. Deep research. Unlimited power.</p>
                <Link href={ctaPrimary} className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
                  {isAuthed ? "Open Dashboard" : "Go Architect"}
                </Link>
                <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
                  <li>Everything in Builder</li>
                  <li>Unlimited topics and sources</li>
                  <li>Trust Escalation (auto-publish)</li>
                  <li>Deep research on demand</li>
                  <li>Investment signals</li>
                  <li>Collective Brain priority</li>
                  <li>Permanent archive</li>
                  <li>API access</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <span className="font-semibold">ForgeMinds</span>
          </div>
          <p className="text-sm text-muted-foreground">Built by VictorForge. Your intelligence, amplified.</p>
        </div>
      </footer>
    </div>
  );
}
