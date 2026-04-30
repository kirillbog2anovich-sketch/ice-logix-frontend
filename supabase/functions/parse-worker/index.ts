import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Supabase ────────────────────────────────────────────────────────────────
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── API Keys ─────────────────────────────────────────────────────────────────
const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const DEEPSEEK_KEY = Deno.env.get("DEEPSEEK_API_KEY") || "";
const CRAWLBASE_JS_TOKEN = Deno.env.get("CRAWLBASE_JS_TOKEN") || "";

// ─── Chinese domain list ──────────────────────────────────────────────────────
const CHINESE_DOMAINS = [
  "poizon.com", "dewu.com", "taobao.com", "tmall.com",
  "1688.com", "jd.com", "vip.com", "mogujie.com",
  "yougou.com", "yohobuy.com", "secoo.com",
];

function isChineseUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return CHINESE_DOMAINS.some((d) => hostname.includes(d));
  } catch {
    return false;
  }
}

function marketplaceFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").split(".")[0] || null;
  } catch {
    return null;
  }
}

// ─── JSON helper (strips ```json fences) ─────────────────────────────────────
function parseAssistantJson(raw: string): Record<string, unknown> {
  let s = (raw || "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/s, "").trim();
  }
  return JSON.parse(s) as Record<string, unknown>;
}

// ─── Content fetchers ─────────────────────────────────────────────────────────

/** Crawlbase JS-render — only for Chinese sites */
async function fetchViaCrawlbase(url: string): Promise<string> {
  if (!CRAWLBASE_JS_TOKEN) throw new Error("CRAWLBASE_JS_TOKEN not configured");
  const apiUrl =
    `https://api.crawlbase.com/?token=${CRAWLBASE_JS_TOKEN}&url=${encodeURIComponent(url)}`;
  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error(`Crawlbase ${res.status}`);
  const text = await res.text();
  if (!text || text.trim().length < 200) throw new Error("Crawlbase returned empty/short response");
  return text;
}

