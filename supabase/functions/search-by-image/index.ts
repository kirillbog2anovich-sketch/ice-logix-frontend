// supabase/functions/search-by-image/index.ts
// ICE LOGIX — search-by-image v2.0 (Apify Google Lens)
//
// Поиск товара по фото. Двухступенчатый pipeline:
//   1. PRIMARY  — Apify actor `borderline/google-lens` (Google Lens reverse image search).
//                  Возвращает реальные shopping-результаты с маркетплейсов.
//   2. FALLBACK — OpenRouter Vision (Gemini) → описание → search-products (Firecrawl).
//                  Используется если APIFY_API_TOKEN не задан, Apify упал, или вернул 0 результатов.
//
// Поток:
//   1. Принимает screenshotPath (путь в bucket product-screenshots)
//   2. Создаёт signed URL для файла (600 сек)
//   3. PRIMARY: вызывает Apify actor с imageUrls + searchTypes=["products"]
//   4. Фильтрует результаты по нашим маркетплейсам (poizon, taobao, zalando, asos, farfetch и т.д.)
//   5. Если результатов < 2 — fallback на Vision+search-products
//   6. Возвращает unified response с полем `source: "apify" | "vision-fallback"`
//
// Использование:
//   POST /functions/v1/search-by-image
//   Body: { "screenshotPath": "user_id/123_photo.jpg", "platforms": ["poizon","zalando"] }
//
// Версия: 2026.05.04.02

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN") || "";
const VISION_MODEL = Deno.env.get("OPENROUTER_VISION_MODEL") || "google/gemini-2.0-flash-001";
const STORAGE_BUCKET = "product-screenshots";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Маркетплейсы которые мы умеем обрабатывать ─────────────────────────────
type PlatformInfo = {
  key: string;        // internal id
  label: string;      // display name
  flag: string;       // emoji
  hosts: string[];    // hostnames (without www.)
  country: string;    // ISO-2 (или "EU" для общеевропейских)
};

const PLATFORMS: PlatformInfo[] = [
  { key: "poizon",      label: "Poizon",      flag: "🇨🇳", hosts: ["poizon.com", "dewu.com", "dewuapp.com"], country: "CN" },
  { key: "taobao",      label: "Taobao",      flag: "🇨🇳", hosts: ["taobao.com", "tmall.com", "world.taobao.com", "intl.taobao.com"], country: "CN" },
  { key: "1688",        label: "1688",        flag: "🇨🇳", hosts: ["1688.com"], country: "CN" },
  { key: "zalando",     label: "Zalando",     flag: "🇵🇱", hosts: ["zalando.pl", "zalando.de", "zalando.com", "zalando-lounge.pl", "zalando-lounge.de"], country: "PL" },
  { key: "asos",        label: "ASOS",        flag: "🇬🇧", hosts: ["asos.com"], country: "UK" },
  { key: "farfetch",    label: "Farfetch",    flag: "🇪🇺", hosts: ["farfetch.com"], country: "EU" },
  { key: "aboutyou",    label: "About You",   flag: "🇩🇪", hosts: ["aboutyou.com", "aboutyou.de"], country: "DE" },
  // Дополнительные люксовые / sneaker-маркетплейсы — часто в выдаче Google Lens
  { key: "goat",        label: "GOAT",        flag: "🇺🇸", hosts: ["goat.com"], country: "US" },
  { key: "stockx",      label: "StockX",      flag: "🇺🇸", hosts: ["stockx.com"], country: "US" },
  { key: "ssense",      label: "SSENSE",      flag: "🇨🇦", hosts: ["ssense.com"], country: "EU" },
  { key: "endclothing", label: "End Clothing",flag: "🇬🇧", hosts: ["endclothing.com"], country: "UK" },
  { key: "mrporter",    label: "Mr Porter",   flag: "🇬🇧", hosts: ["mrporter.com", "net-a-porter.com"], country: "UK" },
  { key: "mytheresa",   label: "Mytheresa",   flag: "🇩🇪", hosts: ["mytheresa.com"], country: "DE" },
  { key: "sneakerstudio", label: "SneakerStudio", flag: "🇵🇱", hosts: ["sneakerstudio.com"], country: "PL" },
  { key: "wildberries", label: "Wildberries", flag: "🇷🇺", hosts: ["wildberries.ru", "wildberries.by"], country: "RU" },
  { key: "ozon",        label: "Ozon",        flag: "🇷🇺", hosts: ["ozon.ru"], country: "RU" },
  { key: "lamoda",      label: "Lamoda",      flag: "🇷🇺", hosts: ["lamoda.ru", "lamoda.by"], country: "RU" },
];

