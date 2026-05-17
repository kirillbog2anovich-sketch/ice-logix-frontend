# 02 — Установка и настройка Antigravity (для тебя)

> Цель: за **~30-45 минут** настроить Antigravity так, чтобы он работал как Devin AI (или лучше).

## Шаг 1. Установка Antigravity (5 мин)

1. Иди на <https://antigravity.google/download>
2. Скачай версию для своей ОС (Mac / Windows / Linux)
3. Установи как обычную программу (как Telegram или Discord)
4. Открой Antigravity → войди через **личный Gmail** (не корпоративный — у тебя должна быть бесплатная квота на топ-модели)

**⚠️ Важно:** Antigravity сейчас в preview-режиме. Бесплатная квота: Gemini 3 Pro / Gemini 3 Flash / Claude Sonnet 4.5 (или последняя версия) — лимиты не публичные, но щедрые. Если упрёшься — переключайся на Gemini 3 Flash, он быстрее и дешевле.

## Шаг 2. Подключение репо icelogix (3 мин)

В Antigravity есть две панели: **Agent Manager** (Mission Control) и **Editor**. Они переключаются через `Cmd+E` (Mac) или `Ctrl+E` (Win/Linux).

1. Открой **Editor**
2. `File → Open Folder` (или Clone Repository)
3. Введи URL: `https://github.com/icelogixbot/ice-logix-frontend.git`
4. Дай папку для клонирования (например `~/projects/ice-logix-frontend`)
5. Antigravity автоматически прочитает `AGENTS.md` в корне — это твоя готовая шпаргалка для агента

**Авторизация GitHub:** Antigravity спросит логин. Используй аккаунт `icelogixbot` (тот же что в Devin). Если нет под рукой пароля — заведи **Personal Access Token** на <https://github.com/settings/tokens> с правами `repo`, `workflow`.

## Шаг 3. MCP-серверы (10 мин) — это твои "суперспособности"

MCP (Model Context Protocol) — это плагины которые дают агенту доступ к внешним сервисам без объяснений.

### Как открыть MCP Store

В **Agent Manager** или Editor → правый сайдбар → кнопка `⋯` (три точки) сверху → **MCP Store**.

### Обязательно установи:

