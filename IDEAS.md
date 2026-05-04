# ForgeMinds — Idea Backlog

Ideas raised but not yet committed to. Reviewed periodically. Each item has a verdict path: ADOPT, DEFER, REJECT.

Status legend:  🟢 ADOPT |  🟡 DEFER |  🔴 REJECT |  ⚪ UNDECIDED

---

## ⚪ Decision Journal (force users to write rationale before action)
When a user accepts an action plan, system asks: "What's your rationale? What outcome do you expect by [date]? When should we check in?" Stores in `user_decisions`. On the check-in date, system reminds and asks user to score the outcome. Builds metacognition AND high-quality outcome training data.

**Why interesting:** Users who write rationale before acting have better outcomes. The data is gold for the moat.
**Why deferred:** Adds friction. Test in Phase 4 with willing power users first.

---

## ⚪ Burnout Detection
If user dismisses ≥80% of suggestions for 7+ days, suggest scaling back: reduce density, suggest snooze, ask if interests changed.

**Why interesting:** Prevents silent churn.
**Why deferred:** Need ≥30 days of usage data per user to tune.

---

## ⚪ "Boring Mode" Toggle
User can flip a switch that strips hype words ("explosive", "game-changing", "supercharge") from all outputs. Opposite of social media tone.

**Why interesting:** Some users hate hype. Others love it. Let them choose.
**Why deferred:** Easy to add later. Low priority for V1.

---

## ⚪ Counterfactual / Backtest Replay
"What would have happened if you'd taken this action 30 days ago?" — show the actual price/outcome that materialized.

**Why interesting:** Builds calibration over time. Trust through evidence.
**Why deferred:** Requires solid action_template_runs history. Phase 6+.

---

## 🟡 Pre-mortem Mode (Hostile Architect on user plans)
Before user executes a build kick-off package, run a hostile critique pass: "Here's what could go wrong with this plan. Here are the failure modes."

**Why interesting:** Aligns with VictorForge Hostile Architect rule. Saves users from preventable mistakes.
**Status:** DEFER to Phase 4. Add as optional toggle in kickoff flow.

---

## ⚪ Subscriber-Owned Data Export Endpoint
Beyond the GDPR export, offer a continuous sync API: user can connect their own database/Notion/Obsidian and pipe their Brain there in real-time.

**Why interesting:** Builds trust. Some users want sovereignty.
**Why deferred:** Phase 6+. Premium feature.

---

## 🟡 "Who Else Is Acting On This" social proof
Anonymized: "12 other users in your profile cluster acted on this story; 7 reported positive outcomes."

**Why interesting:** Network effect made visible. Pushes hesitant users to act.
**Status:** DEFER until enough users for k-anonymity (~50 per cluster).

---

## ⚪ Action Chain Subscription
"Notify me whenever the data-center→home-buying pattern fires anywhere in my geographies" — user subscribes to event chain patterns directly.

**Why interesting:** Power-user feature. Specialized investors love this.
**Why deferred:** Phase 5+. Need event_chain_patterns library mature first.

---

## ⚪ Multi-User Brain Sharing (Family/Team Plan)
Spouse, business partner, family members can share a Brain. Anonymous "I saved this" indicators on items.

**Why interesting:** Family Architect tier. Couples planning together.
**Why deferred:** V2 product evolution. Validate single-user first.

---

## ⚪ Voice DNA Lending (consultants writing in client voice)
Consultant captures client's Voice DNA → uses ForgeMinds to draft content in client's voice. Premium consulting feature.

**Why interesting:** Massive consultant revenue lift.
**Why deferred:** Phase 6+. ToS implications need legal review.

---

## ⚪ Local Source Onboarding Wizard
First time user adds a Spartanburg geographic anchor, system asks: "Want me to find your local sources?" Auto-discovers local press, county feeds, school calendars, civic meetings.

**Why interesting:** Zero-effort local intelligence.
**Why deferred:** Requires source-discovery infrastructure (Phase 3-4).

---

## 🟡 Negative Results Library
"Things to NOT do based on outcomes" — anonymized. "Users who tried X with profile Y had bad outcomes 80% of the time."

**Why interesting:** Prevents repeat mistakes across user base.
**Status:** DEFER. Wait until enough negative outcome data exists (Phase 6+).

---

## ⚪ "The Other Side" Toggle
For controversial articles, system surfaces credible counterpoints automatically. Reduces echo chamber.

**Why interesting:** Differentiator from filter-bubble platforms.
**Why deferred:** Hard to do well. Quality of counterpoint sources matters.

---

## ⚪ Browser Extension for Save-to-Brain
Chrome/Firefox extension: "Save this article to my Brain" from any site. Auto-extracts entities, suggests tags.

**Why interesting:** Drives engagement when user is reading on the open web.
**Why deferred:** Phase 4+. Browser extensions have maintenance burden.

---

## ⚪ "Why this matters" inline explainer
Every entity name in the feed has a hover tooltip: "TSMC = Taiwan Semiconductor… makes 90% of world's advanced chips." For users learning a new domain.

