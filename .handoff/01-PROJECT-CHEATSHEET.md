# icelogix — Project Cheatsheet for Antigravity Agent

> **Agent: load this file at session start. It is the full project context (business + tech). Skip re-reading the repo to discover basics.**
>
> **This file extends `AGENTS.md` in the repo root.** AGENTS.md has the dev-conventions (stack, branch naming, etc.). This file adds business context, role system, full DB schema, planned-but-not-yet-implemented features, and methodology that the codebase alone doesn't reveal.

## 1. Project identity

- **Name:** icelogix (ICE LOGIX)
- **Type:** Telegram Mini App (TMA) + Telegram bot.
- **Business model:** byer / forwarder. Belarusian shoppers order goods from international marketplaces (China / EU / US / JP / KR / UAE / Vietnam / Turkey / RU); icelogix buys on their behalf, consolidates at a partner warehouse, ships to Belarus.
- **First-stage geo (MVP):** China, EU, Russia only. Other regions show «Скоро» badge.
- **First-stage product categories:** men's & women's clothing, footwear, accessories. Other categories deferred.
- **HQ:** Несвиж, Беларусь.
- **Logistics partner:** **ShopByShop** — warehouses in China, Russia, Poland. Current China tariff: **$10/kg** (auto/rail). RU/PL tariffs TBD.
- **Bank:** Белгазпромбанк (planned). Two ИП (sole proprietorships) — one per founder. Profit split 50/50. No ФСЗН payments (founders are 16 — confirmed by tax office).
- **Tax:** 20% of commission.
- **Languages of UX:** Russian (all user-facing text).
- **Owner:** Kirill Bogdanovich (`@icelogixbot` on GitHub, `kirillbog2anovich@gmail.com`).
- **Skill level of owner:** non-developer, non-designer, 16 y/o. Agent must be **autonomous and self-correcting** — do not over-clarify, do not propose architectural debates, just ship.

## 2. Tech stack — CURRENTLY DEPLOYED

| Layer | Tech |
|---|---|
| Frontend | Vanilla JS SPA, single `index.html` (~7200 lines), Tailwind via CDN |
| Hosting (frontend) | Vercel (auto preview per PR) |
| Backend | Supabase Edge Functions (Deno runtime) |
| Database | Supabase Postgres (project ID `vrvwdagjpttvfvjanbwq`) |
| Auth | Telegram WebApp `initData` (validated server-side) |
| LLM (text) | OpenRouter → `google/gemini-2.5-flash` (env `OPENROUTER_TEXT_MODEL`) — switched from `anthropic/claude-sonnet-4.6` on 2026-05-04 for 40× cost reduction |
| LLM (vision) | OpenRouter → `google/gemini-2.0-flash-001` (env `OPENROUTER_VISION_MODEL`) |
| Reverse image search | Apify Google Lens actor `borderline/google-lens` |
| Web scraping | Firecrawl |
| Bot | `python-telegram-bot` / `aiogram` (polling mode, local PC for now) |
| Storage | Supabase Storage (buckets: `marketplace-logos`, `avatars`, `agreements`, `course-content`, `certificates`, `legit-references`, `watermarks`, `reports`, `user-docs`) |
| Logs / monitoring | Supabase Functions Logs (Sentry/GlitchTip planned, not yet) |

**No build step on frontend.** `index.html` is served as-is. No bundler, no React, no TypeScript on frontend.

## 3. Tech stack — PLANNED (DeepSeek roadmap, not yet integrated)

Agent should NOT install these unsolicited — list them only if the user asks "what's left to do" or starts a new feature that needs them. All are Belarus-friendly (checked vs OFAC blocks).

| Category | Service | Purpose | Cost |
|---|---|---|---|
| VPS (bot host) | **SurferCloud** | Move bot off local PC | from $2.9/mo |
| Workflow automation | **n8n** (self-hosted on SurferCloud) | Webhook → payment → notification flows | free |
| Payments — RU/BY cards / ЕРИП | **WebPay** | Accept BYN payments | per-tx fee |
| Payments — crypto | **Heleket** | USDT / BTC / etc. | per-tx fee |
| Payments — Telegram-native | **Telegram Stars**, **TON Connect** | Onboarding-friendly micro-payments | native |
| Captcha solver | **CapMonster Cloud** | Anti-bot for hard marketplaces | $1.20 / 1000 |
| Proxy network | **ProxyCove** | Rotating IPs for hard marketplaces | $2.7 / GB |
| Visual search (premium) | **Apify Google Lens** | Already integrated, but plan to scale | $7.99 / 1000 |
| Visual search (free) | **A-Vision** (primary), **Shaku API** (backup) | Free product-recognition | free / trial |
| Encryption | **Supabase Vault** | Encrypt passport / card data | free |
| Billing ledger | **Lago** (self-hosted) | Track ices balance + commissions | free |
| Document generation | **DocuGenerate** | PDF contracts / invoices / customs declarations | pay-as-you-go |
| Video hosting | **Kinescope** | Lessons in the Academy module | free tier |
| Error monitoring | **GlitchTip** (self-hosted) | Sentry-compatible, free | free |
| Product analytics | **PostHog** | Funnel / retention / event tracking | free ≤ 1M events/mo |

