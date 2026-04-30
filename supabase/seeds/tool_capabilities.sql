-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds — Tool Capabilities & Lessons Learned
-- ════════════════════════════════════════════════════════════════════
-- Honest registry of what tools can/can't do. Sourced from:
--   • VictorForge project lessons (HuntHive, FinKeel, ForgeDesk, etc.)
--   • Public documentation
--   • Community knowledge
--
-- Apply to ForgeMinds DB after main schema migration is complete.
-- This is NOT seed.sql for entities — it's tool intelligence.
-- ════════════════════════════════════════════════════════════════════

-- ─── AI Coding Tools ──────────────────────────────────────────────
insert into tool_capabilities (tool_name, category, capability_area, status, notes, workaround, cost_floor_cents, cost_ceiling_cents, cost_unit, setup_complexity, reliability_score, source) values

-- Claude Code
('Claude Code', 'ai_coding', 'multi_file_refactor', 'fully_supported',
 'Strong at multi-file changes when given clear context. 1M context window allows holding entire codebases.',
 null, 2000, 20000, 'monthly', 2, 9, 'official_docs'),

('Claude Code', 'ai_coding', 'web_scraping_complex_sites', 'workaround_required',
 'Cannot reliably scrape sites with bot detection (Amazon, Walmart, LinkedIn). Will produce code that "looks right" but fails in production.',
 'Use Apify, Browserbase, or paid official APIs (e.g., Amazon PA-API for affiliates). For LinkedIn, only use OAuth with user permission.',
 0, 0, 'monthly', 5, 4, 'vibe_lesson_hunthive'),

('Claude Code', 'ai_coding', 'hardware_design', 'not_supported',
 'Software-only tool. Cannot design PCBs, source components, or interface with manufacturing.',
 'Use as a partner for firmware code, but pair with Altium/KiCad and dedicated hardware engineers for the physical layer.',
 null, null, null, null, null, 'vibe_lesson_general'),

('Claude Code', 'ai_coding', 'live_trading_execution', 'forbidden',
 'Should NOT execute trades, transfers, or money movements without explicit per-action human approval.',
 'Always route money actions through user UI confirmation. Never auto-execute.',
 null, null, null, null, null, 'vibe_rule_safety'),

-- Cursor
('Cursor', 'ai_coding', 'in_editor_completion', 'fully_supported',
 'Best-in-class for in-editor tab completion and multi-cursor edits. Works with Claude/GPT/Gemini backends.',
 null, 2000, 4000, 'monthly', 1, 9, 'community'),

('Cursor', 'ai_coding', 'long_context_planning', 'partially_supported',
 'Less suited for multi-step planning across many files vs Claude Code. Better for tactical edits.',
 'Use Claude Code for architecture/planning, Cursor for typing-speed edits.',
 null, null, null, null, null, 'community'),

-- Lovable
('Lovable', 'ai_coding', 'rapid_v0_prototyping', 'fully_supported',
 'Fast for getting a working full-stack v0 (React + Supabase) shipped in hours.',
 null, 2000, 5000, 'monthly', 1, 7, 'vibe_lesson_hunthive'),

('Lovable', 'ai_coding', 'production_grade_complexity', 'workaround_required',
 'Generates code that works for v0 but accumulates technical debt fast at v1+ complexity. Migration to Cursor/Claude Code becomes painful.',
 'Use Lovable to validate concept, then migrate to a real codebase early (before 5+ features).',
 null, null, null, null, null, 'vibe_lesson_hunthive'),

-- v0 by Vercel
('v0', 'ai_coding', 'shadcn_ui_generation', 'fully_supported',
 'Excellent for one-off shadcn/ui components and full pages. Output is copy-paste ready.',
 null, 2000, 4000, 'monthly', 1, 9, 'official_docs'),

-- Codex / OpenAI
('Codex', 'ai_coding', 'general_coding', 'partially_supported',
 'Capable but trails Claude/Cursor on multi-file context handling as of 2026.',
 null, 2000, 20000, 'monthly', 2, 7, 'community');

-- ─── Web Scraping / Data Acquisition ──────────────────────────────
insert into tool_capabilities (tool_name, category, capability_area, status, notes, workaround, cost_floor_cents, cost_ceiling_cents, cost_unit, setup_complexity, reliability_score, source) values

