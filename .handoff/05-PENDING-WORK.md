# 05 — Что осталось доделать + готовые промпты

> Тут собрано ВСЁ что осталось в проекте, в порядке приоритета. Для каждой задачи — готовый промпт для Antigravity. Просто открываешь Agent Manager → New Task → копируешь промпт.

## 🔥 PRIORITY 1: завершить легит-чек MVP

### Задача A.5 — Reference photos collection

**Что:** Собрать ~100 фотографий оригиналов (50 моделей × 2 фото), залить в Supabase Storage, прописать URLs в `legit_check_reference_photos`.

**Промпт для Antigravity:**

```
Доделай PR-A.5 — сбор reference photos для легит-чека.

Контекст:
- В таблице `legit_check_models` (Supabase) лежат 50 моделей × 5 брендов (Nike, Adidas, Stone Island, Stüssy, Carhartt WIP).
- Таблица `legit_check_reference_photos` пустая, нужно заполнить.
- Storage bucket `legit-references` (public read) — создан или создай если нет.

Цель: 2-3 фото на каждую модель = ~100-150 фото.

Источники (приоритет): StockX → GOAT → официальные сайты Nike/Adidas → Farfetch/SSENSE → Wikipedia
Резервный путь: Bing Images / Yandex Images через Playwright + Chrome CDP (порт 29229 на VM)

Имя файлов в Storage: `{brand-slug}/{model-slug}/{ordering}.jpg`

После заливки — миграция `supabase/migrations/<ts>_legit_check_seed_photos.sql` со вставкой URLs:
INSERT INTO legit_check_reference_photos (model_id, photo_url, angle, source, ordering)
VALUES (<id>, 'https://<storage-url>', 'side|top|logo|tag|sole|box|detail', 'stockx', 1), ...

PR с описанием на русском.

Антибот защита: если StockX/GOAT начнут блокировать — переключайся на Apify $5 top-up (если квота восстановилась после 5 июня 2026) или Playwright через мой Chrome CDP (бесплатно, медленнее).
```

**Estimate:** 2-4 часа агента, ~$0.50 если использовать Apify ($0 если только Playwright).

---

### Задача B — Edge Function `legit-check`

**Что:** Бэкенд-функция: принимает фото → определяет бренд/модель через Gemini Vision → ищет в БД → сравнивает с auth_markers / red_flags → возвращает score.

**Промпт для Antigravity:**

```
Реализуй Edge Function `legit-check` в `supabase/functions/legit-check/index.ts`.

ВХОД (POST JSON):
{
  "photo_base64": "data:image/jpeg;base64,...",
  "brand_hint": "nike",   // optional
  "model_hint": "air-jordan-1"  // optional
}

ВЫХОД (JSON):
{
  "score": 0-100,
  "verdict": "likely-authentic" | "suspicious" | "likely-fake",
  "confidence": "low" | "medium" | "high",
  "detected_brand": "nike",
  "detected_model": "air-jordan-1-high-og",
  "issues": ["Логотип Swoosh кривой...", "Стежки неровные..."],
  "auth_markers_passed": ["Шов в 7 стежков ✓"],
  "disclaimer": "AI-оценка, не сертификация подлинности."
}

ЛОГИКА (pseudocode):

1. Validate input: photo_base64 непустая
2. Call Gemini Vision (OPENROUTER_VISION_MODEL=google/gemini-2.0-flash-001):
   prompt: "Определи бренд и модель товара на фото. Верни JSON {brand, model, category, confidence}."
3. Lookup в БД:
   SELECT auth_markers, red_flags, sku_pattern, notes
   FROM legit_check_models m JOIN legit_check_brands b ON b.id = m.brand_id
   WHERE b.slug = <detected_brand> AND m.slug = <detected_model>
   (если не найдено — fallback: WHERE brand_id = brand AND model fuzzy match через aliases)
4. Опционально: получить reference photos
   SELECT photo_url, angle FROM legit_check_reference_photos WHERE model_id = X LIMIT 5
5. Call Gemini Vision ВТОРОЙ раз:
   prompt: "Сравни user_photo с reference_photos. Оцени соответствие auth_markers: [...]. Найди red_flags: [...]. Верни JSON {score, issues, confidence, auth_markers_passed}."
6. Возвращай объединённый результат с disclaimer.

ENV:
- OPENROUTER_API_KEY
- OPENROUTER_VISION_MODEL = google/gemini-2.0-flash-001
- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto)

КАЧЕСТВО:
- temperature 0.1
- explicit JSON response_format
- strip markdown fences перед JSON.parse
- try/catch с graceful fallback (если LLM упал — верни {score: 50, verdict: 'unknown', error: 'AI temporarily unavailable'})

ДЕПЛОЙ:
- deno check supabase/functions/legit-check/index.ts
- supabase functions deploy legit-check --project-ref vrvwdagjpttvfvjanbwq --no-verify-jwt
- smoke-test curl'ом с тестовым фото (положи 1 picture air-jordan-1.jpg в test/ для проверки)

PR с описанием на русском по PR-template.
```