## 4. Methodology — Architect / Developer / Owner split

The user's chosen workflow (from DeepSeek cheatsheet):

1. **Architect / Analyst** = the *planning* LLM (previously DeepSeek, now the Antigravity main chat). Produces structured **ТЗ (Technical Spec)** in Russian.
2. **Developer** = the *executing* coding agent (previously Sonnet 4.6 in Cursor, now the Antigravity agent or Claude Code). Takes the ТЗ, edits files, opens PR.
3. **Owner** = Kirill — does the things only a human can do: signs up for services, runs SQL migrations, approves PRs, tests in production.

**ТЗ format the user expects:**
- Заголовок (concise task title)
- Контекст (where the code lives, what already works)
- Локализация (which functions / files to edit)
- Список требований with code examples
- Ожидаемый результат
- Проверочный список (test plan)
- **No fluff** — no service-registration steps, no SQL inside the ТЗ (those are the owner's job).

**For Antigravity agents:** when the user gives you a new feature request, first produce a ТЗ in this format, then ship. If the task is small (< 1h), skip the formal ТЗ and just open a PR.

## 5. Roles & permissions

Five-tier role system stored in `users.role`:

| Role | Capabilities |
|---|---|
| `client` | Default. Browse, calculate price, place orders, balance, wishlist, cart, referrals. |
| `dropshipper` | Everything in `client` + Dropshipper Cabinet: margin %, referral payouts, payout requests. Settings live in `dropshipper_settings`. |
| `partner` | B2B partner. Dedicated dashboard (planned — `partners` table exists, dashboard UI not built). |
| `admin` | Manager. Kanban order board, marketplaces CRUD, products CRUD, promotions, reviews moderation, payout approval. **No role-changing** permissions. |
| `owner` | Full access — admin + role management + audit logs (`admin_logs`). |

UI renders different tab bars based on role. See `renderHome` / `renderProfile` / `renderAdmin` / `renderDropshipper` in `index.html`.

## 6. Repo

- **GitHub:** <https://github.com/icelogixbot/ice-logix-frontend>
- **Default branch:** `main`
- **Branch naming convention:** `devin/<unix-timestamp>-<short-slug>`; `antigravity/<unix-timestamp>-<slug>` is acceptable.
- **PR template:** `.github/pull_request_template.md` (auto-loaded by repo).
- **AGENTS.md:** auto-loaded by Antigravity / Devin / Cursor / Claude Code. Contains dev conventions + Belarus constraints.
- **Skills:** `.agents/skills/*/SKILL.md` — token-efficient context per task type. Triggers auto on relevant keywords.

### Local-machine layout (owner's Windows PC)

```
C:\Users\kiril_6yx2ik9\OneDrive\Desktop\
    ICE LOGIX BOT\          → main.py (aiogram bot, polling)
    ice-logix-frontend\     → cloned repo, single index.html
    supabase-functions\     → Edge Functions workspace
```

### Repo structure

```
index.html                                    Main SPA (UI + state + API calls)
index_simple.html                             Diagnostic UI
test.html                                     Env test page
onboarding.js                                 Onboarding stories module
pricing-engine.js                             11-step pricing pipeline (BYN with 3 % buffer)

.agents/skills/                               5 micro-skills:
                                                - search-products
                                                - add-marketplace
                                                - photo-previews
                                                - edge-deploy
                                                - tg-handlers
AGENTS.md                                     Main agent guidance (auto-loaded)
.handoff/                                     Antigravity / new-agent onboarding pack (this file + siblings)

supabase/functions/parse-worker/              URL → product extractor (LLM-powered)
supabase/functions/search-products/           Multi-marketplace text search
supabase/functions/search-by-image/           Reverse image search (Apify Lens)
supabase/functions/parse-screenshot/          Chat-screenshot OCR
supabase/functions/pdf-generator/             Contracts / invoices (planned)
supabase/migrations/*.sql                     Schema migrations (timestamp prefix, append-only)
```

## 7. Marketplaces (`DEFAULT_PLATFORMS`)

```
China:    poizon taobao tmall 1688 jd
EU:       zalando asos farfetch aboutyou endclothing
Premium:  mrporter mytheresa ssense vinted sneakerstudio
US/JP:    goat stockx mercari
```

**Disabled by default** (still in `PLATFORMS` array, RU users use directly): `wildberries`, `lamoda`, `ozon`.

To add a new marketplace: see `.agents/skills/add-marketplace/SKILL.md`.

**Hard Domains** (require OCR / proxy / captcha): Poizon/Dewu, Taobao, 1688. These will need ProxyCove + CapMonster integration when scaled.

## 8. Belarus-specific service constraints (CRITICAL)

| Service | Status from Belarus |
|---|---|
| Stripe direct | ❌ OFAC blocked → use Stripe Atlas (US LLC) |
| Google Cloud (Vision/Maps) | ❌ OFAC blocked |
| AWS billing | ❌ OFAC blocked |
| OpenRouter | ✅ Works (card or crypto) |
| Apify | ✅ Works |
| Vercel | ✅ Works |
| Supabase | ✅ Works |
| Cloudflare | ✅ Works |
| Firecrawl | ✅ Works |
| Telegram Bot API / Stars / TON | ✅ Native, free |
| Cryptomus / NOWPayments | ✅ |
| Brave Search API | ⚠️ Free tier removed (Nov 2026) — requires paid sub |

**Rule of thumb:** never propose Google Cloud, AWS, or Stripe-direct integrations. Always check Belarus accessibility first.

## 9. Environment variables

### Edge Functions (Supabase secrets)

Set via `supabase secrets set <NAME>=<VALUE> --project-ref vrvwdagjpttvfvjanbwq`. Never commit to repo.

| Variable | Current value | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | (secret) | Routing to Gemini / Claude |
| `OPENROUTER_TEXT_MODEL` | `google/gemini-2.5-flash` | Text-only LLM |
| `OPENROUTER_VISION_MODEL` | `google/gemini-2.0-flash-001` | Vision LLM |
| `APIFY_API_TOKEN` | (secret) | Google Lens reverse search |
| `FIRECRAWL_API_KEY` | (secret) | Web scraping |
| `SUPABASE_URL` | (auto) | Internal |
| `SUPABASE_SERVICE_ROLE_KEY` | (auto) | Internal |
| `BOT_TOKEN` | (secret) | Telegram Bot API token (used by `send-notification`) |

### Frontend env (Vercel)

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Public Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon key |

### Bot env (`.env` on owner's PC / future SurferCloud VPS)

| Variable | Purpose |
|---|---|
| `BOT_TOKEN` | Telegram Bot API |
| `SUPABASE_URL` | DB connection |
| `SUPABASE_SERVICE_ROLE_KEY` | RLS-bypass for bot operations |

## 10. Database schema (34 tables in prod)

All in `public` schema. RLS enabled on most; some temporarily disabled for dev (re-tighten before launch).

### Core user / account

| Table | Purpose | Status |
|---|---|---|
| `users` | Profile, role, ices_balance, referral_code, phone, avatar, **passport_data** (plaintext ⚠), `encrypted_passport` (Supabase Vault, planned), `encrypted_card` (planned), `settings` jsonb, `is_trusted`, `daily_requests_count` | ✅ schema ready, ⚠ encryption pending |
| `referrals` | `referrer_id` ↔ `referred_id` | ✅ |
| `recovery_codes` | Account recovery codes | ✅ |
| `verification_codes` | Phone / email verification | ✅ |
| `encryption_keys` | Key fragments for client-side encryption | ✅ schema ready |
| `user_agreements` | Signed oferta PDFs | ✅ |
| `transaction_history` | Ledger of balance changes (deposits, spending, refunds) | ✅ |
| `transactions` | Payment transactions (deposits, payouts, refunds) | ✅ |

### Orders / commerce

| Table | Purpose | Status |
|---|---|---|
| `orders` | Top-level order. Has `source_url`, status (kanban: `new`/`bought`/`at_warehouse`/`in_transit`/`delivered`/`cancelled`/`archived`), `price_original`, `price_byn`, `weight_estimated`, `prepayment_amount`, `tracking_number_cn`, `discount_applied`, `promo_code`, `archived_at`, `cart_items` jsonb (legacy multi-item snapshot), `promotion_id`, `legit_check_byn` | ✅ + 3-tier legit-check pricing pending |
| `order_items` | Future per-line-item table (currently `orders.cart_items` jsonb is used) | ✅ schema ready |
| `cart` | Pre-order cart | ✅ |
| `wishlist` | Saved items | ✅ |
| `products` | Catalog products (manually managed + parsed) | ✅ |
| `marketplaces` | Curated platform list (logo, country, categories, gender, instruction, requires_vpn) | ✅ |
| `parse_queue` | Async parse jobs for URL → product extraction | ✅ |
| `parsed_products` | Cache of parsed URLs (avoid re-parsing) | ✅ |
| `weight_standards` | Reference weights by category × size — for calc fallback | ✅ schema, ⚠ partly populated |
| `user_views` | Product view history (for analytics / recs) | ✅ |

### Promotions / marketing

| Table | Purpose | Status |
|---|---|---|
| `promotions` | Banner campaigns (discount type, value, min_order_amount, expiry, usage_limit) | ✅ |
| `promocodes` | One-time / multi-use codes (links to `promotions`) | ✅ |
| `reviews` | Customer reviews (rating, text, photo, verified, published) | ✅ |

### Roles / B2B

| Table | Purpose | Status |
|---|---|---|
| `dropshipper_settings` | Per-dropshipper margin %, payout threshold, payout method, encrypted card data | ✅ |
| `payout_requests` | Dropshipper payout requests (status, processed_at) | ✅ |
| `partners` | B2B partner accounts | ✅ schema only — dashboard UI 0% |

### Academy

| Table | Purpose | Status |
|---|---|---|
| `courses` | Courses (title, price_ice, role_access) | ✅ |
| `lessons` | Lessons in courses (content_type, content, order_index, unlock_delay_hours) | ✅ schema, ⚠ rendering broken |
| `user_lessons_progress` | Per-user lesson completion (quiz_score, completed_at) | ✅ |
| `user_courses` | Courses purchased by user | ✅ |
| `certificates` | Issued certificates | ✅ |

### Legit-check (Tier 1 MVP — PR #15 merged 2026-05-17)

| Table | Purpose | Status |
|---|---|---|
| `legit_check_brands` | 5 top brands (Nike, Adidas, Stone Island, Carhartt WIP, Stüssy) | ✅ seeded |
| `legit_check_models` | 50 models (10/brand) with `auth_markers`, `red_flags`, `aliases`, `sku_pattern` | ✅ seeded |
| `legit_check_reference_photos` | 100 reference photos in Supabase Storage `legit-references` bucket | ✅ seeded |

### Admin / observability

| Table | Purpose | Status |
|---|---|---|
| `admin_logs` | Action audit trail for admin/owner | ✅ |
| `public_reports` | (Aggregated reports for owner dashboard) | ✅ schema only |

### Missing tables (DeepSeek cheatsheet flags as ❌ not created)

- `logistics_events` — tracking event log (ShopByShop status webhooks). **Needed for Trekking 360°.**
- `partner_dashboards` — B2B partner-specific dashboards. **Needed for partner role UX.**

## 11. Feature roadmap & status

### Module status snapshot (from DeepSeek cheatsheet + post-merge updates)

| Module | Sub-feature | Status |
|---|---|---|
| Users & auth | role / ices_balance / referral / settings (notifications) | ✅ |
| Users & auth | encrypted_passport / encrypted_card via Supabase Vault | ❌ pending |
| Users & auth | Phone recovery | ⚠ button added, untested |
| Users & auth | Theme toggle | ❌ pending |
| Orders & calculator | Manual entry / caching / promocodes / pay with ices | ✅ |
| Orders & calculator | AI link parsing (Firecrawl + Gemini Vision) | ✅ for "easy" sites |
| Orders & calculator | Hard-domain parsing (Poizon, Taobao via OCR/proxy) | ❌ pending |
| Orders & calculator | Customs duty / insurance / domestic-to-warehouse leg | ❌ pending |
| Orders & calculator | Final reconcile / overpayment refund flow | ❌ pending |
| Logistics & tracking | `logistics_events` table + ShopByShop integration | ❌ pending |
| Logistics & tracking | Maps / pickup points (Европочта / Белпочта / СДЭК) | ❌ pending |
| Catalog | Products / catalog_items / marketplaces CRUD | ✅ |
| Catalog | Filtering / wishlist / cart | ✅ |
| Catalog | AI product enrichment (auto title/desc/photo) | ❌ pending |
| Payments | Ices internal | ✅ |
| Payments | WebPay / Heleket / ExpressPay / ЕРИП / crypto | ❌ all 0 % |
| Partners B2B | `partners` / `partner_dashboards` | ❌ 0 % |
| Academy | Lesson rendering | ⚠ broken |
| Academy | Quiz / certificate generation | ⚠ partial |
| Legit-check Tier 1 | Reference DB + reference photos (PR #15) | ✅ merged |
| Legit-check Tier 1 | Edge Function `legit-check` (Gemini Vision) | ❌ next (PR-B) |
| Legit-check Tier 1 | UI "AI Проверка" + disclaimer | ❌ next (PR-C) |
| Admin | admin_logs / promotions CRUD / orders kanban | ✅ |
| Admin | Course/lesson management UI | ⚠ partial |
| Admin | Review moderation | ✅ |
| Misc | Auto-generated docs (oferta, customs invoices) | ❌ pending |

### Merged PRs

- `#1` Pricing engine + onboarding stories + extended orders schema
- `#2` 4-mode product input (manual / link / photo / text-search)
- `#3` Parsing fixes — Calculator 4-mode UI + Zalando fix
- `#4` Apify Google Lens reverse image search
- `#5` Claude Sonnet search + 2-step categories + multi-photo + preview modal
- `#6` AGENTS.md (this file's predecessor)
- `#7` Telegram WebApp native APIs (haptic, BackButton, MainButton, popups, theming)
- `#8` Fix BackButton/MainButton handler stacking
- `#11` Search auto-detect replica tier (`authenticity_tier: 'replica' | 'original'`)
- `#12` 5 OpenHands skills
- `#13` Fix 4 factual errors in skills
- `#14` Fix AGENTS.md / tg-handlers contradiction
- `#15` **Legit-check Tier 1 reference DB** (brands + models + markers + 100 reference photos)

### Top of the backlog (in priority order)

| # | Task | Estimate | Type |
|---|---|---|---|
| **PR-B** | Edge Function `legit-check` (Gemini Vision pipeline: photo → brand/model detect → lookup auth_markers → score 0-100 + RU explanation) | 1-2h agent | Backend |
| **PR-C** | UI «AI Проверка» button + disclaimer + result UI in calculator | 1h agent | Frontend |
| Bug #1 | Navigation lags after photo search / long session — bottom menu unresponsive | 30min | Bug |
| Bug #2b | `search-by-image` ignores `authenticity_tier` (PR #11 added it only for text search) | 20min | Bug |
| Bug #3+#4 | «Проверить изображение» button missing in Calculator entry; returns garbage when used | 30min | Bug |
| Feat: replica routing | When `authenticity_tier=replica`, route searches to DHGate / AliExpress / 1688 only | 1h | Feature |
| Feat: marketplace whitelist | User provides curated list → store in DB `marketplaces`, replace `DEFAULT_PLATFORMS` | 1h | Feature |
| Feat: passport encryption | Move `passport_data` to Supabase Vault (`encrypted_passport`) | 1-2h | Security |
| Feat: ShopByShop integration | Webhook → `logistics_events` → status updates per order | 4-8h | Backend |
| Feat: WebPay integration | Accept BYN deposits via WebPay + handle webhook | 4h | Payments |
| Feat: oferta generator | PDF agreement signed at first checkout | 2h | Frontend + Edge Fn |
| Feat: academy lesson rendering | Fix lesson `content_type` rendering pipeline | 1-2h | Frontend |

See [`05-PENDING-WORK.md`](./05-PENDING-WORK.md) for ready-to-paste prompts.

## 12. LLM prompt patterns (used in this codebase)

- `enhanceQuery()` in `search-products` — normalizes raw user input, returns `{enhanced_en, enhanced_ru, brand, category, authenticity_tier}`. Falls back gracefully if `OPENROUTER_API_KEY` missing.
- `parse-worker` extraction — extracts `{title, brand, price, currency, image_url, category}` from raw HTML.
- All LLM calls: `temperature: 0.1`, explicit JSON-mode response.

**When LLM responses come back with markdown code fences (```json … ```), strip them before `JSON.parse`.** Helper utility lives in each function file.

## 13. Code conventions

### Frontend (`index.html`)

- Vanilla JS only, no frameworks.
- `const` / `let`, never `var`.
- `async/await`, never `.then()` chains.
- Use `window.Telegram.WebApp` directly for native APIs (haptic, BackButton, MainButton, popups, theming).
- Always use `tgUtil.setBackButton(handler)` / `tgUtil.setMainButton(text, handler)` helpers — they prevent handler stacking (lesson from PR #7 → #8).
- For photo previews, use blob URLs + `URL.revokeObjectURL()` in cleanup (lesson from PR #10).
- **Debugging in Telegram Desktop:** use `alert()`, not `console.log` — DevTools is not accessible from Telegram Desktop on most builds.
- **Function naming:** `render[SectionName]()` returns HTML string; `attach[SectionName]Handlers()` wires events after insertion.

### Edge Functions (Deno)

- ES modules, fetch URLs from `deno.land/x/*` (NOT npm).
- Wrap all external API calls in try/catch with graceful fallbacks.
- Strip markdown fences from LLM responses before `JSON.parse`.
- Use `Deno.env.get('VAR')` not `process.env.VAR`.

### Migrations

- **Never edit existing migrations.** Append new file.
- Naming: `YYYYMMDDhhmmss_short_description.sql`.
- For agents: use Supabase Management API `POST /v1/projects/<ref>/database/query` to apply directly to prod when blueprint is additive-only (env var `SUPABASE_ACCESS_TOKEN`).

## 14. Branch & PR conventions

- **Branch:** `devin/<unix-timestamp>-<slug>` (`antigravity/...` also fine).
- **PR template:** auto-pulled from `.github/pull_request_template.md`.
- **Skip Devin Review wait** for docs / UI-only / data-only PRs.
- **Wait for full CI** on Edge Function changes.
- **One PR per logical feature** (not 5 mini-PRs).
- **PR description:** mostly Russian, technical sections in English where natural. Always include a "Review & Testing Checklist for Human" section per template.

## 15. Communication preferences (CRITICAL — read this twice)

- **All user-facing messages in Russian.**
- **Silent mode** — do NOT narrate "I'm about to do X". Just do it. Communicate only when (a) PR is ready, (b) blocked, (c) 2+ alternatives need a decision.
- **No emoji checklists** of "✅ Сделал X" — just a final summary.
- **No clarifying questions** if 90 %+ confident on interpretation. If you misread the user, they'll correct you faster than a clarifying ping.
- **Link the PR**, don't paste diffs into chat.
- **One coherent task = one PR**, even if it touches multiple files.

## 16. Token economy rules

1. Prefer **Serena MCP** (`find_symbol`, `find_references`) over reading whole `index.html` — it's 7200+ lines.
2. Prefer **Context7 MCP** for library documentation instead of web search.
3. Use **Supabase MCP** for SQL / migrations / log queries instead of curl-ing.
4. Use **Sentry MCP** for production error investigation (when Sentry / GlitchTip lands).
5. Use **Vercel MCP** for deploy log inspection.
6. One PR per feature batch — combine related changes, don't open 5 mini-PRs.
7. Skip Devin Review wait for UI / text-only / data-only PRs.

## 17. Where the "deeper" context lives

- **`AGENTS.md`** (repo root) — dev conventions, common commands.
- **`.handoff/`** (this directory) — onboarding pack for new agent platforms.
- **`.agents/skills/*/SKILL.md`** — per-task micro-skills (search, marketplaces, photo previews, edge deploy, TG handlers).
- **DeepSeek wishlist** (lives in `/home/ubuntu/icelogix-work/` on Devin VM, not in repo) — 170 + brainstormed features. Most are out of scope for MVP; useful when the user asks "what could we add later?".
- **Knowledge notes in Devin/Antigravity org** — "icelogix project context", "ПРАВИЛА ЭКОНОМИИ".

## 18. FAQ — recurring issues

| Symptom | Likely cause / fix |
|---|---|
| Vercel deploy stale | DevTools → Deployments → Redeploy without cache |
| Edge Function 401 | Check `OPENROUTER_API_KEY` / `APIFY_API_TOKEN` / `FIRECRAWL_API_KEY` set via `supabase secrets list` |
| `Cannot read properties of undefined` in index.html | Race-condition on init — variable not yet populated. Wrap in `if (!x) return` |
| Edge Function 500 | `supabase functions logs <name>` |
| Migration "already applied" | Check `supabase_migrations.schema_migrations` table — may need manual reconciliation |
| Telegram Desktop console unavailable | Use `alert()` for debugging; or test in mobile Telegram with `?debug=1` URL param |