// Дефолтный белый список (без РФ — клиент в Беларуси может купить там сам).
// Включаем GOAT/StockX/SSENSE/etc — Google Lens часто находит товары именно там.
const DEFAULT_PLATFORMS = [
  "poizon", "taobao", "zalando", "asos", "farfetch",
  "goat", "stockx", "ssense", "endclothing", "mrporter", "mytheresa",
  "sneakerstudio", "aboutyou",
];

function platformForUrl(rawUrl: string): PlatformInfo | null {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, "");
    for (const p of PLATFORMS) {
      for (const h of p.hosts) {
        if (host === h || host.endsWith("." + h)) return p;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Apify Google Lens — primary ────────────────────────────────────────────
//
// Структура ответа от actor `borderline/google-lens` для searchTypes=["visual-match","exact-match"]:
//   [
//     {
//       "visual-match": { "results": [ { "search": { "title", "href", "description" } }, ... ] },
//       "exact-match":  { "results": [ { "search": { "title", "href", "description" } }, ... ] },
//       "global":       { "results": [ { "error": "...", "message": "...", ... } ] }   // когда поиск ничего не нашёл
//     }
//   ]
type ApifyHit = {
  search?: {
    title?: string;
    href?: string;
    description?: string;
  };
  // Older / alternate shape — defensive
  title?: string;
  href?: string;
  link?: string;
  url?: string;
  description?: string;
  thumbnail?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  source?: string;
  price?: string;
};

type ApifyBucket = { results?: ApifyHit[] };

type ApifyDatasetItem = {
  "visual-match"?: ApifyBucket;
  "exact-match"?: ApifyBucket;
  "products"?: ApifyBucket;
  "all"?: ApifyBucket;
  "global"?: ApifyBucket;
  // Defensive — older shapes
  visualMatches?: ApifyHit[];
  exactMatches?: ApifyHit[];
  results?: ApifyHit[];
};

function extractApifyHits(items: ApifyDatasetItem[]): ApifyHit[] {
  const out: ApifyHit[] = [];
  for (const it of items) {
    const buckets: Array<ApifyHit[] | undefined> = [
      it["visual-match"]?.results,
      it["exact-match"]?.results,
      it["products"]?.results,
      it["all"]?.results,
      it.visualMatches,
      it.exactMatches,
      it.results,
    ];
    for (const b of buckets) {
      if (Array.isArray(b)) out.push(...b);
    }
  }
  return out;
}

function hitUrl(h: ApifyHit): string {
  return String(h.search?.href || h.href || h.link || h.url || "").trim();
}

// Известные source-имена которые borderline-actor префиксует к title
const KNOWN_SOURCE_PREFIXES: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /^GOAT(?=[A-ZА-Я0-9])/i,           name: "GOAT" },
  { pattern: /^eBay(?=[A-ZА-Я0-9])/i,           name: "eBay" },
  { pattern: /^StockX(?=[A-ZА-Я0-9])/i,         name: "StockX" },
  { pattern: /^Zalando(?=[A-ZА-Я0-9])/i,        name: "Zalando" },
  { pattern: /^ASOS(?=[A-ZА-Я0-9])/i,           name: "ASOS" },
  { pattern: /^Farfetch(?=[A-ZА-Я0-9])/i,       name: "Farfetch" },
  { pattern: /^SSENSE(?=[A-ZА-Я0-9])/i,         name: "SSENSE" },
  { pattern: /^MR PORTER(?=[A-ZА-Я0-9])/i,      name: "MR PORTER" },
  { pattern: /^MYTHERESA(?=[A-ZА-Я0-9])/i,      name: "MYTHERESA" },
  { pattern: /^Mytheresa(?=[A-ZА-Я0-9])/i,      name: "Mytheresa" },
  { pattern: /^Net-A-Porter(?=[A-ZА-Я0-9])/i,   name: "Net-A-Porter" },
  { pattern: /^END\.(?=[A-ZА-Я0-9])/i,          name: "END." },
  { pattern: /^Poizon(?=[A-ZА-Я0-9])/i,         name: "Poizon" },
  { pattern: /^Dewu(?=[A-ZА-Я0-9])/i,           name: "Dewu" },
  { pattern: /^Taobao(?=[A-ZА-Я0-9])/i,         name: "Taobao" },
  { pattern: /^Tmall(?=[A-ZА-Я0-9])/i,          name: "Tmall" },
  { pattern: /^Wildberries(?=[A-ZА-Я0-9])/i,    name: "Wildberries" },
  { pattern: /^Lamoda(?=[A-ZА-Я0-9])/i,         name: "Lamoda" },
  { pattern: /^Ozon(?=[A-ZА-Я0-9])/i,           name: "Ozon" },
  { pattern: /^Aboutyou(?=[A-ZА-Я0-9])/i,       name: "Aboutyou" },
  { pattern: /^About You(?=[A-ZА-Я0-9])/i,      name: "About You" },
];