('DIY Scraper (curl/cheerio)', 'scraping', 'amazon_pricing', 'forbidden',
 'Amazon actively blocks all scraping. Detection is sophisticated. Even with proxies, blocks cascade. ToS violation. Lawsuit risk for commercial use.',
 'Use Amazon Product Advertising API (PA-API 5.0) — requires affiliate program approval. OR pay Keepa ($16-50/mo) for product/price/history data.',
 0, 0, 'monthly', 9, 1, 'vibe_lesson_hunthive'),

('DIY Scraper (curl/cheerio)', 'scraping', 'walmart_pricing', 'forbidden',
 'Same as Amazon — bot detection, blocks, ToS issues. HuntHive learned this the painful way.',
 'No affiliate API. Workarounds: serpapi.com Walmart engine ($75/mo), or partnership with retailer data brokers.',
 0, 0, 'monthly', 9, 1, 'vibe_lesson_hunthive'),

('Apify', 'scraping', 'general_web_scraping', 'partially_supported',
 'Battle-tested actor library. Works for many sites including LinkedIn (with anti-detection). Compliance risk varies per target.',
 null, 4900, 49900, 'monthly', 4, 7, 'community'),

('Browserbase', 'scraping', 'authenticated_session_scraping', 'fully_supported',
 'Headless Chrome that can use logged-in sessions. Good for paywalled content the USER subscribes to.',
 null, 4000, 50000, 'monthly', 5, 8, 'community'),

('Firecrawl', 'scraping', 'public_web_pages', 'fully_supported',
 'Clean Markdown extraction for public pages. No auth-walled content. Generous free tier.',
 null, 0, 12900, 'monthly', 2, 9, 'community');

-- ─── AI Models ────────────────────────────────────────────────────
insert into tool_capabilities (tool_name, category, capability_area, status, notes, workaround, cost_floor_cents, cost_ceiling_cents, cost_unit, setup_complexity, reliability_score, source) values

('Claude Sonnet 4.5', 'ai_model', 'long_context_reasoning', 'fully_supported',
 '1M context with strong reasoning. Best for deep research, planning, and code analysis.',
 null, 300, null, 'per_token', 1, 9, 'official_docs'),

('Claude Haiku 3.5', 'ai_model', 'high_volume_summarization', 'fully_supported',
 'Cost-effective for summarization, classification, and routine generation.',
 null, 80, null, 'per_token', 1, 9, 'official_docs'),

('Gemini 2.0 Flash', 'ai_model', 'bulk_classification', 'fully_supported',
 'Cheapest reliable model for bulk article scoring/extraction. Strong JSON-mode adherence.',
 null, 8, null, 'per_token', 1, 8, 'official_docs'),

('Grok 3', 'ai_model', 'real_time_x_context', 'fully_supported',
 'Has real-time X (Twitter) data baked in. Best for "what is X talking about right now" questions.',
 null, 300, null, 'per_token', 1, 7, 'official_docs'),

('GPT-5', 'ai_model', 'general_reasoning', 'fully_supported',
 'Capable across categories. Often highest accuracy but priciest per token.',
 null, 250, null, 'per_token', 1, 9, 'community'),

('Perplexity Sonar', 'ai_model', 'live_web_research', 'fully_supported',
 'Live web search with citations. Best for "what is the current status of X" research.',
 null, 300, null, 'per_call', 1, 8, 'community'),

('OpenAI text-embedding-3-small', 'ai_model', 'semantic_search_embeddings', 'fully_supported',
 '1536-dim industry standard. Cheapest viable embedding for semantic search.',
 null, 2, null, 'per_token', 1, 9, 'official_docs');

-- ─── Hosting / Database ───────────────────────────────────────────
insert into tool_capabilities (tool_name, category, capability_area, status, notes, workaround, cost_floor_cents, cost_ceiling_cents, cost_unit, setup_complexity, reliability_score, source) values

('Vercel', 'hosting', 'nextjs_hosting', 'fully_supported',
 'Zero-config Next.js deployment. Cron Jobs, Functions, Fluid Compute for warm starts.',
 null, 0, 2000, 'monthly', 1, 9, 'official_docs'),

('Vercel', 'hosting', 'long_running_jobs', 'workaround_required',
 'Functions max out at 300s (Hobby) / 800s (Pro). Long jobs need queues.',
 'Use Vercel Workflow DevKit, Inngest, or Trigger.dev for durable workflows.',
 0, 2000, 'monthly', 3, 8, 'official_docs'),

