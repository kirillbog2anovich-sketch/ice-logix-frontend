---
name: add-marketplace
description: How to add a new marketplace (platform) to multi-marketplace search. Use when the task mentions adding/whitelisting a platform like dhgate, taobao, 1688, vinted, mercari, or removing/disabling an existing one.
triggers:
  - marketplace
  - platform
  - площадка
  - whitelist
  - DEFAULT_PLATFORMS
  - dhgate
  - taobao
  - aliexpress
  - 1688
  - add platform
---

# Skill: adding or modifying marketplaces

All marketplace configuration lives in **one file**: `supabase/functions/search-products/index.ts`.

## Data structures

Near the top of the file:

```ts
type PlatformConfig = {
  id: string;              // lowercase slug, e.g. "dhgate"
  label: string;           // display name, e.g. "DHGate"
  flag: string;            // emoji flag, e.g. "🇨🇳"
  domain: string;          // root domain used in `site:` Google operator, e.g. "dhgate.com"
  qualifiers?: string;     // optional extra Google query qualifiers (e.g. "купить" for RU platforms)
  defaultCurrency?: string; // ISO code: "CNY" / "EUR" / "GBP" / "USD" / "RUB" — used by price normalization
};

const PLATFORMS: PlatformConfig[] = [ /* full catalog */ ];
const DEFAULT_PLATFORMS: string[] = [ /* ids enabled by default for new users */ ];
```

**Every existing platform sets `defaultCurrency`.** Always provide it for new entries — pick the seller's home currency (e.g. CNY for Chinese sites, EUR for EU sites, USD for US sites).

## Adding a new platform

1. Append a new entry to `PLATFORMS` (keep alphabetical within geographic group: China → EU → US/JP → RU).
2. ALWAYS include `defaultCurrency` (skipping it leaves prices unconverted downstream).
3. If the platform should be **enabled by default**, add its `id` to `DEFAULT_PLATFORMS`.
4. If the platform needs **Russian queries** (e.g. WB-style), add its id to `queryLangForPlatform`'s RU branch (and add a `qualifiers: "купить"` style hint to the entry if it helps Google narrow results).
5. If the platform sells **replicas** (DHGate, 1688, Taobao), tag it mentally — replica routing is a separate roadmap item, but the platform should be ready.

## Removing or disabling a platform

- To **disable** but keep available: remove its id from `DEFAULT_PLATFORMS` only. Existing users who have it selected can still use it.
- To **fully remove**: also remove the entry from `PLATFORMS`. Check that no DB rows reference the id (`SELECT * FROM user_platforms WHERE platform_id = '<id>'`).

## Belarus constraints

Before adding ANY marketplace, verify it's accessible from Belarus (no OFAC block, no card-region restriction). Excluded historically: amazon.com (region block), ebay.com (auth required), shein.com (works but quality terrible).

Russian platforms (`wildberries`, `lamoda`, `ozon`) are in `PLATFORMS` but **intentionally excluded** from `DEFAULT_PLATFORMS` — Belarusians already access them directly, no need to route through our pipeline.

## Validation

```bash
cd supabase/functions/search-products && deno check index.ts
```

Then smoke-test with the new platform id explicitly:

```bash
curl -X POST '<edge-fn-url>/search-products' \
  -d '{"query":"hoodie", "platforms":["<new-id>"], "topN":2}'
```

Expect at least 1 result if Firecrawl indexes the site.

## Do NOT

- Do not add platforms without a working Belarus-accessible payment flow (the user pays via marketplace, we just price/route).
- Do not change the `id` of an existing platform — it's referenced in DB rows.
- Do not add platforms with no `site:` operator support in Google (Firecrawl falls back to title-only matching, low quality).
