import {
  ISHARES_LOCALES,
  IsharesLocaleConfig,
  IsharesRequestContext,
  isharesGetJson,
  isharesGetText,
  toAbsoluteIsharesUrl
} from "@/lib/ishares/isharesClient";
import type { IsharesResolution } from "@/lib/ishares/types";

type AutocompleteItem = {
  label?: string;
  id?: string;
  category?: string;
};

type ProductSearchRow = {
  href: string;
  ticker: string;
  name: string;
};

function extractProductId(url: string) {
  const match = /\/products\/(\d+)\//i.exec(url);
  return match?.[1] || null;
}

function extractTicker(pageHtml: string) {
  const varMatch = /var\s+tradeItTicker\s*=\s*"([^"]+)"/i.exec(pageHtml);
  if (varMatch?.[1]) return varMatch[1].trim().toUpperCase();
  const titleMatch = /<title>[^<]+\|\s*([A-Z0-9.\-]+)\s*<\/title>/i.exec(pageHtml);
  return titleMatch?.[1]?.trim().toUpperCase() || null;
}

function extractCanonicalUrl(pageHtml: string) {
  const canonical = /<link\s+rel="canonical"\s+href="([^"]+)"/i.exec(pageHtml);
  return canonical?.[1] || null;
}

function containsIsin(pageHtml: string, isin: string) {
  const normalizedIsin = isin.trim().toUpperCase();
  return pageHtml.toUpperCase().includes(normalizedIsin);
}

function normalizeToken(value: string) {
  return value
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function buildFallbackTerms(isin: string, hints: { ticker?: string | null; productName?: string | null }) {
  const stopWords = new Set([
    "ISHARES",
    "CORE",
    "UCITS",
    "ETF",
    "USD",
    "EUR",
    "ACC",
    "DIST",
    "FUND"
  ]);
  const ticker = hints.ticker ? normalizeToken(hints.ticker) : null;
  const normalizedName = hints.productName ? normalizeToken(hints.productName) : "";
  const nameTokens = normalizedName
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !stopWords.has(token));

  const phraseLong = nameTokens.slice(0, 4).join(" ").trim();
  const phraseShort = nameTokens.slice(0, 2).join(" ").trim();

  return Array.from(
    new Set(
      [isin.trim().toUpperCase(), ticker, phraseLong, phraseShort].filter(
        (value): value is string => Boolean(value && value.length > 0)
      )
    )
  );
}

function extractLiteratureAjaxUrl(pageHtml: string) {
  const varMatch = /var\s+productLiteratureUrl\s*=\s*"([^"]+)"/i.exec(pageHtml);
  if (varMatch?.[1]) return varMatch[1];
  const attrMatch = /data-literature-url="([^"]+)"/i.exec(pageHtml);
  return attrMatch?.[1] || null;
}

function extractFactSheetHref(literatureHtml: string) {
  const factSheetBlock = /<li[^>]*FactSheet[^>]*>([\s\S]*?)<\/li>/i.exec(literatureHtml)?.[1] || null;
  if (!factSheetBlock) return null;
  const hrefMatch = /href="([^"]+\.pdf[^"]*)"/i.exec(factSheetBlock);
  return hrefMatch?.[1] || null;
}

function parseProductSearchRows(searchPageHtml: string): ProductSearchRow[] {
  const rows: ProductSearchRow[] = [];
  const rowRegex =
    /<td\s+class="links"\s*><a\s+href="([^"]+)">([^<]+)<\/a><\/td>\s*<td\s+class="links"\s*><a\s+href="[^"]+">([^<]+)<\/a><\/td>/gi;
  let match: RegExpExecArray | null = null;
  while ((match = rowRegex.exec(searchPageHtml)) !== null) {
    const href = match[1]?.trim();
    const ticker = match[2]?.trim();
    const name = match[3]?.trim();
    if (!href || !ticker || !name) continue;
    rows.push({ href, ticker, name });
  }

  const dedup = new Map<string, ProductSearchRow>();
  for (const row of rows) {
    if (!dedup.has(row.href)) dedup.set(row.href, row);
  }
  return Array.from(dedup.values());
}

function tokenize(value: string) {
  return normalizeToken(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function rankProductSearchRows(
  rows: ProductSearchRow[],
  hints: { ticker?: string | null; productName?: string | null }
) {
  const hintTicker = hints.ticker ? normalizeToken(hints.ticker) : "";
  const hintNameTokens = hints.productName ? tokenize(hints.productName) : [];
  const stopWords = new Set(["ISHARES", "CORE", "UCITS", "ETF", "USD", "EUR", "ACC", "DIST", "FUND"]);
  const relevantNameTokens = hintNameTokens.filter((token) => token.length >= 2 && !stopWords.has(token));

  const scored = rows.map((row) => {
    const rowTicker = normalizeToken(row.ticker);
    const rowNameTokens = new Set(tokenize(row.name));
    let score = 0;
    if (hintTicker && rowTicker === hintTicker) score += 300;
    if (hintTicker && rowTicker.includes(hintTicker)) score += 120;
    for (const token of relevantNameTokens) {
      if (rowNameTokens.has(token)) score += 30;
    }
    return { row, score };
  });

  return scored
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.row.href.localeCompare(b.row.href);
    })
    .map((entry) => entry.row);
}

