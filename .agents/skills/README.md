# OpenHands / AI agent skills for icelogix-frontend

This directory contains **skills** (microagents) automatically loaded by OpenHands, Devin, and other AI coding agents when working in this repo.

## How loading works

- **Always loaded:** the root `AGENTS.md` is injected at conversation start.
- **Triggered:** every skill in this directory has a list of keywords in its frontmatter (`triggers:`). When the user's task contains any of those keywords, the corresponding `SKILL.md` is loaded into context.

## Current skills

| Skill | Triggers (excerpt) | Purpose |
|---|---|---|
| `search-products` | search, поиск, enhanceQuery, authenticity, replica | Multi-marketplace search logic, LLM prompt structure, tier handling |
| `add-marketplace` | marketplace, площадка, whitelist, dhgate, taobao | How to add / remove a marketplace |
| `tg-handlers` | BackButton, MainButton, tgUtil, Telegram | Correct Telegram WebApp handler attachment pattern |
| `edge-deploy` | Edge Function, deno check, supabase deploy | Validate, deploy, smoke-test Edge Functions |
| `photo-previews` | photo, blob, createObjectURL, preview | Memory-safe photo preview URLs |

## Adding a new skill

1. Create a new subdirectory `skill-name/`.
2. Inside, create `SKILL.md` with YAML frontmatter:
   ```yaml
   ---
   name: skill-name
   description: One-paragraph description of when this skill should be loaded.
   triggers:
     - keyword1
     - keyword2
   ---
   ```
3. Write the skill body as concise markdown — the agent will read it like a senior engineer's note.

Skills support progressive disclosure: keep the entry concise and link to deeper docs (or other skill subdirectories) for advanced cases.

## Token economy

Skills are typically 200-600 tokens each. Loading 1-2 relevant skills per task is much cheaper than letting the agent re-discover the same context by reading 1000+ lines of `index.html`.