| MCP сервер | Зачем | Как настроить |
|---|---|---|
| **Supabase** | Чтобы агент работал с БД напрямую | Click Install → паспорт: введи `SUPABASE_ACCESS_TOKEN` (возьми с <https://app.supabase.com/account/tokens>) + Project Ref `vrvwdagjpttvfvjanbwq` |
| **GitHub** | PR-ы, ревью, комменты | OAuth login с твоим GitHub аккаунтом `icelogixbot` |
| **Context7** | Документация по библиотекам (Deno, Telegram WebApp SDK, Tailwind) — экономит запросы к веб-поиску | Просто Install, без настройки |
| **Vercel** | Логи деплоев, превью-ссылки | OAuth с Vercel аккаунтом |

### Опционально (когда понадобится):

| MCP | Когда нужен |
|---|---|
| **Sentry** | Когда настроишь мониторинг ошибок в проде (пока не настроено) |
| **Figma** | Если будешь делать дизайн через Figma + AI |
| **Linear** | Если хочешь трекать задачи — пока не нужно |
| **Notion** | Если будешь вести docs в Notion |

### Custom MCP — Apify, Firecrawl, Brave Search

Этих в Store нет. Используй `mcp_config.json`:
1. MCP Store → `Manage MCP Servers` → `View raw config`
2. Открой `mcp_config.json` в редакторе
3. Добавь блок (пример для Apify):

```json
{
  "mcpServers": {
    "apify": {
      "command": "npx",
      "args": ["-y", "@apify/mcp-server"],
      "env": {
        "APIFY_API_TOKEN": "твой_apify_token"
      }
    },
    "firecrawl": {
      "command": "npx",
      "args": ["-y", "firecrawl-mcp"],
      "env": {
        "FIRECRAWL_API_KEY": "твой_firecrawl_key"
      }
    }
  }
}
```

4. Сохрани → Antigravity подхватит сам

## Шаг 4. Claude Code интеграция (15 мин)

**Что это:** Claude Code — это отдельная CLI-программа от Anthropic. Очень мощный код-агент, лучший на рынке. Он БЕСПЛАТНО даётся с подпиской Claude Pro (\$20/мес) или работает по API ключу (плата за токены).

**Как это использовать вместе с Antigravity:** ты запускаешь Antigravity для повседневной работы (бесплатно, Gemini 3), а Claude Code призываешь только для **сложных рефакторингов** или **архитектурных задач**. Это и есть стратегия "best of both worlds".

### Установка Claude Code

1. Открой Terminal внутри Antigravity (`View → Terminal` или `Ctrl + ` `)
2. Установи:
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```
   Если `npm` ругается — поставь Node.js с <https://nodejs.org> (LTS версия).
3. Запусти авторизацию:
   ```bash
   claude
   ```
   Откроется браузер → войди через Anthropic Console (тот же аккаунт что у Claude.ai).

### Варианты оплаты

| Вариант | Цена | Когда выбирать |
|---|---|---|
| **Claude Pro** | \$20/мес | Используешь Claude Code ежедневно. Безлимит на ~прокси. |
| **Anthropic API** | \$3/1M токенов вход, \$15/1M выход | Используешь редко. Платишь только за факт. |
| **OpenRouter BYOK** (через `claude --provider openrouter`) | По прайсу OpenRouter | Уже есть OpenRouter ключ от icelogix — можно реюзать |
| **Бесплатно?** | ❌ Нет полноценного free tier | Без подписки/API — не получится |

**Моя рекомендация для тебя:** **пока НЕ покупай Claude Pro.** Antigravity бесплатной квоты Gemini 3 Pro хватит на 95% задач. Если упрёшься в качество — тогда подключай Claude Code на 1 месяц проверить.

### Как звать Claude Code из Antigravity

В терминале Antigravity:
```bash
cd ~/projects/ice-logix-frontend
claude
```
Откроется чат-режим. Пиши задачу как обычно. Когда закончит — выходи с `exit`. Antigravity подхватит изменения в файлах автоматически.

Ещё удобнее — single-shot режим:
```bash
claude "Перепиши функцию enhanceQuery в search-products чтобы она поддерживала authenticity_tier"
```

## Шаг 5. Дизайн-помощник (10 мин)

Ты сказал что в дизайне «полный ноль». Лучшее решение для тебя — **v0.dev** от Vercel. Это AI который генерирует UI по описанию на естественном языке.

### v0.dev (РЕКОМЕНДУЮ #1)

1. Иди на <https://v0.dev>
2. Войди через Gmail или GitHub (бесплатный план: 5-10 генераций в день)
3. В чат-окне пиши на русском или английском:
   ```
   Сделай экран легит-чека для Telegram Mini App.
   Фон тёмный (#0e1417), акцент циан (#22d3ee).
   Сверху: кнопка "Загрузить фото" с иконкой камеры.
   Под ней: блок результата с большим числом 0-100 (confidence score) и иконкой 🟢/🟡/🔴.
   Ниже: список из 3-5 пунктов с проблемами (если есть).
   Внизу: дисклеймер серым мелким шрифтом.
   Стиль: rounded-2xl, soft shadows, Tailwind CSS.
   ```
4. v0 покажет 3-4 варианта. Выбери который нравится → `Copy code` → вставь в чат Antigravity → "Адаптируй этот UI под мой index.html"

### Альтернативы v0.dev

| Сервис | Когда | Цена |
|---|---|---|
| **v0.dev** | UI компоненты, экраны | Free (5-10/день) или \$20/мес |
| **Lovable.dev** | Если хочешь чтобы сразу деплоилось как отдельное приложение | Free trial → \$25/мес |
| **21st.dev** | Готовая UI-библиотека с AI-поиском компонентов | Free |
| **Magic Patterns** | Конкурент v0, более минималистичный | Free trial → \$20/мес |
| **Galileo AI** (теперь Stitch by Google) | Полностью бесплатный, генерирует Figma-дизайны | Free |

**Мой совет:** комбинируй **v0.dev** (для генерации кода) + **Stitch by Google** (для визуального дизайна, мокапов).

### Telegram Mini App специфика

Mini App ограничен мобильным экраном (≤480px ширина). Когда просишь у v0 — добавляй:
- «Mobile-only design, viewport 375x812 (iPhone 14)»
- «Dark mode primary (Telegram default theme)»
- «Use --tg-theme-bg-color, --tg-theme-text-color CSS vars»
- «Touch-friendly: button height ≥44px»

### Готовый промпт для v0 (копируй-вставляй)

```
Design a screen for a Telegram Mini App named "icelogix" — Russian-speaking shoppers from Belarus buying from Chinese/EU marketplaces.

Context: I need a "Legit Check" screen where users upload a product photo and get an AI authenticity assessment (0-100 score).

Mobile-only, dark theme. Use Telegram color vars (--tg-theme-bg-color, --tg-theme-text-color, --tg-theme-button-color). Tailwind CSS. Rounded-2xl, soft shadows. Russian text:

- Header: "AI Проверка подлинности"
- Upload area: dashed border, camera icon, "Загрузить фото товара"
- Result block (when ready): big score number (0-100), color-coded (🟢 81-100, 🟡 51-80, 🔴 0-50), label "Скорее всего ОРИГИНАЛ/СОМНИТЕЛЬНО/СКОРЕЕ ВСЕГО ПОДДЕЛКА"
- Issues list: 2-5 bullets in Russian explaining red flags
- Disclaimer footer: "AI-оценка, не сертификация подлинности"
- Bottom CTA: "Проверить ещё одно" or "Заказать экспертизу человеком"

Touch-friendly, button height 48px minimum.
```

## Шаг 5.5. Запланированный стек (на потом, по мере роста)

Эти сервисы есть в исходной DeepSeek-шпаргалке проекта, но **не нужны прямо сейчас**. Подключай только когда упрёшься в конкретную задачу. Все проверены на доступность из Беларуси.

| Когда понадобится | Сервис | Зачем |
|---|---|---|
| Бот пора переносить с твоего ПК | **SurferCloud** ($2.9/мес VPS) | Хостинг бота 24/7 без выключения ПК |
| Хочешь связать вебхуки/платежи/нотификации цепочкой | **n8n** (self-hosted на SurferCloud) | Бесплатная альтернатива Zapier |
| Принимать BYN-платежи / ЕРИП | **WebPay** | Карты РБ + ЕРИП |
| Принимать крипту | **Heleket** | USDT/BTC, без верификации |
| Микро-платежи внутри Telegram | **Telegram Stars** + **TON Connect** | Native, никаких карт |
| Скрапер бьёт капчу на Poizon/Taobao | **CapMonster Cloud** ($1.20/1000) | Решение reCAPTCHA |
| IP бана на маркетплейсах | **ProxyCove** ($2.7/GB) | Ротация IP |
| Распознать товар по фото бесплатно | **A-Vision** (основной) + **Shaku API** (резерв) | Альтернатива Apify Google Lens |
| Шифровать паспортные данные | **Supabase Vault** (уже встроено) | Бесплатно, активируется одной командой |
| Учёт балансов / комиссий | **Lago** (self-hosted) | Биллинг-движок, бесплатно |
| PDF договоры / инвойсы | **DocuGenerate** | Pay-as-you-go |
| Видео для уроков Академии | **Kinescope** | Бесплатный тариф |
| Мониторинг ошибок в проде | **GlitchTip** (self-hosted, Sentry-совместимый) | Бесплатно |
| Аналитика воронок / retention | **PostHog** | Бесплатно ≤ 1M событий/мес |

**Как просить Antigravity-агента подключить эти сервисы:** просто скажи «нужно подключить X для Y». Агент сам разберётся с регистрацией / API ключами, тебе только нужно будет дать креды через MCP-секреты.

## Шаг 6. Финальная проверка (2 мин)

Открой Antigravity Agent Manager. Создай новую задачу. Введи:

```
Прочитай AGENTS.md и handoff/01-PROJECT-CHEATSHEET.md (если файла нет в репо, я его дам ниже). Скажи в одном абзаце что это за проект и где мы остановились.
```

Если агент правильно описывает icelogix + упоминает PR #15 / legit-check / Belarus / Gemini Flash — всё настроено хорошо.

Если нет — закинь в чат содержимое `01-PROJECT-CHEATSHEET.md` напрямую.

## ❓ Когда что-то сломается

| Симптом | Что делать |
|---|---|
| Antigravity не видит MCP сервер | Перезапусти приложение, проверь `mcp_config.json` синтаксис |
| Claude Code «not authorized» | Запусти `claude logout && claude login` ещё раз |
| Превышен лимит Antigravity | Переключи модель на Gemini 3 Flash (быстрее восстанавливается лимит) |
| Agent не находит файлы | Скажи: «Я работаю в репо `~/projects/ice-logix-frontend`, открой workspace там» |
| v0.dev генерит белым по белому | Добавь в промпт: «Telegram dark theme, --tg-theme-bg-color: #17212b» |

Дальше → [`03-USER-WORKFLOW.md`](./03-USER-WORKFLOW.md)