async function resolveFactsheetUrl(
  locale: IsharesLocaleConfig,
  productUrl: string,
  pageHtml: string,
  context: IsharesRequestContext
) {
  const literatureUrl = extractLiteratureAjaxUrl(pageHtml);
  if (!literatureUrl) return null;
  const absoluteLiteratureUrl = toAbsoluteIsharesUrl(locale.baseUrl, literatureUrl);
  const withAction = absoluteLiteratureUrl.includes("?")
    ? `${absoluteLiteratureUrl}&action=ajax`
    : `${absoluteLiteratureUrl}?action=ajax`;
  const literatureHtml = await isharesGetText(withAction, context);
  const href = extractFactSheetHref(literatureHtml);
  if (!href) return null;
  const absolutePdfUrl = toAbsoluteIsharesUrl(productUrl, href);
  return absolutePdfUrl;
}

async function resolveCandidateProduct(
  locale: IsharesLocaleConfig,
  isin: string,
  productUrl: string,
  context: IsharesRequestContext
): Promise<IsharesResolution | null> {
  const pageHtml = await isharesGetText(productUrl, context);
  if (!containsIsin(pageHtml, isin)) return null;

  const canonicalUrl = extractCanonicalUrl(pageHtml) || productUrl;
  const productId = extractProductId(canonicalUrl);
  const ticker = extractTicker(pageHtml);
  const factsheetUrl = await resolveFactsheetUrl(locale, canonicalUrl, pageHtml, context);
  console.info("[ISHARES][RESOLVE] resolved", {
    isin,
    locale: locale.key,
    productUrl: canonicalUrl,
    productId,
    ticker,
    hasFactsheet: Boolean(factsheetUrl)
  });
  return {
    isin,
    locale: locale.key,
    localeSuffix: locale.localeSuffix,
    productUrl: canonicalUrl,
    productId,
    ticker,
    factsheetUrl,
    pageHtml
  };
}

async function resolveFromProductSearchPage(
  locale: IsharesLocaleConfig,
  isin: string,
  hints: { ticker?: string | null; productName?: string | null },
  context: IsharesRequestContext
): Promise<IsharesResolution | null> {
  const searchUrl = `${locale.baseUrl}/products/etf-investments?search=${encodeURIComponent(isin)}`;
  let searchHtml = "";
  try {
    searchHtml = await isharesGetText(searchUrl, context);
  } catch (error) {
    console.warn("[ISHARES][RESOLVE] search page failed", {
      isin,
      locale: locale.key,
      searchUrl,
      message: error instanceof Error ? error.message : String(error)
    });
    return null;
  }

  const rows = parseProductSearchRows(searchHtml);
  if (!rows.length) return null;
  const rankedRows = rankProductSearchRows(rows, hints);
  const candidates = rankedRows.slice(0, 30);

  for (const row of candidates) {
    const productUrl = toAbsoluteIsharesUrl(locale.baseUrl, row.href);
    try {
      const resolved = await resolveCandidateProduct(locale, isin, productUrl, context);
      if (resolved) {
        console.info("[ISHARES][RESOLVE] matched via product search", {
          isin,
          locale: locale.key,
          ticker: row.ticker,
          name: row.name,
          productUrl
        });
        return resolved;
      }
    } catch (error) {
      console.warn("[ISHARES][RESOLVE] product search candidate failed", {
        isin,
        locale: locale.key,
        productUrl,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return null;
}

async function resolveWithLocale(
  locale: IsharesLocaleConfig,
  isin: string,
  terms: string[],
  context: IsharesRequestContext
): Promise<IsharesResolution | null> {
  const seen = new Set<string>();
  for (const term of terms) {
    const autocompleteUrl = `${locale.baseUrl}/autoComplete.search?type=autocomplete&term=${encodeURIComponent(term)}`;
    let items: AutocompleteItem[] = [];
    try {
      items = await isharesGetJson<AutocompleteItem[]>(autocompleteUrl, context);
    } catch (error) {
      console.warn("[ISHARES][RESOLVE] autocomplete failed", {
        locale: locale.key,
        isin,
        term,
        message: error instanceof Error ? error.message : String(error)
      });
      continue;
    }

    for (const item of items) {
      if (item.category !== "productAutocomplete" || !item.id) continue;
      const productUrl = toAbsoluteIsharesUrl(locale.baseUrl, item.id);
      if (seen.has(productUrl)) continue;
      seen.add(productUrl);

      try {
        const resolved = await resolveCandidateProduct(locale, isin, productUrl, context);
        if (resolved) return resolved;
      } catch (error) {
        console.warn("[ISHARES][RESOLVE] candidate failed", {
          isin,
          locale: locale.key,
          productUrl,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }
  return null;
}

export async function resolveIsharesFundByIsin(
  isin: string,
  hints: { ticker?: string | null; productName?: string | null } = {},
  requestContext?: IsharesRequestContext
): Promise<IsharesResolution | null> {
  const context = requestContext ?? {
    cookieJar: new Map()
  };
  const terms = buildFallbackTerms(isin, hints);
  for (const locale of ISHARES_LOCALES) {
    const viaProductSearch = await resolveFromProductSearchPage(locale, isin, hints, context);
    if (viaProductSearch) return viaProductSearch;

    const resolved = await resolveWithLocale(locale, isin, terms, context);
    if (resolved) return resolved;
  }

  console.warn("[ISHARES][RESOLVE] unresolved", { isin, triedLocales: ISHARES_LOCALES.map((l) => l.key) });
  return null;
}

export const __testables = {
  extractTicker,
  extractCanonicalUrl,
  extractProductId,
  extractLiteratureAjaxUrl,
  extractFactSheetHref,
  parseProductSearchRows,
  buildFallbackTerms,
  rankProductSearchRows
};
