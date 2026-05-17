# 04 — Готовые промпты (копируй-вставляй)

> Эти промпты протестированы со мной (Devin). Они должны хорошо работать в Antigravity. Если что-то не идёт — слегка переформулируй.

## 🚀 Самый первый промпт после установки

Когда впервые открываешь Antigravity на репо `ice-logix-frontend`, закинь это:

```
Прочитай AGENTS.md в корне репо. Скажи в одном абзаце:
1) что это за проект,
2) на чём остановилась команда,
3) какой следующий приоритетный PR.

Используй Supabase MCP чтобы проверить состояние таблиц `legit_check_brands` и `legit_check_models` (project ref: vrvwdagjpttvfvjanbwq). Должно быть 5 брендов и 50 моделей.
```

Если агент успешно ответит — значит контекст + MCP работают.

---

## 📋 Шаблоны промптов по типу задачи

### 1. Реализовать новую Edge Function

```
Реализуй Edge Function `<имя>` в `supabase/functions/<имя>/index.ts`.

ВХОД: POST с JSON `<пример>`
ВЫХОД: JSON `<пример>`
ЛОГИКА: <псевдокод или описание>

Используй:
- OpenRouter для LLM (env OPENROUTER_API_KEY, OPENROUTER_TEXT_MODEL или OPENROUTER_VISION_MODEL)
- Supabase client (env SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY auto-provided)
- Deno стиль, fetch URL из deno.land/x
- Try/catch обёртки с graceful fallback
- Strip markdown fences из LLM ответов перед JSON.parse

Деплой после `deno check`. Smoke-тестируй curl'ом.
Создай PR через git_pr с описанием по шаблону.
```

### 2. Добавить новый экран в frontend

```
Добавь экран `screen<Name>` в `index.html`. 

UI-описание: <текст>
Дизайн: <ссылка на v0.dev или картинка>
Куда переходим: из `screen<X>` по кнопке «<Y>»
Куда уходим обратно: по BackButton → `screen<X>`

Используй существующие паттерны:
- `tgUtil.setBackButton(handler)` для назад
- `tgUtil.setMainButton(text, handler)` для основной кнопки
- Tailwind классы как в существующих экранах
- Russian copy

Найди как сделаны соседние экраны (`screenCalculator`, `screenNewOrder`) — копируй стиль.
PR.
```

### 3. Пофиксить баг

```
Баг: <описание поведения>
Где проявляется: <экран/функция>
Ожидаемое поведение: <текст>
Шаги воспроизведения: <если знаю>

Логи / стектрейс (если есть):
```
<вставь>
```

Найди причину через `grep` или Serena MCP. НЕ читай весь index.html — он 7200 строк.
Минимальный фикс, не рефакторь соседнее.
PR.
```

### 4. Добавить миграцию БД

```
Создай миграцию `supabase/migrations/<YYYYMMDDhhmmss>_<short_desc>.sql`.

Цель: <текст>
SQL: <DDL или DML>

Применяй через Supabase MCP (project ref vrvwdagjpttvfvjanbwq). НЕ редактируй существующие миграции — только append.
PR.
```

### 5. Сгенерить UI через v0.dev → адаптация

```
Я сгенерировал UI через v0.dev для экрана <X>. Код в React JSX:

```jsx
<вставь код от v0>
```

Задача: адаптируй под наш `index.html` (vanilla JS + Tailwind CDN, БЕЗ React). Замени:
- JSX → template literals или DOM-методы
- useState → обычные переменные / localStorage
- onClick={} → addEventListener
- className → class

Стиль и цвета сохрани. Куда вставить: <место>.
PR.
```

### 6. Адресовать Devin Review коммент

```
На PR #<X> пришёл коммент от Devin Review (ID <commentId>): <короткое описание>.

Прочитай полный текст коммента через `git_view_pr`, оцени:
- Если это реальный баг — пофикси
- Если это style/info — ответь в треде что noted
- Если это refactoring suggestion — оцени trade-off, ответь решением

Используй `git_comment_on_pr` с `in_reply_to=<commentId>` для ответа в треде.
```

### 7. Запросить ревью / merge

```
PR #<X> готов к мерджу. Проверь:
- CI зелёный (через git_pr_checks)
- Все Devin Review threads закрыты или адресованы
- Migration применена к проду (если есть)

Если ОК — смержь через git_pr merge. Если нет — скажи что блокирует.
```

---

## 🎯 Промпты для текущего pending работы

См. [`05-PENDING-WORK.md`](./05-PENDING-WORK.md) — там готовые промпты для каждого pending PR (A.5 / B / C / bugs).

---

## 💡 Универсальные правила

1. **Всегда** ссылайся на `01-PROJECT-CHEATSHEET.md` или `AGENTS.md` если задача требует контекста проекта.
2. **Всегда** проси PR в конце (не «просто внеси изменения»).
3. **Никогда** не проси сделать сразу 5 фич в одном промпте.
4. **Всегда** проси Russian в user-facing тексте.
5. Если задача про Edge Functions — проси smoke-test curl-ом.
6. Если задача про UI — проси проверить на Vercel preview.

---

## 🆘 Если ничего не понятно

Просто закинь агенту:

```
Я не разработчик. Объясни простыми словами что ты собираешься сделать перед тем как делать. И в конце скажи как я это могу проверить.
```

Любой нормальный агент адаптируется. Antigravity-Gemini 3 Pro делает это отлично.
