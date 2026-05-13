---
name: search-products
description: How to modify multi-marketplace text/photo search behavior — enhanceQuery LLM prompt, platform routing, authenticity tier logic. Use when the task touches keywords like "search", "поиск", "enhanceQuery", "authenticity", "replica", "копия", "marketplace search", "platform query".
triggers:
  - search
  - поиск
  - enhanceQuery
  - authenticity
  - replica
  - копия
  - реплика
  - search-products
  - search-by-image
---

# Skill: working with multi-marketplace search

This repo has TWO search Edge Functions. Do not mix them up.

## Files

- `supabase/functions/search-products/index.ts` — **text-based** search (user types a description like "найк копия мужской")
- `supabase/functions/search-by-image/index.ts` — **photo-based** search (user uploads a photo, optional description hint)
- `index.html` lines ~1900-2100 — calculator photo search UI
- `index.html` lines ~2950-3120 — new-order photo + text search UI

## Key function: enhanceQuery

In `search-products/index.ts` around line 254. Takes a raw user query and returns:

```ts
{
  enhanced_en: string;          // normalized English query for international platforms
  enhanced_ru: string;          // normalized Russian query for WB/Lamoda/Ozon
  brand: string | null;
  category: string | null;
  authenticity_tier: "original" | "replica";  // detected from words like копия/реплика/1:1/fake/AAA
  ok: boolean;
}
```

It uses Claude Sonnet 4.6 via OpenRouter (`OPENROUTER_API_KEY`, `OPENROUTER_TEXT_MODEL`).

**Important rules of the prompt:**
- If user typed копия/реплика/1:1/fake/AAA → tier = "replica", keep the word "replica" in `enhanced_en`.
- Otherwise tier = "original", do NOT add "replica" to the result.
- Always return valid JSON with no markdown fences — `parseAssistantJson` strips fences defensively but prefer clean output.

## Platform routing

`DEFAULT_PLATFORMS` (18 entries: 5 China + 10 EU + 2 US + 1 JP, all Belarus-friendly) is at the top of `search-products/index.ts`. Lookup helper: `getPlatform(id)`. To add a new platform, see the `add-marketplace` skill.

Platform language rule (function `queryLangForPlatform`):
- `wildberries`, `lamoda`, `ozon` → use `enhanced_ru`
- everything else (international) → use `enhanced_en`

Roadmap: when `authenticity_tier === "replica"`, search should target Chinese platforms only (DHGate, AliExpress, 1688, Taobao, Poizon tier-2). Not yet implemented — leave a TODO if you touch this area.

## Common tasks

- **Tweak the LLM prompt**: edit the `prompt` template string inside `enhanceQuery`, then `deno check` the file.
- **Add a new return field**: update the return type AND the fallback object AND the `return` block at the end. Don't forget to expose in the final API response (the `Deno.serve` handler at the bottom of the file).
- **Change platform list**: edit `DEFAULT_PLATFORMS` only — `PLATFORMS` is the full catalog. Russian platforms (WB/Lamoda/Ozon) intentionally excluded from default.

## Validate before committing

```bash
cd supabase/functions/search-products && deno check index.ts
```

No tests in this folder, smoke-test via curl:

```bash
curl -X POST 'https://vrvwdagjpttvfvjanbwq.supabase.co/functions/v1/search-products' \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"найк копия мужской","topN":3}' | jq
```

Expect `authenticity_tier: "replica"` in the response for that input.

## Avoid

- Do NOT touch `search-by-image` when the task is about text search, and vice versa.
- Do NOT strip "копия"/"реплика" from `enhanced_en` unconditionally — the LLM prompt now handles this conditionally based on tier.
- Do NOT change `temperature` or `max_tokens` unless explicitly asked — these are tuned.