/** Firecrawl → Markdown */
async function fetchViaFirecrawl(url: string): Promise<string> {
  if (!FIRECRAWL_KEY) throw new Error("FIRECRAWL_API_KEY not configured");
  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${FIRECRAWL_KEY}` },
    body: JSON.stringify({ url, formats: ["markdown"] }),
  });
  if (!res.ok) throw new Error(`Firecrawl ${res.status}`);
  const { data } = await res.json();
  const md = data?.markdown || "";
  if (!md || md.trim().length < 100) throw new Error("Firecrawl returned empty/short markdown");
  return md;
}

/** Last resort: codetabs proxy → raw HTML, then direct fetch */
async function fetchViaFallback(url: string): Promise<string> {
  // 1. codetabs
  try {
    const res = await fetch(
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    );
    if (res.ok) {
      const text = await res.text();
      if (text && text.trim().length > 200) return text;
    }
  } catch { /* continue */ }

  // 2. direct with browser User-Agent
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
  });
  if (res.ok) return await res.text();
  throw new Error(`All fetch attempts failed (status ${res.status})`);
}

// ─── Fetch orchestration ──────────────────────────────────────────────────────
async function fetchContent(
  url: string,
  log: (m: string) => void,
): Promise<string> {
  const isChinese = isChineseUrl(url);

  if (isChinese) {
    // 1. Crawlbase (JS render)
    if (CRAWLBASE_JS_TOKEN) {
      try {
        const html = await fetchViaCrawlbase(url);
        log(`Crawlbase OK, ${html.length} chars`);
        return html;
      } catch (e) {
        log(`Crawlbase failed: ${(e as Error).message}`);
      }
    }
    // 2. Firecrawl
    try {
      const md = await fetchViaFirecrawl(url);
      log(`Firecrawl OK (Chinese fallback), ${md.length} chars`);
      return md;
    } catch (e) {
      log(`Firecrawl failed: ${(e as Error).message}`);
    }
  } else {
    // 1. Firecrawl (primary for non-Chinese)
    try {
      const md = await fetchViaFirecrawl(url);
      log(`Firecrawl OK, ${md.length} chars`);
      return md;
    } catch (e) {
      log(`Firecrawl failed: ${(e as Error).message}`);
    }
  }

  // Last resort for both paths
  log("Trying codetabs/direct fallback...");
  const fb = await fetchViaFallback(url);
  log(`Fallback OK, ${fb.length} chars`);
  return fb;
}

// ─── Currency normalizer ──────────────────────────────────────────────────────
function normalizeCurrency(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const u = raw.trim().toUpperCase();
  if (u === "$" || u === "USD") return "USD";
  if (u === "€" || u === "EUR") return "EUR";
  if (u === "¥" || u === "CNY" || u === "RMB") return "CNY";
  if (u === "£" || u === "GBP") return "GBP";
  if (u === "₽" || u === "RUB" || u === "RUR") return "RUB";
  if (u === "BYN" || u === "BYR") return "BYN";
  // keep as-is if it looks like a valid 3-letter code
  if (/^[A-Z]{3}$/.test(u)) return u;
  return null;
}

function extractCurrencyFromContent(content: string): string | null {
  const m = content.match(/(USD|EUR|CNY|GBP|BYN|RUB|\$|€|¥|£|₽)/i);
  if (!m) return null;
  return normalizeCurrency(m[1]);
}

// ─── Regex fallbacks for title/price when DeepSeek fails ─────────────────────
function extractTitleFallback(content: string, isHtml: boolean): string | null {
  if (isHtml) {
    // JSON-LD
    const ldMatch = content.match(/"name"\s*:\s*"([^"]{3,})"/);
    if (ldMatch) return ldMatch[1].trim();
    // <title>
    const titleMatch = content.match(/<title[^>]*>([^<]{3,})<\/title>/i);
    if (titleMatch) return titleMatch[1].trim();
    // og:title
    const ogMatch = content.match(/property="og:title"\s+content="([^"]{3,})"/i);
    if (ogMatch) return ogMatch[1].trim();
  } else {
    const mdMatch = content.match(/^#\s+(.+)$/m);
    if (mdMatch) return mdMatch[1].trim();
  }
  return null;
}

function extractPriceFallback(
  content: string,
): { price: number | null; currency: string | null } {
  // Pattern: number followed by currency symbol or code
  const m = content.match(
    /(\d[\d\s]*[\.,]\d{1,2}|\d{2,})\s*(USD|EUR|CNY|GBP|BYN|RUB|\$|€|¥|£|₽|руб)/i,
  );
  if (m) {
    const price = parseFloat(m[1].replace(/\s/g, "").replace(",", "."));
    return { price: isNaN(price) || price <= 0 ? null : price, currency: normalizeCurrency(m[2]) };
  }
  return { price: null, currency: null };
}

// ─── DeepSeek extraction ──────────────────────────────────────────────────────
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
  const marketplace = marketplaceFromUrl(url);

  const prompt =
    `You are a precise e-commerce product data extractor. Analyze the provided content (which is in ${contentType} format) and extract the following fields. Return only a valid JSON object with these exact keys. Use null for any missing value. Do not include any text outside the JSON.

Fields to extract:
- title: The full product name/title.
- price: The current selling price as a number (without currency symbols, commas, or spaces). Use '.' as decimal separator. Do not convert currencies. If multiple prices are shown, pick the main/default one.
- currency: The ISO 4217 currency code (USD, EUR, CNY, GBP, BYN, RUB, etc.). Infer from symbol if needed: $→USD, €→EUR, ¥→CNY, £→GBP, ₽→RUB. If it cannot be determined, return null.
- category: The product category in Russian, chosen from: "Обувь", "Одежда", "Аксессуары". Determine by analyzing the product name, description, and any breadcrumbs. If none matches, return null.
- description: A concise product description (1-2 sentences) in Russian, summarizing key features. If not available, return null.
- color: The main color(s) in Russian, e.g., "Черный/Белый". If not found, return null.
- brand: The manufacturer brand name, e.g., "Nike", "Adidas". If not found, return null.

${isHtml ? `For HTML: prioritize structured data (JSON-LD <script type="application/ld+json">), meta tags (<meta property="product:price:amount">), and elements with class names like price, product-title, brand.` : `For Markdown: extract information from the structured text, focusing on headings and price patterns.`}

${contentType} content:
${content.substring(0, 8000)}`;

  let dsResponse: Record<string, unknown> | null = null;

  try {
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

    if (!dsRes.ok) throw new Error(`DeepSeek ${dsRes.status}`);
    const dsData = await dsRes.json();
    dsResponse = parseAssistantJson(dsData.choices[0].message.content);
  } catch (e) {
    // DeepSeek failed — full regex fallback
    const titleFb = extractTitleFallback(content, isHtml);
    const { price: priceFb, currency: currFb } = extractPriceFallback(content);
    const currFinal = currFb || extractCurrencyFromContent(content);
    return {
      title: titleFb,
      price: priceFb,
      currency: currFinal,
      category: null,
      description: null,
      color: null,
      brand: null,
      marketplace,
    };
  }

  const parsed = dsResponse!;

  // ── Price ──
  let finalPrice: number | null = null;
  if (typeof parsed.price === "number" && !isNaN(parsed.price) && parsed.price > 0) {
    finalPrice = parsed.price;
  } else if (parsed.price != null && String(parsed.price).trim() !== "") {
    const n = parseFloat(String(parsed.price).replace(/\s/g, "").replace(/,/g, "."));
    if (!isNaN(n) && n > 0) finalPrice = n;
  }

  // ── Currency ──
  let finalCurrency = normalizeCurrency(
    typeof parsed.currency === "string" ? parsed.currency : null,
  );
  if (!finalCurrency) finalCurrency = extractCurrencyFromContent(content);

  // ── Title fallback if DeepSeek returned empty ──
  let title: string | null = null;
  if (typeof parsed.title === "string" && parsed.title.trim()) {
    title = parsed.title.trim();
  } else {
    title = extractTitleFallback(content, isHtml);
  }

  const strOrNull = (v: unknown): string | null => {
    if (typeof v === "string" && v.trim()) return v.trim();
    return null;
  };

  return {
    title,
    price: finalPrice,
    currency: finalCurrency,
    category: strOrNull(parsed.category),
    description: strOrNull(parsed.description),
    color: strOrNull(parsed.color),
    brand: strOrNull(parsed.brand),
    marketplace,
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const log = (msg: string) => console.log(`[parse-worker] ${msg}`);
  let jobId: string | null = null;

  try {
    const { record } = await req.json();
    const { id, url } = record;
    jobId = id;
    log(`Job ${id}: ${url}`);

    if (!id || !url) throw new Error("Missing id or url");

    const content = await fetchContent(url, log);
    const extracted = await extractData(content, url);

    log(
      `Done: title="${extracted.title}", price=${extracted.price} ${extracted.currency}, cat=${extracted.category}, brand=${extracted.brand}`,
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