**Estimate:** 1-2 часа агента.

---

### Задача C — UI «AI Проверка»

**Что:** Кнопка «AI Проверка подлинности» в калькуляторе + экран результата + дисклеймер.

**Промпт для Antigravity:**

```
Добавь UI для легит-чека в `index.html`.

КУДА:
- Кнопка «🔍 AI Проверка подлинности» на экране `screenCalculator` (рядом с «Сохранить заказ»)
- Также кнопка в `screenNewOrder` если её там нет (Bug #3 — нужно проверить)
- Новый экран `screenLegitCheck`

UX flow:
1. Юзер на экране калькулятора нажимает «AI Проверка» → переход на `screenLegitCheck`
2. Если это первое использование — показать модальное окно с disclaimer:
   «AI-проверка подлинности — это автоматическая оценка с точностью 70-80%. Это НЕ сертификация. Для дорогих покупок (>$500) рекомендуем ручную экспертизу.»
   Чекбокс «Я понимаю» + кнопка «Продолжить». Сохрани в localStorage `legitCheckDisclaimerAccepted=true`.
3. На экране: drop-zone «Загрузить фото товара» (можно multiple, max 5) + поле «Бренд (опц.)» с автокомплитом из Supabase
4. Кнопка «Проверить» → вызов Edge Function `legit-check` → loader
5. Результат: большой score 0-100, цветной круг (🟢 81-100 / 🟡 51-80 / 🔴 0-50), список issues / auth_markers_passed, disclaimer

ДИЗАЙН:
- Telegram dark theme (--tg-theme-bg-color etc.)
- Tailwind, rounded-2xl, soft shadows
- Цвет акцент: cyan-400
- Russian copy

ИНТЕГРАЦИЯ:
- supabaseClient.functions.invoke('legit-check', { body: {photo_base64, brand_hint} })
- Используй `tgUtil.setBackButton` / `tgUtil.setMainButton` (см. .agents/skills/tg-handlers/SKILL.md)
- Haptic feedback на результат (tgUtil.haptic('success' | 'error'))

ТЕСТ:
- Vercel preview-ссылка в PR description
- Скриншот UI приложен к PR

PR с описанием на русском.
```

**Estimate:** 1-2 часа агента + дизайн через v0.dev (опционально).

---

## 🐛 PRIORITY 2: известные баги

### Bug #1 — Навигационные лаги

**Промпт:**

```
Bug #1: после поиска по фото (search-by-image flow) или долгой сессии — bottom-меню перестаёт реагировать когда тапаешь иконку «home» из калькулятора.

Гипотеза: лишний/неубираемый Telegram handler в photo-return path или stale state.

Стратегия:
1. Найди функцию которая обрабатывает return из photo search в `index.html` (поищи через grep "search-by-image" и "screenCalculator")
2. Проверь что все handlers cleanup-аются (см. lessons из PR #7 → #8, описаны в `.agents/skills/tg-handlers/SKILL.md`)
3. Конкретно: `tgUtil.hideMainButton()` и `tgUtil.setBackButton(null)` должны вызываться при выходе из photo-flow

Минимальный фикс. PR.
```

### Bug #2b — Search by image ignores authenticity_tier

**Промпт:**

```
Bug #2b: в PR #11 добавили `authenticity_tier` detection в `enhanceQuery()` для text-search. Но `search-by-image` Edge Function его не использует.

Задача: пробросить `authenticity_tier` из `search-by-image`.

Логика:
1. Когда юзер прислал фото с подписью (descriptionHint) — обработай описание через `enhanceQuery` ИЛИ inline-определи tier (если в descriptionHint есть «копия», «реплика», «1:1», «AAA», «fake»)
2. Верни `authenticity_tier` в ответе вместе с продуктами
3. Frontend должен показать индикатор «🔍 Найдены реплики» если tier=replica

Файлы: `supabase/functions/search-by-image/index.ts` + frontend handler в `index.html`.
Smoke-test обоими типами входа: с подписью «adidas копия» и без подписи.
PR.
```

### Bug #3 + #4 — «Проверить изображение» missing/garbage

**Промпт:**

