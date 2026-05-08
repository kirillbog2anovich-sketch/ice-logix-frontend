# Деплой парсинга — 4 режима ввода данных

Этот гайд про деплой Edge Functions для парсинга/поиска товаров: режимы 2 (URL+скрин), 3 (фото) и 4 (описание).

## Что нового

| Edge Function | Назначение | Уже задеплоена? |
|---|---|---|
| `parse-worker` | URL → title/price (mode 2 — основной) | ✅ Да |
| `parse-screenshot` | Screenshot → title/price (mode 2 — fallback) | ✅ Да (в проде) — теперь синхронизирована в репо |
| `search-products` | Текст → top-3 на 4 площадках (mode 4) | ❌ **Новая, нужно задеплоить** |
| `search-by-image` | Фото → Vision → текст → search-products (mode 3) | ❌ **Новая, нужно задеплоить** |

## Предварительные требования (один раз)

- Установлен Supabase CLI: `npm i -g supabase` или `brew install supabase/tap/supabase`
- Залогинен: `supabase login`
- Проект подключён: `supabase link --project-ref vrvwdagjpttvfvjanbwq`
- Уже установлены секреты: `OPENROUTER_API_KEY`, `FIRECRAWL_API_KEY`, `DEEPSEEK_API_KEY`, `CRAWLBASE_JS_TOKEN` (используются всеми функциями)

## Деплой 1: search-products

```bash
cd /path/to/ice-logix-frontend
supabase functions deploy search-products --no-verify-jwt
```

## Деплой 2: search-by-image

```bash
supabase functions deploy search-by-image --no-verify-jwt
```

## Деплой 3 (если нужно): обновлённый parse-screenshot

В этом PR `parse-screenshot/index.ts` синхронизирован с тем что сейчас в проде (v1.2). Если в проде не v1.2 — задеплой и эту:

```bash
supabase functions deploy parse-screenshot --no-verify-jwt
```

## Smoke-тест после деплоя

### search-products (mode 4 — поиск по описанию)

```bash
curl -X POST "https://vrvwdagjpttvfvjanbwq.supabase.co/functions/v1/search-products" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Nike Dunk Low Panda",
    "platforms": ["poizon", "zalando", "wildberries"]
  }'
```

Ожидаемый ответ:
```json
{
  "ok": true,
  "query": "Nike Dunk Low Panda",
  "platforms": ["poizon", "zalando", "wildberries"],
  "total": 5,
  "results": [
    {
      "platform": "poizon",
      "platform_label": "Poizon / Dewu",
      "flag": "🇨🇳",
      "url": "https://dewu.com/...",
      "title": "Nike Dunk Low Retro Panda",
      "price": 999,
      "currency": "CNY",
      "image_url": "https://...",
      "score": 1.0
    },
    ...
  ],
  "errors": []
}
```

### search-by-image (mode 3 — поиск по фото)

Сначала загрузи тестовое фото в bucket `product-screenshots`, потом:

```bash
curl -X POST "https://vrvwdagjpttvfvjanbwq.supabase.co/functions/v1/search-by-image" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "screenshotPath": "<user_id>/<filename>.jpg"
  }'
```

Ожидаемый ответ — такой же как у search-products + `vision_query`, `vision_brand`, `vision_category`.

## Тестирование во фронте

1. Открой Mini App → таб «Новый заказ»
2. Должен появиться селектор «Как добавить товар?» с 4 кнопками: ✍️ / 🔗 / 📸 / 🔍
3. Кликни **🔍 По описанию** → введи «Nike Dunk Low Panda» → жми «🔍 Найти на 4 площадках»
4. Должны появиться карточки с товарами и ценами
5. Нажми **✓ Использовать** на любой карточке → URL подставится в поле, автоматически запустится парсер для уточнения веса/категории
6. Кликни **📸 По фото** → загрузи скриншот товара → жми «🔍 Найти этот товар»
7. Vision API распознает товар, передаст в search-products → те же карточки

## Стоимость API-вызовов

| API | Стоимость за вызов | Когда вызывается |
|---|---|---|
| Firecrawl /search | ~$0.005 | search-products: 1 раз на каждую площадку |
| DeepSeek (chat) | ~$0.0002 | search-products: 1 раз на каждый top-N результат |
| OpenRouter Vision (Gemini) | ~$0.0008 | search-by-image: 1 раз для распознавания фото |

**Типичный поиск по описанию (4 площадки × top-3) стоит ~$0.025.**
**Типичный поиск по фото стоит ~$0.026** (Vision + 4×search-products).

## Логи и отладка

```bash
supabase functions logs search-products --tail
supabase functions logs search-by-image --tail
```
