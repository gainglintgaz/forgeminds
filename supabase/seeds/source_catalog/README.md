# source_catalog seed files

Phase 1.5 catalog seeding — one SQL file per `(category, subcategory)` pair, produced by the `source-catalog-curator` subagent (definition: `.claude/agents/source-catalog-curator.md`).

## How seeding works

The catalog is populated **one subcategory at a time** via subagent dispatches. Don't try to seed the whole catalog in one shot — verification of every URL via `WebFetch` is the slow step, and a 200-source single dispatch will time out or hallucinate.

### Dispatch one subcategory

In a Claude Code session:

```
Run the source-catalog-curator subagent for: medicine / oncology
```

The subagent:
1. Researches 8–15 candidate sources spanning gov bodies, journals, trade pubs, newsletters, communities
2. WebFetches every URL to verify it returns a real RSS/Atom/JSON feed (no hallucinated URLs)
3. Scores quality (0–1), assigns paywall tier + monthly cost, update cadence, geography
4. Writes `supabase/seeds/source_catalog/<category>/<subcategory>.sql` with INSERT statements

### Apply seeds to dev

After a curator run lands the SQL file, apply it to the dev Supabase project:

```bash
# From the SQL editor, paste the contents of one or more <category>/<subcat>.sql files
# OR concatenate everything in seeds/source_catalog/**.sql and apply once
```

The `on conflict (type, url) do update` clause in each file means re-applying is idempotent — re-running a seed updates the existing row instead of erroring.

### Bulk apply

Once we've curated ≥10 categories × multiple subcategories, generate the master seed:

```bash
# Concatenates every seed file into one ready-to-paste SQL bundle
cat seeds/source_catalog/*/*.sql > seeds/source_catalog_master.sql
```

(Only applies after Phase 1.5 close — don't auto-apply to dev until validated.)

## Target by Phase 1.5 close

- ≥10 top-level categories represented (medicine, finance, tech, sciences, geopolitics, education, arts, lifestyle, sports, civic)
- ≥3 subcategories per category seeded
- ≥200 verified sources total
- ≥30% with non-RSS source types (Reddit, X, podcast RSS, JSON APIs)
- Paywall mix: ~70% free, ~15% freemium, ~10% paid, ~5% byos
- Geography mix: ≥60% global/us, the rest split eu/cn/in/lang-codes
- Quality score distribution: median ≥0.65, P90 ≥0.85

## Rules the curator enforces (from .claude/agents/source-catalog-curator.md)

- **NEVER hallucinate a URL.** WebFetch verifies every entry before it lands here.
- **NEVER use placeholder descriptions.** Every row gets one specific sentence about what makes the source valuable for ForgeMinds users.
- **NEVER misrepresent paywalls.** If WSJ requires $39.99/mo, mark `paywall_tier='paid'` + `paywall_cost_usd_monthly=39.99`. Honesty is the trust contract.
- **NEVER add competitor aggregators** (Feedly, Pocket, Inoreader, Flipboard).
- **Quality > reach.** A 10K-reader peer-reviewed journal beats a 500K-member misinformation-prone subreddit.

## File layout

```
supabase/seeds/source_catalog/
├── README.md                                    ← this file
├── medicine/
│   ├── oncology.sql
│   ├── infectious_disease.sql
│   ├── biotech.sql
│   └── ...
├── finance/
│   ├── monetary_policy.sql
│   ├── public_markets.sql
│   ├── crypto.sql
│   └── ...
├── tech/
│   ├── ai_ml.sql
│   ├── cybersecurity.sql
│   ├── hardware.sql
│   └── ...
└── ...                                          ← additional categories as curated
```

Each file is committed as it's produced — small atomic commits beat big mystery batches.
