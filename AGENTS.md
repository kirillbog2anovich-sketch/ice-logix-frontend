# AGENTS.md — guidance for AI coding agents working in icelogix-frontend

This file is auto-loaded by AI coding agents (Antigravity, Devin, Cursor, Claude Code, etc.) at the start of every session in this repo. It captures project-specific context, conventions, and workflows so the agent doesn't waste tokens re-discovering them.

> **For Antigravity agents:** treat this file as your primary onboarding doc. Skip re-reading the codebase to discover basics — they are here.
> **Project owner is a non-developer.** Communicate in Russian. Be autonomous. Use the silent mode (no preambles, just do).
> **Full handoff package** (for migration scenarios): `/home/ubuntu/icelogix-work/handoff/` on the Devin VM (also attached to the relevant session).

## What this project is

A Telegram Mini App + bot for Belarusian customers to buy goods from international marketplaces (China, EU, US, Japan) and have them delivered to Belarus. Pricing engine handles logistics + duties + currency buffers automatically.

## Tech stack

- **Frontend:** Vanilla JS SPA in a single `index.html` (~7200+ lines), Tailwind via CDN, served from Vercel
- **Backend:** Supabase Edge Functions (Deno runtime)
- **Database:** Supabase Postgres (project ref: `vrvwdagjpttvfvjanbwq`)
- **LLM (text):** Gemini 2.5 Flash via OpenRouter (`OPENROUTER_API_KEY`, `OPENROUTER_TEXT_MODEL=google/gemini-2.5-flash` — switched from Claude Sonnet 4.6 on 2026-05-04 for 40× cost reduction)
- **LLM (vision):** Gemini 2.0 Flash via OpenRouter (`OPENROUTER_VISION_MODEL=google/gemini-2.0-flash-001`)
- **Reverse image search:** Apify Google Lens actor `borderline/google-lens` (`APIFY_API_TOKEN`)
- **Web scraping:** Firecrawl (`FIRECRAWL_API_KEY`)
- **Frontend hosting:** Vercel (auto preview per PR)

## Repo structure

```
index.html                                  Main SPA (everything: routing, UI, state, API calls)
index_simple.html                           Lightweight diagnostic UI
test.html                                   Environment test page
onboarding.js                               Story-style onboarding module
pricing-engine.js                           11-step pricing pipeline (logistics + duties + buffer)

supabase/functions/parse-worker/            Marketplace URL parser (LLM-powered, queued via DB)
supabase/functions/search-products/         Multi-marketplace text search (Firecrawl + Claude query enhancement)
supabase/functions/search-by-image/         Reverse image search (Apify Google Lens + fallback)
supabase/functions/parse-screenshot/        OCR for screenshots from chat
supabase/functions/DEPLOY-PARSING.md        Deployment notes for parse functions

supabase/migrations/*.sql                   Schema migrations (ordered by timestamp prefix)
```

## Edge Function key concepts

- **`parse-worker`** consumes the `parse_queue` table — each row is a URL submitted by a user. Worker fetches HTML via Firecrawl, sends to Claude for structured extraction, writes `products` row.
- **`search-products`** does multi-marketplace search. Calls `enhanceQuery()` (Claude) first to normalize input, expand abbreviations, translate to EN, extract brand/category. Then runs Firecrawl search per platform in parallel. RU platforms (`wildberries`, `lamoda`, `ozon`) get RU queries; everyone else gets EN.
- **`search-by-image`** uploads photo → Apify Google Lens → falls back to Vision API + text search if Lens returns < 2 results. Accepts optional `descriptionHint` to fuse with Lens-detected title.
- **`parse-screenshot`** OCR-only path for chat screenshots.

## Marketplace platforms

`DEFAULT_PLATFORMS` (18 entries — all NOT-blocked-in-Belarus, default for new users):
```
poizon taobao tmall 1688 jd                  (China)
zalando asos farfetch aboutyou endclothing   (EU)
mrporter mytheresa ssense vinted sneakerstudio  (EU+CA)
goat stockx mercari                          (US+JP)
```

**Excluded from default** (still in `PLATFORMS` array but disabled): `wildberries`, `lamoda`, `ozon` — Russian, work normally inside Belarus, target audience already uses them directly.

To add a new marketplace: see Devin Playbook `!add_marketplace` (created in this org).

## Belarus-specific service constraints

| Service | Status from Belarus |
|---|---|
| Stripe direct | ❌ OFAC blocked — use Stripe Atlas (US LLC) instead |
| Google Cloud (Vision, Maps, etc.) | ❌ OFAC blocked |
| AWS billing | ❌ OFAC blocked |
| OpenRouter | ✅ Works (card or crypto) |
| Apify | ✅ Works (card, PayPal, crypto) |
| Vercel | ✅ Works |
| Supabase | ✅ Works |
| Cloudflare | ✅ Works |
| Firecrawl | ✅ Works |
| Telegram Bot API | ✅ Native, free |
| Telegram Stars / TON Connect | ✅ Native, no verification |
| Cryptomus / NOWPayments | ✅ Multi-crypto with USDT auto-convert |

## Common commands

```bash
# Type-check an Edge Function
cd /path/to/icelogix-frontend
deno check supabase/functions/<name>/index.ts

# Deploy an Edge Function
supabase functions deploy <name> --project-ref vrvwdagjpttvfvjanbwq --no-verify-jwt

# List Edge Function secrets
supabase secrets list --project-ref vrvwdagjpttvfvjanbwq

# Smoke-test search
curl -X POST 'https://vrvwdagjpttvfvjanbwq.supabase.co/functions/v1/search-products' \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"calvin klein hoodie","topN":5}' | jq

# Run all Edge Function type checks
for f in supabase/functions/*/index.ts; do
  deno check "$f" || echo "FAIL: $f"
done
```

