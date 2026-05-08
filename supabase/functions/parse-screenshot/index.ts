// supabase/functions/parse-screenshot/index.ts
// ICE LOGIX — parse-screenshot v1.2
//
// Edge Function для извлечения title/price/brand/category из скриншота товара
// через OpenRouter Vision API. По умолчанию модель google/gemini-2.0-flash-001
// (~$0.0008 за вызов) — отличный перевод на русский, корректно выдаёт brand/category
// из частичных скриншотов.
//
// Использование:
//   POST /functions/v1/parse-screenshot
//   Authorization: Bearer <SUPABASE_ANON_KEY>
//   Content-Type: application/json
//   Body: { "jobId": "<uuid>", "screenshotPath": "user_id/timestamp_filename.jpg" }
//
// Поток:
//   1. Принимает jobId + screenshotPath
//   2. Создаёт signed URL для файла в bucket product-screenshots
//   3. Шлёт изображение в OpenRouter (Gemini Flash) с промптом-инструкцией
//   4. Парсит JSON ответ → нормализует
//   5. Решает финальный статус по умному dispatch'у:
//        - title + price → done
//        - только price → manual_required с подсказкой про название
//        - только title → manual_required с подсказкой про цену
//        - ничего → общий manual_required
//
// Требуемые secrets:
//   - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (стандартные)
//   - OPENROUTER_API_KEY (sk-or-v1-...) — токен OpenRouter
//   - OPENROUTER_VISION_MODEL (опционально, default: google/gemini-2.0-flash-001)
//
// Changelog v1.2:
//   - В JSON-ответе теперь возвращаем все поля (brand, category, description, color,
//     error_message), а не только title/price/currency/confidence. Фронт раньше
//     не получал brand/category/description/color и не показывал их юзеру даже
//     когда они корректно записывались в parse_queue.
//
// Changelog v1.1:
//   - Сменили модель с qwen/qwen-vl-plus → google/gemini-2.0-flash-001
//     (Qwen игнорировал инструкцию переводить description на русский)
//   - Усилили промпт: теперь принудительный перевод на русский, инференс title
//     из частично видимых элементов (alt-подписи, badges, baby-text)
//   - Раздельные сообщения об ошибках в зависимости от того что извлеклось

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