**Why interesting:** Reduces friction for non-experts.
**Why deferred:** Wikidata-powered. Easy to add later.

---

## 🔴 Auto-Trade Execution (REJECTED)
Connect to Alpaca/Robinhood, execute trades based on Trust Escalation autonomy.

**Why rejected:** Regulatory risk (broker-dealer status), financial liability, ToS issues. ForgeMinds is research/analysis, NOT a broker. Hard line — never cross this.

---

## 🔴 LLM training on user's private Brain (REJECTED)
"Fine-tune your own private LLM on your Brain content."

**Why rejected:** Real LLM fine-tuning requires GPUs ForgeMinds doesn't have, costs to run inference, and creates compliance complexity (HIPAA, etc.). RAG over Brain content via embeddings achieves 95% of the value at 1% of the cost. Stick with RAG.

---

## Add new ideas below

## 🟢 [2026-04-29] Exa as primary grounded search backend
**Why:** Solves the "too much AI hallucination, not enough real links/prices" problem. Now natively integrated into Gemini via Vertex AI. Returns clean cited Markdown excerpts. Add to AI Router as `live_web_search` task with Perplexity as fallback.
**Status:** ADOPT in Phase 1 alongside the AI Router build.

## 🟢 [2026-04-29] Kimi K2.6 in AI Router (cost reduction)
**Why:** 80.2% SWE-Bench (Claude Opus is 80.8%) at 6x cheaper. Open source, Apache 2.0. Use for: high-volume content drafts, Build Kick-Off Package code generation, brief generation. Keep Claude Sonnet for the 15% of tasks needing deepest reasoning.
**Status:** ADOPT in Phase 1 model_routing_rules.

## 🟢 [2026-04-29] litellm as unified LLM proxy
**Why:** One API for 100+ models. Replaces individual provider SDKs (~70% less code). Includes load balancing, fallbacks, cost tracking. Battle-tested in production at major AI companies.
**Status:** ADOPT as the AI Router's transport layer in Phase 1.

## 🟢 [2026-04-29] Expired Patents → Build Opportunities action template
**Why:** USPTO publishes 4M+ expired patents publicly. Patents are detailed manufacturing instructions written in legal language nobody reads. Claude can score for commercial viability. Pair with Alibaba pricing + Amazon market-gap analysis. Pure ForgeMinds DNA — find what others miss.
**Status:** ADOPT as Phase 2 action template (`expired_patent_prospecting`). Could become a flagship marketing hook.

## 🟡 [2026-04-29] GBP Products section optimization template
**Why:** 98% of home service business GBPs leave the Products section empty. Underutilized SEO lever. Becomes a fast-win action template for SMB consultant clients (Builder/Architect tier).
**Status:** DEFER to Phase 2-3 once Action Engine is live.

## 🟡 [2026-04-29] Marketplace-as-action-vector pattern (Thumbtack model)
**Why:** Thumbtack/TaskRabbit are integrating with Claude as connectors. ForgeMinds could integrate with marketplaces too — e.g., "you saved a home reno article, here are local contractors." Same pattern for travel (booking sites), shopping (Amazon affiliate via PA-API), legal (LegalZoom).
**Status:** DEFER. Phase 4+ when Action Engine is mature.

## 🟡 [2026-04-29] markitdown + crawl4ai for article ingestion
**Why:** Cleaner extraction from PDFs, Word docs, complex web pages than naive scraping. Free, MIT-licensed, by Microsoft (markitdown) and an active open community (crawl4ai).
**Status:** ADOPT in Phase 1 ingest pipeline alongside the RSS parser.

## 🟡 [2026-04-29] playwright-mcp for BYOS paywall fetching
**Why:** Headless browser automation that respects user's logged-in session. Critical for "Bring Your Own Subscription" pattern (WSJ, NYT, Bloomberg). Avoids ToS issues since user is using their own access.
**Status:** ADOPT in Phase 2 BYOS feature.

## 🟡 [2026-04-29] dspy for programmatic prompt optimization
**Why:** Stanford NLP framework that auto-optimizes prompts based on outcomes. Replaces manual prompt engineering with systematic A/B testing. Pairs with our `prompt_outcomes` table for closed-loop optimization.
**Status:** DEFER to Phase 5+ once prompt_outcomes has enough data to optimize against.

## 🟡 [2026-04-29] Cloudflare Workers email migration plan
**Why:** Cloudflare Workers email = $5 + $0.35/1k vs Resend at $20/mo. Cheaper at scale. But Resend has React Email templates, free 3k tier, deliverability monitoring.
**Status:** DEFER. Trigger migration evaluation at 10k users or when monthly Resend bill exceeds $20.

## 🔴 [2026-04-29] Anthropic Creative Connectors (Blender/Adobe/Ableton)
**Why rejected:** Wrong product fit. ForgeMinds is intelligence/news/action, not creative tooling. The MCP connector pattern is interesting (we could become an MCP server later — see "ForgeMinds-as-MCP" idea), but the specific connectors don't apply.

