# 🚀 ANTIGRAVITY HANDOFF — START HERE

**Привет, Кирилл!** Это пакет документов чтобы ты перешёл с Devin на Antigravity без потери качества и без необходимости разбираться во всём заново.

## ⚡ TL;DR — что делать прямо сейчас

1. Скачай Antigravity: <https://antigravity.google/download>
2. Установи через личный Gmail (бесплатная квота на топ-модели)
3. Прочитай по порядку:
   1. [`02-SETUP-GUIDE.md`](./02-SETUP-GUIDE.md) — как установить, подключить репо, MCP, Claude Code
   2. [`03-USER-WORKFLOW.md`](./03-USER-WORKFLOW.md) — как вообще работать в Antigravity
   3. [`04-PROMPT-TEMPLATES.md`](./04-PROMPT-TEMPLATES.md) — готовые промпты (просто копируй-вставляй)
   4. [`05-PENDING-WORK.md`](./05-PENDING-WORK.md) — что осталось доделать (с готовыми промптами)
   5. [`06-TOKEN-ECONOMY.md`](./06-TOKEN-ECONOMY.md) — как экономить бесплатные лимиты

Файл [`01-PROJECT-CHEATSHEET.md`](./01-PROJECT-CHEATSHEET.md) — это контекст ДЛЯ АГЕНТА, не для тебя. Когда начнёшь новую сессию в Antigravity — закинь его агенту первым сообщением (или загрузи как `AGENTS.md` в корень репо, я это уже сделал параллельно).

## 📦 Что я подготовил

| Файл | Для кого | Зачем |
|---|---|---|
| `00-START-HERE.md` | тебе | этот файл |
| `01-PROJECT-CHEATSHEET.md` | агенту | полный контекст проекта |
| `02-SETUP-GUIDE.md` | тебе | установка Antigravity + MCP + Claude Code + дизайн-помощник |
| `03-USER-WORKFLOW.md` | тебе | как работать в Antigravity (для нулевика) |
| `04-PROMPT-TEMPLATES.md` | тебе | готовые промпты для частых задач |
| `05-PENDING-WORK.md` | тебе + агенту | что осталось доделать |
| `06-TOKEN-ECONOMY.md` | тебе | как не сжигать бесплатные лимиты |

## 🎯 Что было сделано параллельно

1. **PR #15 (legit-check reference DB + 100 фото)** — замержен 2026-05-17. Все 7 комментов Devin Review закрыты (включая «hardcoded SERIAL ids», «vest photo bug», «angle enum mismatch»).
2. **`AGENTS.md` в репо** — обновлён со свежим контекстом для агентов (Gemini Flash, статус легит-чека, MCP-подсказки).
3. **`.handoff/` в репо** — этот пакет файлов закоммичен в репо, так что Antigravity-агент сможет загрузить любой из них через `@file` или просто прочитать сам.
4. **`01-PROJECT-CHEATSHEET.md`** — переписан с учётом исходной DeepSeek-шпаргалки: добавлены бизнес-модель (Несвиж/Белгазпромбанк/ИП/2 founders/16 y/o), партнёр ShopByShop ($10/кг), 5-уровневая ролевая модель, полный список 34 таблиц БД, методология Architect/Developer и запланированный стек (SurferCloud, WebPay, Heleket, n8n, CapMonster, ProxyCove, Lago, DocuGenerate, Kinescope, GlitchTip, PostHog).

## 🚦 Куда остановились (мини-recap)

- ✅ 15 PR в `main` (search, parsing, calculator, onboarding, Telegram WebApp APIs, skills)
- ✅ Backend на Gemini 2.5 Flash (40× дешевле Sonnet)
- ✅ **PR #15** замержен — Reference DB для легит-чека (Tier 1 MVP) + 100 reference photos в Supabase Storage.
- 📋 **PR-B** — Edge Function `legit-check` (Gemini Vision pipeline) — не начат, **следующий**
- 📋 **PR-C** — UI кнопка «AI Проверка» — не начат
- 🐛 4 известных бага + DeepSeek-список не-MVP функций (см. `05-PENDING-WORK.md`)

## ❤️ Финальный совет

Самое важное правило: **не бойся писать короткие промпты на русском.** Антигравити-агент так же хорошо понимает русский, как Devin. Не нужно писать «You are a professional senior developer...» — пиши как мне писал: «сделай Х, потом Y». Если что-то непонятно — он сам спросит.

Удачи, бро. Хорошего полёта в Antigravity 🛰️

— Devin (last day on duty 2026-05-04)
