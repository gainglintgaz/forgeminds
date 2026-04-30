# ForgeMinds — Project Rules

## Architecture
Smart Monolith with Module Architecture. Each module lives in `src/lib/` with its own folder. Modules communicate through a `jobs` table in Supabase, NOT through direct imports of other modules' internals. Modules may share types from `src/lib/types/`.

## Module Boundaries (DO NOT violate)
- `src/lib/pipeline/` — news fetching, NEVER imports from `src/lib/voice/` or `src/lib/collective/`
- `src/lib/ai/` — model routing, called BY other modules, never calls INTO them
- `src/lib/entities/` — entity resolution, called during ingest and search
- `src/lib/knowledge/` — archive + dot connector
- `src/lib/voice/` — voice DNA (Plan 2)
- `src/lib/collective/` — collective brain (Plan 4)
- `src/lib/actions/` — action engine (Plan 2)

## Conventions
- All money as BIGINT cents in DB, / 100 for display
- All AI calls go through `src/lib/ai/router.ts` — never call AI providers directly
- Every AI-generated output stored with `prompt_version` column
- Every table accepting imports has `content_hash` UNIQUE column
- RLS on ALL tables — no exceptions
- Snake_case for DB columns, camelCase for TypeScript
- Cron endpoints require CRON_SECRET header validation
- No secrets in NEXT_PUBLIC_ env vars

## Environment Variables Required
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- CRON_SECRET
- GEMINI_API_KEY
- XAI_API_KEY (Grok)
- FINNHUB_API_KEY
- ALPACA_API_KEY
- ALPACA_SECRET_KEY
- ALPHA_VANTAGE_KEY
- BENZINGA_API_KEY
