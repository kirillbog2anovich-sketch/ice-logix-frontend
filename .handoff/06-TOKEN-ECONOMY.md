# 06 — Экономия лимитов (Antigravity + Claude Code + OpenRouter)

> Цель: остаться на бесплатных лимитах максимально долго. Платить только когда упрёшься в стену качества.

## 🏆 Иерархия моделей по цене / качеству (актуально на май 2026)

| Модель | Где доступна | Цена за 1M токенов (in/out) | Когда использовать |
|---|---|---|---|
| **Gemini 3 Pro** | Antigravity (бесплатно в preview) | ~$1.25 / $5 | Default. Сложные задачи. |
| **Gemini 3 Flash** | Antigravity (бесплатно) + OpenRouter | ~$0.10 / $0.40 | Routine, быстрый код, парсинг |
| **Gemini 2.5 Flash** | OpenRouter | $0.075 / $0.30 | Edge Functions backend (наш default) |
| **Claude Sonnet 4.6** | Claude Code (Pro $20/мес) + OpenRouter | $3 / $15 | Архитектурные решения |
| **Claude Opus 5** | Claude Code (Pro $20/мес) + OpenRouter | $15 / $75 | Только очень сложный рефакторинг |
| **DeepSeek R1** | OpenRouter | $0.27 / $1.10 | Резерв если Gemini падает |
| **OpenAI o3-mini** | OpenRouter | $1 / $4 | Логические задачи (математика, алгоритмы) |
| **Qwen Coder 3** | OpenRouter (free tier!) | $0 / $0 | Резерв ну совсем бесплатный |

## 🛠️ Стратегия экономии — три тира

### Тир 1: Default (90% задач — бесплатно)

- **Antigravity бесплатная квота** на Gemini 3 Pro / Flash
- Когда упрёшься — Gemini 3 Flash сразу
- Backend Edge Functions работают на **Gemini 2.5 Flash через OpenRouter** (платно но дёшево — у тебя уже настроено)

### Тир 2: Сложные задачи (5% задач — копейки)

- **Claude Code с OpenRouter BYOK** → используешь свой `OPENROUTER_API_KEY`, платишь по API а не подпиской
- Команда:
  ```bash
  export ANTHROPIC_API_KEY=  # ОБНУЛИ — чтобы он не лез к Anthropic
  export OPENROUTER_API_KEY="твой_ключ"
  claude --provider openrouter --model anthropic/claude-sonnet-4.6
  ```
- Стоимость задачи: $0.01-0.30 в зависимости от размера

### Тир 3: Архитектура (≤1% — Claude Pro)

- Подпишись на **Claude Pro $20/мес** ТОЛЬКО когда у тебя будет 5+ сложных задач в месяц
- В этом тарифе Claude Code работает «безлимитно» (квота высокая)
- Без Pro подписки — каждый запуск через OpenRouter дешевле для редкого использования

## 💸 Бюджет на месяц (оценка)

| Сценарий | Antigravity | Claude Code | OpenRouter (Edge Functions) | Итого |
|---|---|---|---|---|
| **Минимум** (новичок, медленно) | $0 (free quota) | $0 (не пользуешься) | $1-3 | **$1-3/мес** |
| **Активная разработка** (1-2 PR в день) | $0 (free quota) | $5-10 (BYOK) | $5-10 | **$10-20/мес** |
| **Профессионал** (PR в день, сложные задачи) | $0 (free quota) | $20 (Pro) | $10-20 | **$30-40/мес** |

**Тебе сейчас:** активная разработка → **$10-20/мес максимум.** Это меньше чем Devin за день.

## ⚡ 10 правил экономии (mandatory)

### 1. Не читай весь `index.html`
Файл 7200 строк. Если агент его читает целиком — он сжигает 30k токенов на одном чтении. Скажи ему использовать **Serena MCP** или **grep**:

```
@symbol enhanceQuery   ← вместо @file index.html
```

### 2. Один PR = одна фича
Не пихай 5 разных задач в один промпт. Это удлинняет контекст.

### 3. Используй `AGENTS.md` как кеш
Не пересказывай агенту проект каждый раз. AGENTS.md лежит в корне репо — Antigravity автоматически его подтягивает. Если что-то меняется — обновляй AGENTS.md, не объясняй заново.

### 4. Skip Devin Review для UI-only PRs
Для PR-ов которые только меняют текст/CSS — пиши: «skip review wait, just merge after lint passes».

### 5. Параллелизм только для независимых задач
Два агента параллельно = 2× потребление. Используй только если задачи реально не пересекаются.

