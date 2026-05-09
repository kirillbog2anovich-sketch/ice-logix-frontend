import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Supabase ────────────────────────────────────────────────────────────────
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── API Keys ─────────────────────────────────────────────────────────────────
const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const OPENROUTER_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const CRAWLBASE_JS_TOKEN = Deno.env.get("CRAWLBASE_JS_TOKEN") || "";
const TEXT_MODEL = Deno.env.get("OPENROUTER_TEXT_MODEL") || "anthropic/claude-sonnet-4.6";

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

// Detect country code from URL hostname/TLD. This is more reliable than asking the LLM
// for country, especially for marketplaces with country-specific TLDs (zalando.pl, zalando.de, asos.com).
function countryFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    // Известные мульти-доменные площадки
    if (host.endsWith(".cn") || /(?:dewu|poizon|taobao|tmall|1688|jd|tmall|xianyu)/.test(host)) return "CN";
    if (host.endsWith(".pl") || host.includes("zalando.pl") || host.includes("zalando-lounge.pl")) return "PL";
    if (host.endsWith(".de") || host.endsWith(".at")) return "DE";
    if (host.endsWith(".co.uk") || host.endsWith(".uk") || /(?:asos\.com|endclothing\.com|sneakerstudio|ssense)/.test(host)) return "UK";
    if (host.endsWith(".ru") || /(?:wildberries|ozon|lamoda|yandex|avito)/.test(host)) return "RU";
    if (host.endsWith(".by")) return "BY";
    if (host.endsWith(".jp")) return "JP";
    if (host.endsWith(".kr")) return "KR";
    if (host.endsWith(".tr") || host.endsWith(".com.tr")) return "TR";
    if (host.endsWith(".ae")) return "AE";
    if (host.endsWith(".vn")) return "VN";
    if (host.endsWith(".it")) return "EU"; // Italy ⇒ EU group
    if (host.endsWith(".fr")) return "EU";
    if (host.endsWith(".es")) return "EU";
    if (host.endsWith(".nl")) return "EU";
    if (host.endsWith(".com") && /(?:farfetch|aboutyou|asos)/.test(host)) return "EU";
    return null;
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
  country: string | null;
  category: string | null;
  description: string | null;
  color: string | null;
  brand: string | null;
  marketplace: string | null;
}> {
  if (!OPENROUTER_KEY) throw new Error("OPENROUTER_API_KEY not configured");

  const isHtml = content.trimStart().startsWith("<");
  const contentType = isHtml ? "HTML" : "Markdown";
  const marketplace = marketplaceFromUrl(url);

  const prompt =
    `You are a precise e-commerce product data extractor. Analyze the provided content (which is in ${contentType} format) and extract the following fields. Return only a valid JSON object with these exact keys. Use null for any missing value. Do not include any text outside the JSON.

Fields to extract:
- title: The full product name/title.
- price: The CURRENT/FINAL price the buyer would actually pay. Rules of thumb:
  * If the page shows a discounted price next to a crossed-out / "was" / "Cena pierwotna" / "Old price" / "RRP" / "UVP" / "Originalpreis" — use the DISCOUNTED price, NOT the original.
  * If multiple sizes have different prices, take the lowest commonly-available variant.
  * Do NOT pick shipping fees, loyalty bonuses, taxes, or installment payments.
  * Output a number only (no currency symbols, no thousand separators, '.' as decimal separator).
- currency: The ISO 4217 currency code. Infer from symbol or context: $→USD, €→EUR, ¥→CNY, £→GBP, ₽→RUB, "zł"/"PLN"→PLN, "руб"→RUB, "BYN"/"Br"→BYN, "kr"→SEK/NOK/DKK (use TLD: .se→SEK, .no→NOK, .dk→DKK). Return null only if you really cannot tell.
- country: The ISO-3166 alpha-2 country code of the marketplace (CN, PL, DE, EU, UK, US, RU, BY, JP, KR, AE, TR, VN). Infer from domain TLD and currency: zalando.pl→PL, zalando.de→DE, asos.com→UK, .ru→RU, .cn→CN. Return null if unsure.
- category: The product category in Russian. Pick the MOST SPECIFIC item from this list (in priority order):
  Кроссовки, Кеды, Боты, Ботинки, Сандалии, Туфли,
  Футболка, Поло, Худи, Свитшот, Толстовка, Джинсы, Брюки, Шорты, Куртка, Пуховик, Пальто, Платье, Юбка, Костюм, Купальник,
  Рюкзак, Сумка, Кошелёк, Ремень, Часы, Очки, Шапка, Бижутерия, Парфюм, Косметика, Электроника.
  If none of these fit precisely but it is shoes/clothing/accessories, return one of: "Обувь", "Одежда", "Аксессуары". If still nothing matches, return null.
- description: A concise product description (1-2 sentences) in Russian, summarizing key features. If not available, return null.
- color: The main color(s) in Russian, e.g., "Черный/Белый". If not found, return null.
- brand: The manufacturer brand name, e.g., "Nike", "Adidas". If not found, return null.

URL of the page being analyzed: ${url}

${isHtml ? `For HTML: prioritize structured data (JSON-LD <script type="application/ld+json"> with @type="Product" → offers.price), meta tags (<meta property="product:price:amount">, og:price:amount), and elements with class names like price, product-title, brand. Ignore prices inside "compare", "old", "regular", "strikethrough", "rrp" classes — these are crossed-out original prices.` : `For Markdown: extract information from the structured text, focusing on headings and price patterns. Watch for "~~price~~" or "was X now Y" patterns — pick the lower current price.`}

${contentType} content:
${content.substring(0, 8000)}`;

  let dsResponse: Record<string, unknown> | null = null;

  try {
    const dsRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
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
      country: countryFromUrl(url),
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

  // ── Country ── prefer URL-based detection, fallback to model output
  const countryFromModel = strOrNull(parsed.country);
  const countryFinal = countryFromUrl(url) || (countryFromModel ? countryFromModel.toUpperCase() : null);

  return {
    title,
    price: finalPrice,
    currency: finalCurrency,
    country: countryFinal,
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
        country: extracted.country,
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