function hitTitle(h: ApifyHit): string {
  let t = String(h.search?.title || h.title || "").trim();
  if (!t) return "";

  // borderline-actor использует формат: "{SourceName}{ProductTitle} [| {Source[+extra]}]"
  // Примеры:
  //   "GOATBuy Nike Free RN Flyknit 2017 - 880843 600 | GOAT"
  //   "GOATBuy Nike Free Flyknit HTM SP - 616171 740 | GOATIn stock"
  //   "eBayPre-Owned Nike Free RN Flyknit Red ... | eBayUsed"

  // 1. Срезаем суффикс " | {Source[+extra]}" — всё что после "|"
  t = t.replace(/\s*\|\s*[A-Za-zА-Яа-я0-9 .,()'·-]{2,80}\s*$/, "").trim();

  // 2. Срезаем известный source-префикс (склеенный с title)
  for (const { pattern } of KNOWN_SOURCE_PREFIXES) {
    if (pattern.test(t)) {
      t = t.replace(pattern, "").trim();
      break;
    }
  }

  // 3. Срезаем известные торговые префиксы
  t = t.replace(/^(?:Buy|Pre-Owned|Used|New|Sponsored|Authentic|Authenticated|Shop)\s+/i, "").trim();

  return t;
}

function hitImage(h: ApifyHit): string | null {
  return h.thumbnail || h.thumbnailUrl || h.imageUrl || null;
}

function priceFromText(text: string | undefined): { price: number | null; currency: string | null } {
  if (!text) return { price: null, currency: null };
  const cleaned = text.replace(/\s+/g, " ").trim();
  // Try to find currency symbol/code
  const currencyMatch = cleaned.match(/(USD|EUR|GBP|CNY|RUB|BYN|PLN|JPY|KRW|\$|€|£|¥|₽|zł|Br)/i);
  const currencyMap: Record<string, string> = {
    "$": "USD", "€": "EUR", "£": "GBP", "¥": "CNY", "₽": "RUB", "zł": "PLN", "br": "BYN",
  };
  let currency: string | null = null;
  if (currencyMatch) {
    const m = currencyMatch[0].toLowerCase();
    currency = currencyMap[m] || currencyMatch[0].toUpperCase();
  }
  const numMatch = cleaned.match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)/);
  let price: number | null = null;
  if (numMatch) {
    const raw = numMatch[1];
    // Handle "1,234.56" vs "1.234,56"
    const lastComma = raw.lastIndexOf(",");
    const lastDot = raw.lastIndexOf(".");
    let normalized = raw;
    if (lastComma > lastDot) {
      // EU style: 1.234,56
      normalized = raw.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = raw.replace(/,/g, "");
    }
    const n = parseFloat(normalized);
    if (isFinite(n) && n > 0) price = n;
  }
  return { price, currency };
}

