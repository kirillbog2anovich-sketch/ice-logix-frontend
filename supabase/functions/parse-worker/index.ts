import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- Конфигурация Supabase ---
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- API Ключи ---
const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const DEEPSEEK_KEY = Deno.env.get("DEEPSEEK_API_KEY") || "";
const CRAWLBASE_JS_TOKEN = Deno.env.get("CRAWLBASE_JS_TOKEN") || "";

// --- Список китайских доменов ---
const CHINESE_DOMAINS = [
  "poizon.com", "dewu.com", "taobao.com", "tmall.com",
  "1688.com", "jd.com", "vip.com", "mogujie.com",
  "yougou.com", "yohobuy.com", "secoo.com",
];

function isChineseUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return CHINESE_DOMAINS.some((domain) => hostname.includes(domain));
  } catch {
    return false;
  }
}

function marketplaceFromUrl(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

function parseAssistantJson(content: string): unknown {
  let raw = (content || "").trim();
  if (raw.startsWith("```")) {
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/s, "").trim();
  }
  return JSON.parse(raw);
}

// --- Шаг 1a: Crawlbase (для китайских сайтов) ---
async function fetchViaCrawlbase(url: string): Promise<string> {
  if (!CRAWLBASE_JS_TOKEN) throw new Error("CRAWLBASE_JS_TOKEN not configured");

  const crawlbaseUrl =
    `https://api.crawlbase.com/?token=${CRAWLBASE_JS_TOKEN}&url=${encodeURIComponent(url)}`;
  const res = await fetch(crawlbaseUrl);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Crawlbase error: ${res.status} ${errText}`);
  }

  return await res.text();
}

// --- Шаг 1b: Firecrawl (основной / fallback) ---
async function fetchMarkdown(url: string): Promise<string> {
  if (!FIRECRAWL_KEY) throw new Error("FIRECRAWL_API_KEY not configured");

  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${FIRECRAWL_KEY}`,
    },
    body: JSON.stringify({ url, formats: ["markdown"] }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firecrawl error: ${res.status} ${errText}`);
  }

  const { data } = await res.json();
  return data.markdown || "";
}

// --- Шаг 2: Извлечение данных с помощью DeepSeek ---
async function extractData(
  content: string,
  url: string,
): Promise<{
  title: string | null;
  price: number | null;
  currency: string | null;
  category: string | null;
  description: string | null;
  color: string | null;
  brand: string | null;
  marketplace: string | null;
}> {
  if (!DEEPSEEK_KEY) throw new Error("DEEPSEEK_API_KEY not configured");

  const isHtml = content.trimStart().startsWith("<");
  const contentType = isHtml ? "HTML" : "Markdown";

  const prompt =
    `You are a precise e-commerce data extractor. You are analyzing a product page in ${contentType} format. Extract the following fields and return a single JSON object with these exact keys. Use null for any missing value. Do not include any text outside the JSON.

Fields to extract:
- title: Full product name.
- price: The current selling price as a number (without currency symbols or commas). Use '.' as decimal separator. Do not convert the price to another currency. Use exactly the numeric value shown on the page. If multiple prices are displayed, pick the main/default one.
- currency: The currency code or symbol that appears next to the price (e.g., USD, EUR, CNY, GBP, BYN, RUB, $, €, ¥). If the page shows both a symbol and a code, prefer the ISO code (e.g., USD instead of $). If you cannot determine it, return null.
- category: The product category in Russian, chosen from: "Обувь", "Одежда", "Аксессуары". Determine by product name, description, or breadcrumbs. If none matches, return null.
- description: A short description (1-2 sentences) in Russian summarizing the product.
- color: The main color(s) in Russian, e.g. "Черный/Белый".
- brand: The manufacturer brand name, e.g. "Nike", "Adidas".

${contentType} content:
${content.substring(0, 8000)}`;

  const dsRes = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    }),
  });

  if (!dsRes.ok) {
    throw new Error(`DeepSeek error: ${dsRes.status}`);
  }

  const dsData = await dsRes.json();
  const marketplace = marketplaceFromUrl(url);

  try {
    const parsed = parseAssistantJson(
      dsData.choices[0].message.content,
    ) as Record<string, unknown>;

    // --- Цена ---
    let finalPrice: number | null = null;
    if (typeof parsed.price === "number" && !isNaN(parsed.price) && parsed.price > 0) {
      finalPrice = parsed.price;
    } else if (parsed.price != null && String(parsed.price).trim() !== "") {
      const n = parseFloat(
        String(parsed.price).replace(/\s/g, "").replace(/,/g, "."),
      );
      if (!isNaN(n) && n > 0) finalPrice = n;
    }

    // --- Валюта ---
    let finalCurrency: string | null = null;
    if (typeof parsed.currency === "string" && parsed.currency.length > 0) {
      const rawCurrency = parsed.currency.toUpperCase();
      if (rawCurrency === "$" || rawCurrency === "USD") finalCurrency = "USD";
      else if (rawCurrency === "€" || rawCurrency === "EUR") finalCurrency = "EUR";
      else if (rawCurrency === "¥" || rawCurrency === "CNY" || rawCurrency === "RMB") finalCurrency = "CNY";
      else if (rawCurrency === "£" || rawCurrency === "GBP") finalCurrency = "GBP";
      else if (rawCurrency === "₽" || rawCurrency === "RUB" || rawCurrency === "RUR") finalCurrency = "RUB";
      else if (rawCurrency === "BYN" || rawCurrency === "BYR") finalCurrency = "BYN";
      else finalCurrency = rawCurrency;
    }

    // Fallback: ищем валюту в тексте контента
    if (!finalCurrency) {
      const currencyMatch = content.match(/(USD|EUR|CNY|GBP|BYN|RUB|\$|€|¥|₽)/i);
      if (currencyMatch) {
        const found = currencyMatch[1].toUpperCase();
        if (found === "$") finalCurrency = "USD";
        else if (found === "€") finalCurrency = "EUR";
        else if (found === "¥") finalCurrency = "CNY";
        else if (found === "₽") finalCurrency = "RUB";
        else finalCurrency = found;
      }
    }

    const brand = parsed.brand != null && String(parsed.brand).trim() !== ""
      ? String(parsed.brand).trim()
      : null;

    return {
      title: parsed.title != null && String(parsed.title).trim() !== ""
        ? String(parsed.title).trim()
        : null,
      price: finalPrice,
      currency: finalCurrency,
      category: parsed.category != null && String(parsed.category).trim() !== ""
        ? String(parsed.category).trim()
        : null,
      description: parsed.description != null && String(parsed.description).trim() !== ""
        ? String(parsed.description).trim()
        : null,
      color: parsed.color != null && String(parsed.color).trim() !== ""
        ? String(parsed.color).trim()
        : null,
      brand,
      marketplace,
    };
  } catch {
    // Fallback regex (работает и для HTML, и для Markdown)
    const titleMatch = content.match(/^#\s(.+)$/m);
    const priceMatch = content.match(
      /(\d+[\.,]\d{1,2})\s?(USD|EUR|CNY|GBP|BYN|RUB|\$|€|¥|₽|£|руб)/i,
    );
    let price: number | null = null;
    let currency: string | null = null;
    if (priceMatch) {
      price = parseFloat(priceMatch[1].replace(",", "."));
      const sym = priceMatch[2];
      if (/^руб$/i.test(sym)) currency = "RUB";
      else if (sym === "$") currency = "USD";
      else if (sym === "€") currency = "EUR";
      else if (sym === "¥") currency = "CNY";
      else if (sym === "₽") currency = "RUB";
      else if (sym === "£") currency = "GBP";
      else currency = sym.toUpperCase();
    }
    return {
      title: titleMatch ? titleMatch[1].trim() : null,
      price,
      currency,
      category: null,
      description: null,
      color: null,
      brand: null,
      marketplace,
    };
  }
}

// --- Главный обработчик ---
Deno.serve(async (req) => {
  const log = (msg: string) => console.log(`[parse-worker] ${msg}`);
  let jobId: string | null = null;
  try {
    const { record } = await req.json();
    const { id, url } = record;
    jobId = id;
    log(`Job ${id}: ${url}`);

    if (!id || !url) throw new Error("Missing id or url");

    let content: string | null = null;

    // Для китайских сайтов — сначала Crawlbase (JS-рендеринг)
    if (isChineseUrl(url) && CRAWLBASE_JS_TOKEN) {
      try {
        content = await fetchViaCrawlbase(url);
        log(`Crawlbase success, HTML length: ${content.length}`);
      } catch (crawlErr) {
        const crawlMsg = crawlErr instanceof Error ? crawlErr.message : String(crawlErr);
        log(`Crawlbase failed: ${crawlMsg}, falling back to Firecrawl`);
      }
    }

    // Fallback (и для всех не-китайских) — Firecrawl
    if (!content) {
      content = await fetchMarkdown(url);
      log(`Firecrawl success, Markdown length: ${content.length}`);
    }

    const extracted = await extractData(content, url);

    log(
      `Result: title=${extracted.title}, price=${extracted.price} ${extracted.currency}, category=${extracted.category}, brand=${extracted.brand}, mp=${extracted.marketplace}`,
    );

    const { error: updateErr } = await supabase
      .from("parse_queue")
      .update({
        status: "done",
        price: extracted.price,
        title: extracted.title,
        currency: extracted.currency,
        category: extracted.category,
        description: extracted.description,
        color: extracted.color,
        brand: extracted.brand,
        marketplace_name: extracted.marketplace,
      })
      .eq("id", id);

    if (updateErr) throw new Error(`DB update: ${updateErr.message}`);
    log("Completed");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log(`Error: ${msg}`);
    if (jobId) {
      await supabase
        .from("parse_queue")
        .update({ status: "error", error_message: msg })
        .eq("id", jobId);
    }
  }
  return new Response("ok");
});