### 6. Smoke-тестируй curl-ом, не браузером
Открытие браузера = новые токены на скриншот / DOM. Curl с jq быстрее и дешевле.

### 7. Если 3 итерации не помогают — стоп и думай
Не дожимай по 10 раз одну и ту же ошибку. Лучше переформулируй задачу или переключись на Claude Code.

### 8. Кешируй результаты research
Если узнал что Apify Google Lens требует определённый input format — добавь это в `AGENTS.md`. Не ресёрчи второй раз.

### 9. Не используй Opus для рутины
Claude Opus 5 в 25× дороже Sonnet 4.6. Используй только когда: «нужно спроектировать архитектуру / нужно глубокое понимание legacy кода 1000+ строк / нужны нетривиальные алгоритмы».

### 10. Используй MCP вместо curl/web-search
- **Supabase MCP** вместо SQL через curl — быстрее, дешевле
- **Context7 MCP** вместо web_search для документации — точнее, дешевле
- **GitHub MCP** вместо ручного git — встроено

## 🔧 Настройки Antigravity для экономии

### Model defaults

В Antigravity → Settings → Model Preferences:
- **Default model:** Gemini 3 Pro
- **Fallback model** (когда лимит):
 Gemini 3 Flash
- **Long context tasks:** Gemini 3 Pro (1M context vs 200K у Claude)

### Auto-approve thresholds

В Settings → Auto-Approve:
- ✅ Auto-approve simple file edits (single file, <100 lines change)
- ✅ Auto-approve git commits / pushes (мы доверяем)
- ❌ DON'T auto-approve PR merges (давай ты сам мержишь)
- ❌ DON'T auto-approve secret/env changes
- ❌ DON'T auto-approve `rm -rf` или migration drops

### Budget alerts

Если в Antigravity есть Budget Alert (как было в Devin) — поставь:
- Daily soft limit: $5
- Daily hard limit: $10
- Weekly soft limit: $30

Когда срабатывает alert — перепроверь не слишком ли часто запускаешь агентов.

## 🔧 Настройки Claude Code для экономии

### Per-project config

Создай в репо `.claude/settings.json`:

```json
{
  "model": "anthropic/claude-haiku-4",
  "fallbackModel": "anthropic/claude-sonnet-4.6",
  "maxTokensPerRequest": 4000,
  "thinkingBudgetTokens": 0,
  "skipPermissions": false,
  "autoCompact": true
}
```

Это заставит Claude Code default-ить к Haiku (в 3× дешевле Sonnet) и эскалироваться только когда задача сложная.

### Skip thinking budget

Claude Code по дефолту в режиме «extended thinking» — это дорого. Выключи если не нужно:

```bash
claude --no-thinking "твоя задача"
```

### Auto-compact

Когда контекст близок к лимиту — Claude Code сам сжимает. Это бесплатно и экономит токены при долгих задачах.

## 📊 Мониторинг расходов

### Antigravity
В Settings → Usage. Показывает баланс quota.

### OpenRouter
<https://openrouter.ai/credits> — баланс. Поставь auto-topup на $10.

### Claude Code (Anthropic API)
<https://console.anthropic.com/usage> — баланс. Поставь budget alert на $20/мес.

### Supabase
<https://supabase.com/dashboard/project/vrvwdagjpttvfvjanbwq/settings/billing> — pro tier не нужен пока не упрёшься в лимиты.

## 🚨 Когда платить — а когда нет

| Ситуация | Что делать |
|---|---|
| Antigravity preview free quota закончилась | Используй Gemini 3 Flash вместо Pro |
| Edge Function упала на Gemini Flash | Откатывайся на DeepSeek через OpenRouter |
| Claude Code outputs мусор | Переключись с Haiku на Sonnet (включить в `.claude/settings.json`) |
| Нужно проектировать новую большую фичу | Используй Sonnet раз, потом Haiku доделывает |
| Production баг unclear | Сначала grep + Supabase logs (бесплатно). Потом Claude если непонятно. |

## 🧠 Главная истина

**90% задач можно решить на бесплатных моделях.** Платная модель нужна когда:
1. Бесплатная модель **2 раза подряд** даёт мусор
2. Задача **архитектурная** (новая фича с 10+ файлов)
3. Срочно нужен высокий уровень качества (production hotfix)

В остальных случаях — Gemini 3 Pro/Flash справится не хуже.

---

Дальше → возвращайся к [`00-START-HERE.md`](./00-START-HERE.md) или [`05-PENDING-WORK.md`](./05-PENDING-WORK.md) чтобы начать работу.