type ApifyResultItem = {
  platform: string;
  platform_label: string;
  flag: string;
  title: string;
  url: string;
  price: number | null;
  currency: string | null;
  image_url: string | null;
  score: number;
};

// Returns all raw hits + exact-match URL set. Caller decides how to filter.
async function searchByImageViaApifyFull(
  imageUrl: string,
): Promise<{
  ok: boolean;
  allHits: ApifyHit[];
  exactUrls: Set<string>;
  raw_count: number;
  error?: string;
}> {
  if (!APIFY_API_TOKEN) {
    return { ok: false, allHits: [], exactUrls: new Set(), raw_count: 0, error: "APIFY_API_TOKEN not configured" };
  }

  const actorId = "borderline~google-lens";
  // Apify Lens actor: warm runs complete in 45-75s; cold-start adds 30-60s overhead.
  // Edge Function wall-clock is 150s. Set actor timeout=140 + memory=1024 (1GB; faster cold-start)
  // — leaves ~10s for marshalling. Cold-start runs may still time out → fallback handles it.
  const runUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${encodeURIComponent(APIFY_API_TOKEN)}&timeout=140&memory=1024`;

  // Use only "visual-match" — most reliable for shopping (returns real product pages).
  // Cost: $0.01 (start, 1GB) + $0.0015 (visual-match) = $0.0115/call.
  // ("products" mode is unreliable — often returns "no results").
  // ("exact-match" rarely adds value for new photos and doubles cost).
  const input = {
    imageUrls: [{ url: imageUrl }],
    searchTypes: ["visual-match"],
    language: "en",
  };

  let items: ApifyDatasetItem[] = [];
  try {
    const res = await fetch(runUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, allHits: [], exactUrls: new Set(), raw_count: 0, error: `Apify HTTP ${res.status}: ${txt.substring(0, 200)}` };
    }
    items = await res.json();
    if (!Array.isArray(items)) items = [];
  } catch (e) {
    return { ok: false, allHits: [], exactUrls: new Set(), raw_count: 0, error: `Apify call failed: ${(e as Error).message}` };
  }

  const allHits = extractApifyHits(items);

  const exactUrls = new Set<string>();
  for (const it of items) {
    for (const r of (it["exact-match"]?.results || [])) {
      const u = hitUrl(r);
      if (u) exactUrls.add(u);
    }
  }

  return { ok: true, allHits, exactUrls, raw_count: allHits.length };
}

// ─── Vision: получаем поисковый запрос (FALLBACK) ───────────────────────────
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

  const requestedPlatforms = (Array.isArray(body.platforms) && body.platforms.length > 0)
    ? body.platforms
    : DEFAULT_PLATFORMS;
  const allowedKeys = new Set(requestedPlatforms);

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

  // 2. PRIMARY: Apify Google Lens — визуальное распознавание + прямые ссылки на маркетплейсы
  const apifyResp = await searchByImageViaApifyFull(signed.signedUrl);
  const directMatches: ApifyResultItem[] = [];
  let lensTitle: string | null = null;
  if (apifyResp.ok) {
    // Direct matches на наших платформах
    for (const h of apifyResp.allHits) {
      const link = hitUrl(h);
      if (!link || !/^https?:\/\//i.test(link)) continue;
      const platform = platformForUrl(link);
      if (!platform) continue;
      if (allowedKeys.size > 0 && !allowedKeys.has(platform.key)) continue;
      const { price, currency } = priceFromText(h.price);
      directMatches.push({
        platform: platform.key,
        platform_label: platform.label,
        flag: platform.flag,
        title: hitTitle(h),
        url: link,
        price,
        currency,
        image_url: hitImage(h),
        score: apifyResp.exactUrls.has(link) ? 3 : 2,
      });
    }
    // Lens title — название товара которое распознал Google Lens (для поиска на наших платформах)
    for (const h of apifyResp.allHits) {
      const t = hitTitle(h);
      if (t && t.length >= 8 && t.length <= 120) {
        // Skip useless titles like "FlatLayersLong Sleeve Tee – RetalSee exact matches"
        if (/See exact matches|See similar|See more|Search the web/i.test(t)) continue;
        lensTitle = t;
        break;
      }
    }
  }

  // 3. SECONDARY: search-products с распознанным Lens-названием (для дополнения direct-matches)
  let searchProductsResults: ApifyResultItem[] = [];
  if (lensTitle) {
    try {
      const sp = await callSearchProducts(lensTitle, requestedPlatforms);
      const spData = sp as { ok?: boolean; results?: Array<Record<string, unknown>> };
      if (spData.ok && Array.isArray(spData.results)) {
        for (const r of spData.results) {
          const url = String(r.url || "");
          if (!url) continue;
          const platform = platformForUrl(url);
          if (!platform) continue;
          if (directMatches.some((d) => d.url === url)) continue; // dedup
          searchProductsResults.push({
            platform: platform.key,
            platform_label: platform.label,
            flag: platform.flag,
            title: String(r.title || lensTitle),
            url,
            price: typeof r.price === "number" ? r.price : null,
            currency: typeof r.currency === "string" ? r.currency : null,
            image_url: typeof r.image_url === "string" ? r.image_url : null,
            score: 1,
          });
        }
      }
    } catch (_e) {
      // ignore — fallback ниже всё равно отработает
    }
  }

  const combined = [...directMatches, ...searchProductsResults]
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  if (combined.length >= 2) {
    return new Response(
      JSON.stringify({
        ok: true,
        source: lensTitle ? "apify+search-products" : "apify",
        query: lensTitle,
        platforms: requestedPlatforms,
        total: combined.length,
        results: combined,
        apify_raw_count: apifyResp.raw_count,
        apify_direct: directMatches.length,
        from_search: searchProductsResults.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 4. FALLBACK: Vision API + search-products (когда Apify упал/0 результатов)
  let visionResult;
  try {
    visionResult = await describeProductForSearch(signed.signedUrl);
  } catch (e) {
    return new Response(
      JSON.stringify({
        ok: false,
        source: "vision-fallback",
        error: `Vision API: ${(e as Error).message}`,
        apify_error: apifyResp.error || null,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!visionResult.query || visionResult.query.length < 3) {
    return new Response(
      JSON.stringify({
        ok: false,
        source: "vision-fallback",
        error: "Не удалось распознать товар на фото. Попробуйте более чёткое изображение или используйте поиск по описанию.",
        vision_query: visionResult.query,
        apify_error: apifyResp.error || null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let searchResp;
  try {
    searchResp = await callSearchProducts(visionResult.query, requestedPlatforms);
  } catch (e) {
    return new Response(
      JSON.stringify({
        ok: false,
        source: "vision-fallback",
        error: `search-products: ${(e as Error).message}`,
        vision_query: visionResult.query,
        apify_error: apifyResp.error || null,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({
      ...(searchResp as Record<string, unknown>),
      source: "vision-fallback",
      vision_query: visionResult.query,
      vision_brand: visionResult.brand,
      vision_product_type: visionResult.product_type,
      vision_category: visionResult.category,
      vision_color: visionResult.color,
      apify_error: apifyResp.error || null,
      apify_raw_count: apifyResp.raw_count,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
