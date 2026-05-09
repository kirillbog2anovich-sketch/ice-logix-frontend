// supabase/functions/search-by-image/index.ts
// ICE LOGIX — search-by-image v1.0
//
// Поиск товара по фото — использует Vision API (OpenRouter, Gemini 2.0 Flash) для
// извлечения описания товара из изображения, а затем search-products для поиска
// похожих товаров на разных площадках.
//
// Поток:
//   1. Принимает screenshotPath (путь в bucket product-screenshots)
//   2. Создаёт signed URL для файла
//   3. Vision API: «опиши товар максимально кратко для поискового запроса»
//   4. Получаем строку вида "Nike Dunk Low Panda кроссовки"
//   5. Дёргаем search-products с этой строкой → возвращаем результат + использованный query
//
// Использование:
//   POST /functions/v1/search-by-image
//   Body: { "screenshotPath": "user_id/123_photo.jpg", "platforms": ["poizon","zalando"] }
//
// Версия: 2026.05.08.01

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const VISION_MODEL = Deno.env.get("OPENROUTER_VISION_MODEL") || "google/gemini-2.0-flash-001";
const STORAGE_BUCKET = "product-screenshots";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Vision: получаем поисковый запрос ──────────────────────────────────────
async function describeProductForSearch(imageUrl: string): Promise<{ query: string; brand: string | null; product_type: string | null; category: string | null; color: string | null }> {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

  const prompt = `Ты эксперт по идентификации товаров (одежда / обувь / аксессуары / электроника).
На фото — товар. Дай МАКСИМАЛЬНО ТОЧНЫЙ поисковый запрос (англ. + рус. для лучшего матчинга) для нахождения ИМЕННО ЭТОЙ модели на Poizon, Zalando, Farfetch, ASOS.

Стратегия:
1. Найди ВИДИМЫЙ логотип/бренд и название модели (Nike Dunk Low, Adidas Samba, Stussy, Carhartt WIP, Stone Island, Travis Scott, Yeezy, и т.д.)
2. Если видишь конкретную ЦВЕТОВУЮ ВЕРСИЮ (Panda, Triple White, Black, "белые на чёрной подошве") — ОБЯЗАТЕЛЬНО включи
3. Категория-наименование: кроссовки / кеды / худи / футболка / джинсы / куртка / пуховик / рюкзак / часы и т.п.
4. Если бренд НЕ виден — описывай по силуэту, материалу, цвету, типу (например: «черная пуховая куртка с капюшоном»)

Запрос: 5-12 слов, без размеров/цен/локаций.

ТАКЖЕ верни:
- brand: точное название бренда (Nike, Adidas, etc.) или null
- product_type: конкретное наименование (кроссовки, худи, джинсы, рюкзак, часы) или null
- category: одно из ["Обувь","Одежда","Аксессуары","Электроника","Другое"] или null
- color: основной цвет на русском или null

Только JSON:
{"query":"Nike Dunk Low Panda black white","brand":"Nike","product_type":"Кроссовки","category":"Обувь","color":"чёрно-белые"}`;

  const body = {
    model: VISION_MODEL,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: imageUrl } },
      ],
    }],
    temperature: 0,
    max_tokens: 200,
  };

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://icelogix.by",
      "X-Title": "ICE LOGIX search-by-image",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "<no body>");
    throw new Error(`OpenRouter ${res.status}: ${errText.substring(0, 200)}`);
  }

  const data = await res.json();
  const raw = String(data?.choices?.[0]?.message?.content ?? "").trim();
  const cleaned = raw.startsWith("```")
    ? raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/s, "").trim()
    : raw;

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      query: cleaned.split("\n")[0].slice(0, 100),
      brand: null,
      product_type: null,
      category: null,
      color: null,
    };
  }

  return {
    query: typeof parsed.query === "string" ? parsed.query.trim() : "",
    brand: typeof parsed.brand === "string" ? parsed.brand.trim() : null,
    product_type: typeof parsed.product_type === "string" ? parsed.product_type.trim() : null,
    category: typeof parsed.category === "string" ? parsed.category.trim() : null,
    color: typeof parsed.color === "string" ? parsed.color.trim() : null,
  };
}

// ─── Внутренний вызов search-products ───────────────────────────────────────
async function callSearchProducts(query: string, platforms: string[] | undefined): Promise<unknown> {
  const url = `${SUPABASE_URL}/functions/v1/search-products`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ query, platforms }),
  });
  if (!res.ok) throw new Error(`search-products ${res.status}`);
  return await res.json();
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "POST only" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { screenshotPath?: string; platforms?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const path = (body.screenshotPath || "").trim();
  if (!path) {
    return new Response(JSON.stringify({ ok: false, error: "screenshotPath обязателен" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1. Signed URL
  const { data: signed, error: signedErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, 600);
  if (signedErr || !signed?.signedUrl) {
    return new Response(
      JSON.stringify({ ok: false, error: `signed URL: ${signedErr?.message ?? "unknown"}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 2. Vision → query
  let visionResult;
  try {
    visionResult = await describeProductForSearch(signed.signedUrl);
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: `Vision API: ${(e as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!visionResult.query || visionResult.query.length < 3) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Не удалось распознать товар на фото. Попробуйте более чёткое изображение или используйте поиск по описанию.",
        vision_query: visionResult.query,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 3. Поиск через search-products
  let searchResp;
  try {
    searchResp = await callSearchProducts(visionResult.query, body.platforms);
  } catch (e) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: `search-products: ${(e as Error).message}`,
        vision_query: visionResult.query,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({
      ...(searchResp as Record<string, unknown>),
      vision_query: visionResult.query,
      vision_brand: visionResult.brand,
      vision_product_type: visionResult.product_type,
      vision_category: visionResult.category,
      vision_color: visionResult.color,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
