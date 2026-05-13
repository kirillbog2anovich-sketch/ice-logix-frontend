---
name: edge-deploy
description: How to validate, deploy, and smoke-test Supabase Edge Functions in this repo. Use when the task touches a function under supabase/functions/* or mentions deno, supabase deploy, edge function.
triggers:
  - Edge Function
  - edge function
  - supabase functions
  - deno check
  - deno deploy
  - supabase deploy
  - parse-worker
  - search-products
  - search-by-image
  - parse-screenshot
  - pdf-generator
---

# Skill: Supabase Edge Function workflow

## Project layout

```
supabase/functions/parse-worker/        URL → product metadata (LLM-powered)
supabase/functions/search-products/     Multi-marketplace text search
supabase/functions/search-by-image/     Reverse image search (Apify Google Lens)
supabase/functions/parse-screenshot/    OCR for chat screenshots
supabase/functions/pdf-generator/       Order PDFs (oferta + receipts)
supabase/functions/DEPLOY-PARSING.md    Long-form deployment notes
```

Each function is a single `index.ts` (no submodules, no shared `_shared/` folder yet).

## Validate types

Always do this BEFORE committing:

```bash
cd supabase/functions/<name> && deno check index.ts
```

If you changed multiple functions:

```bash
cd /path/to/repo && for f in supabase/functions/*/index.ts; do
  deno check "$f" || echo "FAIL: $f"
done
```

`deno check` is fast (1-3s) and catches the vast majority of regressions. There is NO test suite for Edge Functions.

## Deploy

```bash
supabase functions deploy <name> \
  --project-ref vrvwdagjpttvfvjanbwq \
  --no-verify-jwt
```

`--no-verify-jwt` is required because the frontend calls these functions with the anon key. JWT validation happens inside the function logic when it needs the user.

## Environment variables (secrets)

Set via `supabase secrets set`, never commit:

| Secret | Used by | Notes |
|---|---|---|
| `OPENROUTER_API_KEY` | parse-worker, search-products, search-by-image | Claude routing |
| `OPENROUTER_TEXT_MODEL` | same | Currently `anthropic/claude-sonnet-4.6` |
| `APIFY_API_TOKEN` | search-by-image | For `borderline/google-lens` actor |
| `FIRECRAWL_API_KEY` | parse-worker, search-products | Web scraping |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | all | Auto-injected by Supabase platform |

List existing secrets:

```bash
supabase secrets list --project-ref vrvwdagjpttvfvjanbwq
```

## Smoke-test after deploy

```bash
curl -X POST 'https://vrvwdagjpttvfvjanbwq.supabase.co/functions/v1/<name>' \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '<json body>' | jq
```

Inspect the response for `{ok: true, ...}`. If `{ok: false}` or HTTP 500, check function logs in Supabase dashboard.

## Coding conventions for Edge Functions

- Deno style: ES modules, `import { ... } from "https://deno.land/..."`.
- Always wrap external API calls in try/catch with a graceful fallback (return `ok: false` + a useful `error` field, don't throw).
- Use `temperature: 0` or `0.1` for LLM calls — deterministic output is critical for retry / debugging.
- Always strip ```json``` markdown fences from LLM responses before `JSON.parse` — see `parseAssistantJson` helper in `search-products`.
- CORS: every function exports a `corsHeaders` object and handles OPTIONS preflight. Don't break this.

## Don't

- Don't add `npm:` imports unless absolutely necessary — prefer `deno.land/x` or `esm.sh`.
- Don't edit existing migrations under `supabase/migrations/*.sql` — append new files only.
- Don't deploy without `deno check` passing first.
- Don't change env var names — the frontend and other functions reference them by exact name.