```
Bug #3: кнопка «Проверить изображение» отсутствует на экране калькулятора (есть только на «Новый Заказ»). Добавь её туда же.

Bug #4: когда юзер использует «Проверить изображение» — результаты не соответствуют фото (garbage). 

Дебажь Bug #4:
1. Найди handler «Проверить изображение» в `index.html`
2. Посмотри куда он шлёт фото (видимо, search-by-image)
3. Проверь логи Apify в Edge Function — может Lens возвращает 0 результатов и fallback не срабатывает
4. Если Lens пустой — fallback должен брать Vision text-extraction → search-products. Проверь что fallback правильно ловится.

Smoke-test обоими багами. PR.
```

---

## ⚙️ PRIORITY 3: фичи

### Feature: Replica routing

**Промпт:**

```
Когда `authenticity_tier === 'replica'`, маршрутизируй поиск только на DHGate / AliExpress / 1688 / Taobao (китайские реплика-маркетплейсы), а не на оригинал-площадки (Zalando, StockX, GOAT и т.д.).

Файлы: `supabase/functions/search-products/index.ts` — найди `DEFAULT_PLATFORMS` и `searchOnePlatform`.

Логика:
- В `enhanceQuery()` уже возвращается `authenticity_tier`
- Перед запуском Promise.all(platforms.map(searchOnePlatform)) — фильтруй platforms:
  - tier=replica → platforms = ['dhgate', 'aliexpress', '1688', 'taobao']
  - tier=original → platforms = DEFAULT_PLATFORMS minus реплика-сайты

Если DHGate/AliExpress нет в PLATFORMS — добавь их (см. .agents/skills/add-marketplace/SKILL.md).
PR.
```

### Feature: Marketplace whitelist

**Промпт:**

```
Юзер хочет управлять списком маркетплейсов в которых ищем (whitelist). 

Задачи:
1. Добавь таблицу `user_marketplace_whitelist` (user_id, platform_slug, enabled).
2. На экране настроек добавь раздел «Маркетплейсы» — список platforms со свитчами.
3. Edge Function `search-products` должна читать whitelist для текущего юзера и фильтровать.

Если whitelist пустой — используй DEFAULT_PLATFORMS.
PR.
```

---

---

## 🛡️ PRIORITY 4: безопасность и инфраструктура (DeepSeek roadmap)

Эти задачи в исходной шпаргалке отмечены как 0% или ⚠️. Не срочные, но критичны до публичного запуска.

### Encrypted passport data (Supabase Vault)

**Что:** Сейчас `users.passport_data` хранится в открытом виде. Перенести в `users.encrypted_passport` через Supabase Vault.

**Промпт:**
```
Перенеси хранение паспортных данных пользователей в Supabase Vault.

Контекст:
- Сейчас поле users.passport_data хранится plaintext (плохо для compliance в Беларуси).
- В таблице уже есть колонка encrypted_passport (text) и encrypted_card (text), но они не используются.
- Supabase Vault уже встроен в проект.

Что сделать:
1. Создать миграцию: включить Vault extension, создать secret для шифрования.
2. Использовать pgsodium.crypto_aead_det_encrypt() при INSERT/UPDATE паспортных данных.
3. Использовать pgsodium.crypto_aead_det_decrypt() при чтении в API/Edge Functions.
4. Frontend (index.html) — обновить функции сохранения паспорта/карты.
5. Backfill миграция: зашифровать существующие passport_data в encrypted_passport, потом обнулить passport_data.
6. (Опционально) drop column passport_data после backfill.

Документация: https://supabase.com/docs/guides/database/vault
PR.
```

### ShopByShop integration + logistics_events

**Что:** Партнёрский склад ShopByShop присылает вебхуки на статус посылок. Сейчас интеграции 0%, таблица `logistics_events` не создана.

**Промпт:**
```
Интеграция с партнёром по логистике ShopByShop.

Контекст:
- ShopByShop = наш склад-партнёр в Китае/РФ/Польше, тариф $10/кг Китай.
- У них есть API (узнать у пользователя/из их docs).
- Сейчас orders.status обновляется вручную админом — нужно автоматизировать.

Что сделать:
1. Миграция: создать таблицу logistics_events (id, order_id, event_type, event_data jsonb, source='shopbyshop', occurred_at, created_at).
2. Edge Function `shopbyshop-webhook` (POST endpoint): принимает webhook от ShopByShop, валидирует подпись (если есть), записывает в logistics_events, обновляет orders.status согласно event_type.
3. Маппинг ShopByShop event_types → orders.status: 'received_at_warehouse' → 'at_warehouse', 'shipped' → 'in_transit', 'delivered_to_belarus' → 'delivered'.
4. (Опционально) функция bot-отправки уведомления юзеру через send-notification при каждом status change.

Если у ShopByShop нет вебхуков — реализовать polling: cron каждые 30 мин запрашивает статусы по active orders.
PR.
```

