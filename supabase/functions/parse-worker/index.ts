import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- Конфигурация Supabase ---
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- API Ключи из Secrets ---
const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const DEEPSEEK_KEY = Deno.env.get("DEEPSEEK_API_KEY") || "";

function marketplaceFromUrl(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const first = hostname.split(".")[0];
    return first || null;
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

// --- Шаг 1: Получение чистого Markdown через Firecrawl ---
async function fetchMarkdown(url: string): Promise<string> {
  if (!FIRECRAWL_KEY) throw new Error("FIRECRAWL_API_KEY not configured");

  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${FIRECRAWL_KEY}`,
    },
    body: JSON.stringify({
      url: url,
      formats: ["markdown"],
    }),
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
  markdown: string,
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

  const prompt = `You are a precise e-commerce data extractor. Analyze the product page content provided in Markdown and extract the following fields. Return ONLY a valid JSON object with these exact keys. If a value is not found, use null for strings/numbers.

Fields:
- title: Full product name. (string | null)
- price: Current selling price as a number WITHOUT currency symbols or thousands separators. Use '.' as decimal. (number | null)
- currency: ISO 4217 code (USD, EUR, CNY, GBP, BYN, RUB). (string | null)
- category: Product category in Russian, chosen from: "Обувь", "Одежда", "Аксессуары". Determine by product name and description. If unclear, null.
- description: Concise description (1-2 sentences) in Russian. (string | null)
- color: Main color(s) in Russian, e.g., "Черный/Белый". (string | null)
- brand: Manufacturer brand name, e.g., "Nike", "Adidas". (string | null)

Markdown:
${markdown.substring(0, 8000)}`;

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
    const parsed = parseAssistantJson(dsData.choices[0].message.content) as Record<string, unknown>;

    let finalPrice: number | null = null;
    if (typeof parsed.price === "number" && Number.isFinite(parsed.price) && parsed.price > 0) {
      finalPrice = parsed.price;
    } else if (parsed.price != null && String(parsed.price).trim() !== "") {
      const n = parseFloat(
        String(parsed.price).replace(/\s/g, "").replace(/,/g, "."),
      );
      if (Number.isFinite(n) && n > 0) finalPrice = n;
    }

    let finalCurrency: string | null =
      parsed.currency != null && String(parsed.currency).trim() !== ""
        ? String(parsed.currency).trim()
        : null;

    if (finalCurrency) {
      const fc = finalCurrency;
      if (["RUB", "руб", "RUR"].includes(fc)) finalCurrency = "RUB";
      else if (["USD", "$"].includes(fc)) finalCurrency = "USD";
      else if (["EUR", "€"].includes(fc)) finalCurrency = "EUR";
      else if (["CNY", "¥"].includes(fc)) finalCurrency = "CNY";
      else if (["BYN", "бел.руб"].includes(fc)) finalCurrency = "BYN";
      else {
        const u = fc.toUpperCase();
        if (u === "RUB" || u === "RUR") finalCurrency = "RUB";
        else if (u === "USD") finalCurrency = "USD";
        else if (u === "EUR") finalCurrency = "EUR";
        else if (u === "CNY") finalCurrency = "CNY";
        else if (u === "GBP") finalCurrency = "GBP";
        else if (u === "BYN") finalCurrency = "BYN";
      }
    }

    if (!finalCurrency) {
      const currencyMatch = markdown.match(/(USD|EUR|CNY|GBP|BYN|RUB|\$|€|¥|руб)/i);
      if (currencyMatch) {
        const sym = currencyMatch[1];
        if (/^руб$/i.test(sym)) finalCurrency = "RUB";
        else if (sym === "$") finalCurrency = "USD";
        else if (sym === "€") finalCurrency = "EUR";
        else if (sym === "¥") finalCurrency = "CNY";
        else finalCurrency = sym.toUpperCase();
      }
    }

    const brand = parsed.brand != null && String(parsed.brand).trim() !== ""
      ? String(parsed.brand).trim()
      : null;

    return {
      title: parsed.title != null && String(parsed.title).trim() !== "" ? String(parsed.title).trim() : null,
      price: finalPrice,
      currency: finalCurrency,
      category: parsed.category != null && String(parsed.category).trim() !== ""
        ? String(parsed.category).trim()
        : null,
      description: parsed.description != null && String(parsed.description).trim() !== ""
        ? String(parsed.description).trim()
        : null,
      color: parsed.color != null && String(parsed.color).trim() !== "" ? String(parsed.color).trim() : null,
      brand,
      marketplace,
    };
  } catch {
    const titleMatch = markdown.match(/^#\s(.+)$/m);
    const priceMatch = markdown.match(/(\d+[\.,]\d{1,2})\s?(USD|EUR|CNY|BYN|RUB|\$|€|¥|руб)/i);
    let price: number | null = null;
    let currency: string | null = null;
    if (priceMatch) {
      price = parseFloat(priceMatch[1].replace(",", "."));
      const sym = priceMatch[2];
      if (/^руб$/i.test(sym)) currency = "RUB";
      else if (sym === "$") currency = "USD";
      else if (sym === "€") currency = "EUR";
      else if (sym === "¥") currency = "CNY";
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

    let title: string | null = null;
    let finalPrice: number | null = null;
    let finalCurrency: string | null = null;
    let category: string | null = null;
    let description: string | null = null;
    let color: string | null = null;
    let brand: string | null = null;
    let marketplace: string | null = null;

    const markdown = await fetchMarkdown(url);
    log(`Markdown length: ${markdown.length}`);

    const extracted = await extractData(markdown, url);
    title = extracted.title;
    finalPrice = extracted.price;
    finalCurrency = extracted.currency;
    category = extracted.category;
    description = extracted.description;
    color = extracted.color;
    brand = extracted.brand;
    marketplace = extracted.marketplace;

    log(
      `Result: title=${title}, price=${finalPrice} ${finalCurrency}, category=${category}, brand=${brand}, mp=${marketplace}, desc=${description?.slice(0, 40)}, color=${color}`,
    );

    const { error: updateErr } = await supabase
      .from("parse_queue")
      .update({
        status: "done",
        price: finalPrice,
        title,
        currency: finalCurrency,
        category,
        description,
        color,
        brand,
        marketplace_name: marketplace,
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