## 🔴 [2026-04-29] $3K MCP Setup Business as ForgeMinds feature
**Why rejected as feature:** It's a CONSULTING SERVICE, not product feature. **However:** Victor's existing VictorForge consulting business should add this as an offering — bundle "ForgeMinds Architect tier ($34.99/mo) + MCP setup ($3,000 one-time) for client portfolio integration." Documented in DECISIONS.md.

## 🟡 [2026-04-29] ForgeMinds-as-MCP-Server (Brain access from Claude Code/Cursor)
**Why interesting:** Ship ForgeMinds as an MCP server itself. Users in Claude Code, Cursor, Codex, etc. can query their personal Brain ("@forgeminds find that article about Apple's chip strategy"). Massive distribution lever — every AI tool becomes an entry point to your Brain.
**Status:** DEFER to V1.5 or V2. Ship the web app first, then expose as MCP.

## 🟡 [2026-04-29] Successful Examples folder pattern (from Cowork article)
**Why interesting:** User uploads their best emails, posts, proposals to a `successful_examples/` folder. Voice DNA learns from wins, not just edit diffs. Better calibration of "what works for this user."
**Status:** ADOPT in Voice DNA design (Phase 4). Add `voice_examples` table later.

## 🟡 [2026-05-04] Source catalog visible on marketing landing as discovery preview
**Why interesting:** Marketing page could show a slider: "Pick your interests → see what ForgeMinds would suggest." Builds trust before signup; demonstrates the conversational agent without requiring auth.
**Status:** DEFER to Phase 10 productization or Phase 1.5 stretch goal. Don't block Phase 1.5 close on this.

## 🟡 [2026-05-04] LinkedIn-driven source suggestions (when user connects)
**Why interesting:** OAuth-import a user's LinkedIn profile (headline, industry, company, role) → AI agent uses that as priors. "I see you're VP Engineering at a fintech — here are sources VPs in fintech read."
**Status:** DEFER to Phase 9 (Watchers/Agents) or Phase 4 (Brain) — needs OAuth flow + LinkedIn API access (rate-limited; OAuth token refresh complexity).

## 🟡 [2026-05-04] Power-user "config-only mode" toggle
**Why interesting:** 5% of users WILL know exactly which RSS/API endpoints they want. Force them through the conversational agent and they bounce. Settings → "Config Mode" exposes raw form everywhere (sources, prefs, custom APIs).
**Status:** DEFER to Phase 1.5 or Phase 2. The "Add custom" fallback in /sources covers most of this; full config-mode is a stretch.

## 🟡 [2026-05-04] Multi-language source catalog
**Why interesting:** Phase 1.5 catalog starts English-only. Big markets (Spanish, Portuguese, Mandarin, Hindi, Arabic) have different source ecosystems. Catalog needs `language[]` filter + curator subagent runs per-language.
**Status:** DEFER to Phase 10. English-first for V1 launch; multi-language is internationalization work that fits productization timing.

## 🟡 [2026-05-04] OAuth-imported source bundles (Substack reading list, Feedly OPML, etc.)
**Why interesting:** Users with existing source tools (Feedly, Reeder, Substack) have hand-curated reading lists. Importing those during onboarding short-circuits the conversational discovery for power users.
**Status:** DEFER to Phase 1.5 stretch or Phase 2. Common formats: OPML (universal), Substack notes API, Feedly export.

## 🟡 [2026-05-04] Source quality score learning (community-driven)
**Why interesting:** Initial catalog `quality_score` is curated. Phase 8 (Community Brain) can learn it from save/dismiss patterns: high-save sources get higher quality, sources users dismiss en masse get lower.
**Status:** DEFER to Phase 8. Phase 1.5 ships with curated scores; Phase 8 makes them adaptive.

## 🟢 [2026-05-04] Agent-suggested action templates from source content
**Why interesting:** When a user adds a source about "biotech earnings," the agent can pre-suggest action templates ("track quarterly earnings → draft summary content"). Bridges Phase 1.5 source picking to Phase 3 action templates.
**Status:** ADOPT in Phase 3 design. Action templates should be discoverable via the same conversational interface used for sources.

## 🟡 [2026-05-04] Migrate Supabase project to Pro tier (before Phase 10 launch)
**Why required:** Several security + reliability features are Pro-only:
- **Leaked Password Protection** (HaveIBeenPwned check on signup/password change) — already failing the advisor scan today
- **Point-in-Time Recovery** (7-day rollback) — required by factory CLAUDE.md §5.1
- **Increased rate limits** + larger DB (1GB Free → 8GB Pro)
- **Daily off-platform pg_dump** is independent but harder to justify cost-wise on Free tier
**Cost:** $25/mo per project (compute scales separately).
**Status:** DEFER until just before Phase 10 multi-user launch (when first paying customers arrive). Tracked here so we don't forget it. Phase 10's verify checklist must include "Pro plan active" as a precondition.