('Supabase', 'database', 'postgres_hosting_with_rls', 'fully_supported',
 'Managed Postgres + RLS + auth + storage + pgvector. Strong for multi-tenant SaaS.',
 null, 0, 2500, 'monthly', 2, 9, 'official_docs'),

('Supabase', 'database', 'real_time_sub_100ms_global', 'partially_supported',
 'Single-region, latency varies for users far from US-East. Realtime works well within ~150ms.',
 'Use Cloudflare Workers + KV for sub-50ms reads of cached state at edge.',
 null, null, null, null, null, 'community'),

('Cloudflare Workers + D1', 'hosting', 'edge_global_hosting', 'fully_supported',
 'Globally distributed, free tier is generous. D1 (SQLite) limited to 10GB / DB.',
 null, 0, 500, 'monthly', 4, 8, 'official_docs'),

('AWS', 'hosting', 'general_purpose_hosting', 'fully_supported',
 'Most flexible but highest setup complexity and cost-of-ownership for solo founders.',
 'Default to Vercel/Supabase/Cloudflare unless AWS is specifically required (e.g., compliance).',
 0, 100000, 'monthly', 9, 9, 'community');

-- ─── Workflow / Automation ────────────────────────────────────────
insert into tool_capabilities (tool_name, category, capability_area, status, notes, workaround, cost_floor_cents, cost_ceiling_cents, cost_unit, setup_complexity, reliability_score, source) values

('Pipedream', 'workflow', 'simple_cron_workflows', 'fully_supported',
 'Excellent for quick cron + integration workflows. Memory limit (256MB) is the main constraint.',
 'Split heavy workflows. Or migrate to Vercel/Inngest/n8n at scale.',
 0, 3000, 'monthly', 2, 8, 'vibe_lesson_pipedream'),

('Pipedream', 'workflow', 'complex_long_running_workflows', 'workaround_required',
 'Hits 600s timeout and 256MB memory wall on complex flows.',
 'Migrate to native code on Vercel + Supabase, or split workflows.',
 null, null, null, null, null, 'vibe_lesson_pipedream'),

('n8n', 'workflow', 'self_hosted_workflows', 'fully_supported',
 'Open-source Zapier alternative. Self-host on $5-10/mo VPS for unlimited runs.',
 null, 500, 5000, 'monthly', 6, 8, 'community'),

('Inngest', 'workflow', 'durable_workflow_engine', 'fully_supported',
 'Code-first durable execution. Excellent for SaaS workflows that need crash-safety.',
 null, 0, 5000, 'monthly', 4, 9, 'community'),

('IFTTT', 'social_post', 'social_media_post_publishing', 'partially_supported',
 'Pro plan limits applies. Reliable for X and FB posting via webhook trigger.',
 'For higher volume use Buffer ($6+/mo) or Typefully ($19/mo).',
 0, 1300, 'monthly', 1, 7, 'community');

-- ─── MCP Servers ──────────────────────────────────────────────────
insert into tool_capabilities (tool_name, category, capability_area, status, notes, workaround, cost_floor_cents, cost_ceiling_cents, cost_unit, setup_complexity, reliability_score, source) values

('Supabase MCP', 'mcp_server', 'database_admin_via_claude_code', 'fully_supported',
 'Apply migrations, run SQL, manage projects directly from Claude Code. Org-scoped permissions.',
 'If project is in different org, MCP can''t reach — use Supabase CLI as fallback.',
 0, 0, 'monthly', 2, 8, 'vibe_lesson_forgeminds'),

('GitHub MCP', 'mcp_server', 'repo_management', 'fully_supported',
 'Search code, create PRs, manage issues from Claude Code.',
 null, 0, 0, 'monthly', 1, 9, 'official_docs'),

('Vercel MCP', 'mcp_server', 'deployment_management', 'fully_supported',
 'Deploy, env vars, logs, runtime stats from Claude Code.',
 null, 0, 0, 'monthly', 1, 9, 'official_docs');

-- ─── Hardware / Out-of-Scope (Be Honest) ──────────────────────────
insert into tool_capabilities (tool_name, category, capability_area, status, notes, workaround, cost_floor_cents, cost_ceiling_cents, cost_unit, setup_complexity, reliability_score, source) values