// Gemini 2.0 Flash от Google — отличный перевод на русский, корректное определение
// brand/category из частичных скриншотов. ~$0.0008 за вызов.
// Альтернативы при сбое: openai/gpt-4o-mini ($0.0015), qwen/qwen-vl-plus ($0.0003 но плохо
// выполняет инструкцию переводить на русский), anthropic/claude-3.5-sonnet ($0.003 идеален
// но дорого).
const VISION_MODEL = Deno.env.get("OPENROUTER_VISION_MODEL") || "google/gemini-2.0-flash-001";
const STORAGE_BUCKET = "product-screenshots";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── JSON helper (strips ```json fences) ─────────────────────────────────────
function parseAssistantJson(raw: string): Record<string, unknown> {
  let s = (raw || "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/s, "").trim();
  }
  return JSON.parse(s) as Record<string, unknown>;
}

// ─── Currency normalizer ─────────────────────────────────────────────────────
function normalizeCurrency(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const u = raw.trim().toUpperCase();
  if (u === "$" || u === "USD") return "USD";
  if (u === "€" || u === "EUR") return "EUR";
  if (u === "¥" || u === "CNY" || u === "RMB" || u === "元") return "CNY";
  if (u === "£" || u === "GBP") return "GBP";
  if (u === "₽" || u === "RUB" || u === "RUR") return "RUB";
  if (u === "BYN" || u === "BYR") return "BYN";
  if (/^[A-Z]{3}$/.test(u)) return u;
  return null;
}

// ─── Vision API call ─────────────────────────────────────────────────────────

interface VisionResult {
  title: string | null;
  price: number | null;
  currency: string | null;
  brand: string | null;
  category: string | null;
  description: string | null;
  color: string | null;
  confidence: "high" | "medium" | "low" | null;
}

async function callVisionAPI(imageUrl: string, log: (m: string) => void): Promise<VisionResult> {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

  const prompt = `You are analyzing a screenshot of a product page from an e-commerce website (likely Chinese: Pinduoduo, Poizon/Dewu, 95fen, Xianyu, Xiaohongshu, Taobao, JD, or similar).

Extract the following fields and return ONLY a valid JSON object (no markdown, no explanation):

- title: Full product name. Keep original language for brand names (Nike, Adidas, etc.) but TRANSLATE Chinese product titles to Russian. Look at ALL visible text: header, alt text, product badges, breadcrumbs, image labels, price-tag captions. If you see ANY text that names the product (even partial), provide your best inference of the full title. Return null ONLY if there's truly no product-naming text visible anywhere on the screen.
- price: The current selling price as a number (without currency symbols, commas, spaces). Use '.' as decimal separator. If multiple prices visible (original/discount/sale/etc.), pick the MAIN current selling price (usually the largest/highlighted one). Return null if no price visible.
- currency: ISO 4217 code (CNY, USD, EUR, RUB, GBP, BYN). Infer from symbol: ¥/元/￥→CNY, $→USD, €→EUR, ₽→RUB, £→GBP, Br→BYN. Return null if cannot determine.
- brand: Brand name if shown (Nike, Adidas, ANTA, Li-Ning, etc.). Return null if not shown or no-name product.
- category: MUST be one of "Обувь", "Одежда", "Аксессуары" (in Russian only). Determine from product photo:
    * Shoes/sneakers/sandals/boots → "Обувь"
    * T-shirts/jackets/pants/dresses/hoodies → "Одежда"
    * Bags/wallets/watches/jewelry/sunglasses/hats/belts → "Аксессуары"
    Return null only if you cannot see the product photo at all.
- description: 1-2 sentence summary in **Russian** of key product features (material, design notes, intended use). MUST be Russian even if all source text is Chinese — translate accurately. Do NOT include the title or price here. Return null if no useful feature info visible.
- color: Main color(s) in Russian, e.g. "Чёрный", "Белый", "Синий/Красный", "Бежевый". Determine from the product photo. Return null if photo not visible.
- confidence: One of "high" (clear product page with title and price both visible), "medium" (most data clear but title or some other field inferred from partial info), "low" (significant gaps — likely cropped or wrong screenshot). Always provide this field.

CRITICAL RULES:
- TRANSLATE description and color to Russian. Do NOT leave them in Chinese/English.
- For title: if you see partial product name, INFER the full title from context (don't be overly cautious about returning null).
- Return null (not empty string) only when truly no info is available.
- Output JSON only, no markdown fences, no explanation, no extra text.

Return JSON only:`;

  const body = {
    model: VISION_MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    temperature: 0,
    max_tokens: 1200,
  };

  log(`Vision: calling model=${VISION_MODEL}`);
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://icelogix.app",
      "X-Title": "ICE LOGIX parse-screenshot",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errTxt = await res.text().catch(() => "");
    throw new Error(`OpenRouter HTTP ${res.status}: ${errTxt.slice(0, 300)}`);
  }

  const data = await res.json();
  const usage = data?.usage;
  if (usage) {
    log(`Vision usage: prompt_tokens=${usage.prompt_tokens} completion_tokens=${usage.completion_tokens} total=${usage.total_tokens}`);
  }

  const raw = data?.choices?.[0]?.message?.content || "";
  if (!raw) throw new Error("Vision API returned empty content");

  const parsed = parseAssistantJson(raw);

  // Normalize price
  let price: number | null = null;
  const priceRaw = parsed.price;
  if (typeof priceRaw === "number" && !isNaN(priceRaw) && priceRaw > 0) {
    price = priceRaw;
  } else if (typeof priceRaw === "string" && priceRaw.trim()) {
    const n = parseFloat(priceRaw.replace(/[^\d.,]/g, "").replace(",", "."));
    if (!isNaN(n) && n > 0) price = n;
  }

  const strOrNull = (v: unknown): string | null => {
    if (typeof v === "string" && v.trim()) return v.trim();
    return null;
  };

  const confidenceRaw = strOrNull(parsed.confidence);
  const confidence =
    confidenceRaw === "high" || confidenceRaw === "medium" || confidenceRaw === "low"
      ? confidenceRaw
      : null;

  return {
    title: strOrNull(parsed.title),
    price,
    currency: normalizeCurrency(strOrNull(parsed.currency)),
    brand: strOrNull(parsed.brand),
    category: strOrNull(parsed.category),
    description: strOrNull(parsed.description),
    color: strOrNull(parsed.color),
    confidence,
  };
}

// ─── Main handler ────────────────────────────────────────────────────────────

interface RequestBody {
  jobId: string;
  screenshotPath: string;
}

Deno.serve(async (req) => {
  const log = (msg: string) => console.log(`[parse-screenshot] ${msg}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let jobId: string | null = null;

  try {
    const body = (await req.json()) as Partial<RequestBody>;
    if (!body.jobId || !body.screenshotPath) {
      return new Response(
        JSON.stringify({ error: "Missing jobId or screenshotPath" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    jobId = body.jobId;
    const screenshotPath = body.screenshotPath;
    log(`Job ${jobId}: screenshot=${screenshotPath}`);

    // 1. Помечаем job как pending — фронт увидит, что обработка началась
    await supabase
      .from("parse_queue")
      .update({
        status: "pending",
        screenshot_path: screenshotPath,
        error_message: null,
        parse_method: "screenshot_pending",
      })
      .eq("id", jobId);

    // 2. Создаём signed URL для скриншота (Vision API его скачает)
    const { data: signed, error: signErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(screenshotPath, 600);

    if (signErr || !signed?.signedUrl) {
      throw new Error(`Storage signed URL failed: ${signErr?.message || "unknown"}`);
    }
    log(`Storage: signed URL created (expires in 600s)`);

    // 3. Вызов Vision API
    const result = await callVisionAPI(signed.signedUrl, log);
    log(
      `Vision result: title="${result.title}", price=${result.price} ${result.currency}, confidence=${result.confidence}`,
    );

    // 4. Решаем итоговый статус по умному dispatch'у
    const hasTitle = !!result.title;
    const hasPrice = !!(result.price && result.price > 0);

    let finalStatus: string;
    let errorMessage: string | null;

    if (hasTitle && hasPrice) {
      finalStatus = "done";
      errorMessage = null;
    } else if (hasPrice && !hasTitle) {
      finalStatus = "manual_required";
      errorMessage =
        "Я нашёл цену и описание товара, но не вижу название. Загрузите ещё один скриншот с заголовком (верхняя часть страницы товара) или введите название вручную.";
    } else if (hasTitle && !hasPrice) {
      finalStatus = "manual_required";
      errorMessage =
        "Я распознал название товара, но не вижу цену. Загрузите скриншот с ценой или введите её вручную.";
    } else {
      finalStatus = "manual_required";
      errorMessage =
        "Не удалось распознать товар на скриншоте. Загрузите более чёткий скриншот товарной страницы или введите название и цену вручную.";
    }

    log(
      `Decision: hasTitle=${hasTitle} hasPrice=${hasPrice} → status=${finalStatus}`,
    );

    // 5. Обновляем parse_queue
    const { error: updateErr } = await supabase
      .from("parse_queue")
      .update({
        status: finalStatus,
        title: result.title,
        price: result.price,
        currency: result.currency,
        brand: result.brand,
        category: result.category,
        description: result.description,
        color: result.color,
        parse_method: "screenshot_vision",
        error_message: errorMessage,
      })
      .eq("id", jobId);

    if (updateErr) throw new Error(`DB update: ${updateErr.message}`);
    log(`Completed: status=${finalStatus}`);

    return new Response(
      JSON.stringify({
        ok: true,
        status: finalStatus,
        title: result.title,
        price: result.price,
        currency: result.currency,
        brand: result.brand,
        category: result.category,
        description: result.description,
        color: result.color,
        confidence: result.confidence,
        error_message: errorMessage,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log(`Error: ${msg}`);
    if (jobId) {
      await supabase
        .from("parse_queue")
        .update({
          status: "manual_required",
          error_message: `Ошибка распознавания скриншота: ${msg.slice(0, 200)}. Введите данные вручную.`,
          parse_method: "screenshot_error",
        })
        .eq("id", jobId);
    }
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