## Branch and PR conventions

- Branch format: `devin/<unix-timestamp>-<short-feature-slug>` (e.g. `devin/1778414241-add-agents-md`)
- Use `git_pr fetch_template` then `git_pr create` (do not use `gh` CLI)
- Skip Devin Review wait for UI/text-only PRs; use `wait_mode='stage', stage='lint'`
- Use `wait_mode='all'` for Edge Function changes
- PR description should follow the template + include user-facing impact in Russian

## Code conventions

- Frontend: vanilla JS, `const`/`let` not `var`, async/await over `.then()`
- Use Telegram WebApp SDK directly (`window.Telegram.WebApp`) for haptics, BackButton, MainButton, etc.
- Edge Functions: Deno style, ES modules, fetch URLs from `deno.land` (not npm)
- Always wrap external API calls in try/catch with graceful fallbacks
- LLM responses sometimes have markdown code fences — strip ```json``` before `JSON.parse`

## LLM prompt patterns (used in this codebase)

- `enhanceQuery()` in `search-products` — normalizes raw user input, returns `{enhanced_en, enhanced_ru, brand, category, authenticity_tier}` where `authenticity_tier` is `'replica' | 'original'` (defaults to `'original'`; added in PR #11). Returns fallback object if `OPENROUTER_KEY` missing.
- `parse-worker` extraction prompt — extracts `{title, brand, price, currency, image_url, category}` from raw HTML.
- All LLM calls use `temperature: 0.1` for deterministic output and explicit JSON-mode response.

## Critical project concepts

- **Ice (❄️):** internal currency, 1:1 with BYN.
- **Pricing engine:** 11-step pipeline — base price → currency conversion → 3% buffer → logistics tier → customs duty → tier commission → service fee → final BYN. See `pricing-engine.js`.
- **Parse Queue:** DB-driven job list. Frontend inserts URL → backend worker picks it up → updates row with parsed product.
- **Hard Domain:** marketplaces requiring OCR or proxy scraping (Poizon/Dewu, Taobao). Different code path.
- **Client tiers:** Newbie → Shopper → VIP. Affects commission and rate limits.

## Token economy rules for AI agents

1. Prefer Serena MCP (`find_symbol`, `find_references`) over reading whole `index.html` — it's 7200+ lines.
2. Prefer Context7 MCP for library documentation lookups instead of web search.
3. Use Supabase MCP for SQL/migrations/log queries instead of curl.
4. Use Sentry MCP for production error investigation.
5. Use Vercel MCP for deploy log inspection.
6. Use the playbooks (`!add_marketplace`, `!deploy_edge`, `!new_feature_pr`, `!fix_search`) when applicable.
7. One PR per feature batch — combine related changes, don't open 5 mini-PRs.
8. Skip Devin Review wait for UI/text-only PRs.

## Communication preferences

- All user-facing messages in **Russian**.
- Concise, no preambles, link to the PR instead of pasting diffs.
- The user values fast turnaround — minimize wasted ACU.
- Use playbook macros (e.g. `!fix_search`) when starting a relevant task.

## Key files to know

- `index.html`: Single-page frontend. Use Serena `find_symbol` to locate functions — do NOT read the whole file.
- `pricing-engine.js`: Pricing logic, exported as a class. Has tests in companion files.
- `supabase/functions/search-products/index.ts`: Multi-marketplace search core. Includes `PLATFORMS`, `DEFAULT_PLATFORMS`, `enhanceQuery`, `searchOnePlatform`, main handler.
- `supabase/functions/parse-worker/index.ts`: URL → product extraction.
- `supabase/migrations/`: Append-only, never edit existing migrations.

## Environment variables (Edge Function secrets)

Stored via `supabase secrets set` — never committed to repo:

- `OPENROUTER_API_KEY` — Gemini/Claude routing
- `OPENROUTER_TEXT_MODEL` — currently `google/gemini-2.5-flash`
- `OPENROUTER_VISION_MODEL` — currently `google/gemini-2.0-flash-001`
- `APIFY_API_TOKEN` — for Google Lens actor
- `FIRECRAWL_API_KEY` — for web scraping
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — auto-provided by Supabase

## Frontend env (Vercel)

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — public, used by browser-side `supabaseClient.functions.invoke`
- Telegram WebApp data validated server-side via Edge Function before any privileged action

## When in doubt

1. Check the Knowledge Note "icelogix project context" (auto-loaded into every session for Devin)
2. For Antigravity: also check `/home/ubuntu/icelogix-work/handoff/01-PROJECT-CHEATSHEET.md` if available, or use Supabase MCP to inspect live DB state
3. Use Serena MCP to navigate code semantically — never read full `index.html` (7200+ lines)
4. Use Context7 MCP for library questions instead of web-search
5. Use Supabase MCP for DB queries instead of curl
6. Use GitHub MCP for PR operations
7. Run a smoke-test curl before assuming the deployed function works
8. Ask the user (in Russian) — better than guessing on critical decisions

## Current legit-check feature status (as of 2026-05-04)

- ✅ PR #15 open: reference DB with 5 brands × 10 models seeded + 4 fix-migrations applied to prod
- ⏳ PR-A.5 pending: collect ~100 reference photos, upload to Supabase Storage `legit-references` bucket
- ⏳ PR-B pending: Edge Function `legit-check` (Gemini Vision pipeline)
- ⏳ PR-C pending: UI «AI Проверка» button + disclaimer
- 🐛 Known bugs: navigation lag (#1), search-by-image ignores authenticity_tier (#2b), «Проверить изображение» missing in Calculator + garbage results (#3+#4)

Tier-1 MVP pricing model: 5 BYN/check, cost ~$0.10-0.30, target accuracy 70-80% on common counterfeits.