### Partner B2B dashboard

**Что:** Таблица `partners` существует, но UI кабинета партнёра не реализован.

**Промпт:**
```
Сделать B2B кабинет для роли `partner`.

Контекст:
- В users.role есть тип 'partner' (помимо client/dropshipper/admin/owner).
- Таблица partners пустая, схемы partner_dashboards вообще нет.
- Партнёры — это бизнесы (магазины) которые могут крупно закупаться через icelogix.

Что сделать:
1. Миграция: schema для partners (если нужны доп. поля: company_name, contact_person, monthly_volume_byn, custom_commission_pct).
2. Frontend: новая вкладка/раздел "B2B Кабинет" видимая только для role=partner.
3. Метрики кабинета: суммарный объём за период, средний чек, текущая комиссия, contact с менеджером.
4. Admin интерфейс для назначения роли partner и установки custom commission.

Уточнить у юзера какие именно метрики он хочет видеть.
PR.
```

### Academy lesson rendering

**Что:** Уроки создаются, но рендерятся плохо. Контент урока (`lessons.content_type`, `lessons.content`) не отображается корректно.

**Промпт:**
```
Починить отображение уроков в Академии.

Контекст:
- Таблицы courses, lessons, user_lessons_progress созданы.
- lessons.content_type может быть 'video' | 'text' | 'quiz' | 'pdf'.
- lessons.content — соответствующее содержимое (URL видео, markdown, JSON квиза, URL PDF).
- В index.html есть renderAcademy() — нужно найти и доделать.

Что сделать:
1. Найти renderAcademy() в index.html через Serena MCP find_symbol.
2. Для каждого content_type — отрендерить корректно:
   - 'video' → iframe Kinescope (либо <video src> для прямой ссылки)
   - 'text' → markdown через marked.js или простую функцию
   - 'quiz' → форма с radio-вариантами, кнопка submit, запись результата в user_lessons_progress
   - 'pdf' → embed/iframe для PDF preview + кнопка скачивания
3. Прогресс юзера: пометка completed после просмотра, сохранение в user_lessons_progress.
4. Сертификат: по завершении курса генерить запись в certificates (URL PDF может быть заглушкой).

PR.
```

### Bot migration to SurferCloud VPS

**Что:** Бот сейчас на локальном ПК пользователя. Когда юзер запустит проект публично — нужен VPS.

**Промпт:**
```
Перенести Telegram бота с локального ПК на SurferCloud VPS.

Контекст:
- Бот написан на python-telegram-bot / aiogram, polling mode.
- Сейчас крутится локально на ПК пользователя (Windows).
- Нужно: купить VPS на SurferCloud, развернуть, настроить автозапуск.

Что сделать (это HUMAN task, агент только готовит инструкцию):
1. Регистрация на SurferCloud.com, выбор $2.9/мес плана (Ubuntu 22.04).
2. SSH в VPS, установка Python 3.11, pip, git.
3. Клонировать репо bot, установить dependencies.
4. Создать .env с BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
5. systemd unit для автозапуска при reboot.
6. (Опционально) перейти с polling на webhook через nginx + Let's Encrypt.

Это задача для пользователя. Агент может только подготовить пошаговую инструкцию + systemd unit файл.
```

---

## 📊 Suggested order

Если делать по 1 PR за раз (рекомендую) — порядок:

```
1. PR-A.5 (photos)        ← завершает легит-чек данные
2. PR-B (Edge Function)   ← делает backend
3. PR-C (UI)              ← подключает к юзеру
4. Bug #3 + #4            ← мелкие фиксы вокруг легит-чека UI
5. Bug #2b                ← пробросить tier в image search
6. Feature: replica route ← фича после фиксов
7. Bug #1                 ← навигационные лаги (низкий риск, низкий приоритет)
8. Feature: whitelist     ← фича по требованию юзера
```

Параллельно можно делать **PR-B и PR-C** (один — backend, второй — UI). Так выиграешь ~1 час.

После каждого PR — **5 минут отдыха для тебя** (превью посмотри в Telegram WebApp, потыкай).

---

## ✅ Когда всё доделано

- PR #15 (Reference DB) — мержи
- PR-A.5, PR-B, PR-C — мержи последовательно
- Telegram bot: @icelogixbot должен открываться без багов
- Прокачай знакомых: дай пощупать MVP легит-чека на 5-10 реальных вещах, собери фидбек
- Если AI score консистентно <60 на оригиналах — собирай ещё фото или подтягивай Claude Vision (дороже но точнее)

Дальше → [`06-TOKEN-ECONOMY.md`](./06-TOKEN-ECONOMY.md)