('Any Software Tool', 'ai_coding', 'electric_vehicle_manufacturing', 'not_supported',
 'No software tool can build a Tesla competitor. Hardware engineering, supply chain, manufacturing licensing, regulatory approval are all required.',
 'Software CAN support: market analysis, content/audience building, investor materials, telematics platform development.',
 null, null, null, null, null, 'vibe_lesson_general'),

('Any Software Tool', 'ai_coding', 'rocket_to_space_in_a_year', 'not_supported',
 'Aerospace requires physical engineering, materials science, FAA licensing, ITAR compliance, and 5-10 year timelines minimum.',
 'Software CAN support: simulation, mission planning tools, ground control software, investor decks. Hardware partners required for the rocket itself.',
 null, null, null, null, null, 'vibe_lesson_general'),

('Any AI Tool', 'ai_model', 'guaranteed_factual_accuracy', 'workaround_required',
 'No AI guarantees factual correctness. Hallucination risk is non-zero on any free-form generation.',
 'Use the ForgeMinds 4-layer architecture: ground every claim in a real data source, fact-check after generation.',
 null, null, null, null, null, 'vibe_rule_safety');

-- ════════════════════════════════════════════════════════════════════
-- Painful lessons learned (linked to capabilities above)
-- ════════════════════════════════════════════════════════════════════
insert into tool_lessons_learned (project_name, tool_name, capability_area, severity, what_failed, why_it_failed, what_worked, takeaway) values

('HuntHive', 'DIY Scraper (curl/cheerio)', 'amazon_pricing', 'blocker',
 'Multiple iterations of headless scrapers, proxy rotation, and stealth libraries — all blocked within 24-48 hours by Amazon''s bot detection.',
 'Amazon''s detection uses TLS fingerprinting, IP reputation, behavioral analysis, and request pattern matching. No public scraper-defeats-Amazon at scale.',
 'Switched to manual price entry by users + Keepa API for historical data. Affiliate API for product info.',
 'Never plan on scraping major retail sites. Use official APIs or paid providers, or pivot the feature.'),

('HuntHive', 'Lovable', 'production_grade_complexity', 'painful',
 'V0 worked beautifully in Lovable. Past 5 features, the codebase became a maintenance burden — generated patterns conflicted, debugging required reverse-engineering Lovable''s structure.',
 'Lovable optimizes for fast V0, not maintainability. AI-generated code accumulates idiosyncratic patterns.',
 'Migrated to Vite + React + Cursor + Claude Code. Took ~1 month but unlocked velocity.',
 'Use Lovable to validate concept (≤5 features). Migrate to a real codebase before scaling complexity.'),

('Pipedream', 'Pipedream', 'complex_long_running_workflows', 'painful',
 'Financial news pipeline hit 256MB memory wall. Had to split one workflow into two with handoff via Data Store.',
 'Pipedream''s tier limits cap workflow memory and execution time. Complex multi-step AI workflows exceed this fast.',
 'For ForgeMinds, migrating to Vercel Functions (1024MB) + Supabase pg_cron + DB-backed state machine.',
 'Plan for the memory ceiling early. If a workflow needs > 256MB, plan to host it natively from day one.'),

('FinKeel', 'OAuth flows', 'oauth_redirect_handling', 'painful',
 'OAuth callbacks failed when tested via error pages or iframes. Chrome blocked silent redirects.',
 'OAuth requires same-origin or pre-registered redirect_uri. Iframe contexts often violate this.',
 'Always test OAuth flows by navigating directly to the app URL in a fresh tab.',
 'OAuth Fresh Tab Test is mandatory before any auth-dependent feature ships.'),

('FinKeel', 'Edge Function security', 'verify_jwt_setting', 'blocker',
 'A delete-account Edge Function had verify_jwt=false, leaving it open to unauthenticated calls.',
 'Default settings on some platforms allow unauthenticated invocation; destructive actions need explicit auth.',
 'Set verify_jwt=true on every destructive Edge Function. Audit before launch.',
 'Every destructive action endpoint MUST require authentication. Audit verify_jwt before deploy.'),

('ForgeMinds', 'Supabase MCP', 'database_admin_via_claude_code', 'minor',
 'MCP could not access a project in a different org than the user''s primary.',
 'MCP is org-scoped. Cross-org projects require manual access or CLI workarounds.',
 'Used npx supabase db push as fallback. Confirmed working.',
 'When using Supabase MCP, ensure project is in the same org as the MCP credential is scoped to.');
