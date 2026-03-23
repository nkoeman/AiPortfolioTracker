import { finalizeExposure, type RawExposureRow } from "@/lib/etf/exposure/finalizeExposure";
import { getBytes, getJson, getText, type RequestContext } from "@/lib/etf/issuers/httpClient";
import { extractJsonArrayFromScript, extractRowsForHeadings, findFirstPdfUrl, parseAsOfDate, toAbsoluteUrl } from "@/lib/etf/issuers/parseHelpers";
import type { IssuerExposureAdapter } from "@/lib/etf/issuers/types";
import { parseIsharesFactsheetPdfBytes } from "@/lib/ishares/isharesExposure";

const SPDR_BASE_URLS = [
  "https://www.ssga.com",
  "https://www.spdrs.com"
];
const SPDR_GEOLOC_CANDIDATES = ["nl:nl", "nl:en_gb", "ie:en_gb", "de:de", "de:en_gb", "uk:en_gb", "fr:fr", "fr:en_gb", "us:en"];
const SPDR_ROLE_CANDIDATES = ["intermediary", "institutional"];
const SPDR_ENGLISH_LOCALES = ["en", "en_gb"];
const SPDR_ENGLISH_COUNTRIES = ["nl", "ie", "uk", "us"];

type SpdrSuggestItem = {
  title?: string | null;
  link?: string | null;
  ticker?: string | null;
  target?: string | null;
};

type SpdrSuggestResponse = {
  status?: string;
  suggests?: Record<string, SpdrSuggestItem[] | undefined>;
};

function lower(value: string | null | undefined) {
  return String(value || "").toLowerCase();
}

function hasIsin(text: string, isin: string) {
  return text.toUpperCase().includes(isin.toUpperCase());
}

function extractPathLocale(url: string): string | null {
  try {
    const { pathname } = new URL(url);
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return parts[1].toLowerCase();
  } catch {
    return null;
  }
}

function isEnglishLocale(locale: string | null | undefined) {
  if (!locale) return false;
  const normalized = locale.toLowerCase();
  return normalized === "en" || normalized.startsWith("en_") || normalized.startsWith("en-");
}

function buildEnglishProductUrlCandidates(productUrl: string): string[] {
  const candidates = new Set<string>([productUrl]);
  try {
    const parsed = new URL(productUrl);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 3) return Array.from(candidates);

    const [, , ...tail] = parts;
    const tailPath = tail.join("/");
    if (!tailPath) return Array.from(candidates);

    for (const country of SPDR_ENGLISH_COUNTRIES) {
      for (const locale of SPDR_ENGLISH_LOCALES) {
        parsed.pathname = `/${country}/${locale}/${tailPath}`;
        candidates.add(parsed.toString());
      }
    }
  } catch {
    return Array.from(candidates);
  }

  return Array.from(candidates);
}

function mapJsonRows(items: unknown[]): RawExposureRow[] {
  const rows: RawExposureRow[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const name = String(record.name || record.label || record.country || record.region || record.sector || record.industry || "");
    const weight = record.weight ?? record.value ?? record.percentage ?? record.percent;
    if (!name.trim() || weight === undefined || weight === null) continue;
    rows.push({ name, weight: weight as number | string });
  }
  return rows;
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#34;/g, "\"")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function parseSpdrAsOfDate(value: string | null | undefined) {
  if (!value) return null;
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/^per\s+/i, "")
    .replace(/^as of\s+/i, "")
    .replace(/^as at\s+/i, "");
  const match = /^(\d{1,2})\s+([a-z]{3,})\s+(\d{4})$/i.exec(normalized);
  if (!match) return null;
  const day = Number(match[1]);
  const monthLabel = match[2];
  const year = Number(match[3]);
  const monthMap: Record<string, number> = {
    jan: 0,
    feb: 1,
    mrt: 2,
    mar: 2,
    apr: 3,
    mei: 4,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    okt: 9,
    oct: 9,
    nov: 10,
    dec: 11
  };
  const month = monthMap[monthLabel.slice(0, 3)];
  if (month === undefined) return null;
  const parsed = new Date(Date.UTC(year, month, day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseBreakdownFromHiddenInput(html: string, inputId: string) {
  const idMatch = new RegExp(`<input[^>]+id="${inputId}"[^>]+value="([^"]+)"`, "i").exec(html);
  if (!idMatch?.[1]) return { rows: [] as RawExposureRow[], asOfDate: null as Date | null };

  try {
    const decoded = decodeHtmlEntities(idMatch[1]);
    const payload = JSON.parse(decoded) as {
      asOfDate?: string;
      asOfDateSimple?: string;
      attrArray?: Array<{
        name?: { value?: string | null } | null;
        weight?: { originalValue?: string | number | null; value?: string | number | null } | null;
      }>;
    };
    const rows: RawExposureRow[] = [];
    for (const entry of payload.attrArray || []) {
      const name = String(entry?.name?.value || "");
      const weight = entry?.weight?.value ?? entry?.weight?.originalValue;
      if (!name.trim() || weight === undefined || weight === null) continue;
      rows.push({ name, weight });
    }
    return {
      rows,
      asOfDate: parseSpdrAsOfDate(payload.asOfDateSimple || payload.asOfDate || null)
    };
  } catch {
    return { rows: [] as RawExposureRow[], asOfDate: null as Date | null };
  }
}

function parseExposureFromHtml(html: string) {
  const jsonCountry = mapJsonRows(
    extractJsonArrayFromScript<Record<string, unknown>>(html, ["geographicalWeights", "countryExposure", "geographicExposure"])
  );
  const jsonSector = mapJsonRows(
    extractJsonArrayFromScript<Record<string, unknown>>(html, ["sectorAllocation", "sectorExposure", "industryExposure"])
  );

  const htmlCountry = extractRowsForHeadings(html, [
    "geographical weights",
    "geographic weights",
    "country exposure",
    "country allocation"
  ]);
  const htmlSector = extractRowsForHeadings(html, ["sector allocation", "sector exposure", "industry exposure"]);
  const hiddenCountry = parseBreakdownFromHiddenInput(html, "fund-geographical-breakdown");
  const hiddenSector = parseBreakdownFromHiddenInput(html, "fund-sector-breakdown");
  const hiddenFound = hiddenCountry.rows.length > 0 || hiddenSector.rows.length > 0;

  return {
    country: jsonCountry.length ? jsonCountry : hiddenCountry.rows.length ? hiddenCountry.rows : htmlCountry,
    sector: jsonSector.length ? jsonSector : hiddenSector.rows.length ? hiddenSector.rows : htmlSector,
    parsingMode: jsonCountry.length || jsonSector.length ? "JSON" : hiddenFound ? "HIDDEN_JSON" : "HTML",
    asOfDate: parseAsOfDate(html) || hiddenCountry.asOfDate || hiddenSector.asOfDate
  };
}

async function tryResolveCandidate(url: string, isin: string, context: RequestContext) {
  try {
    const html = await getText(url, context);
    if (!hasIsin(html, isin)) return null;
    return {
      productUrl: url,
      pageHtml: html,
      factsheetUrl: findFirstPdfUrl(html)
    };
  } catch {
    return null;
  }
}

async function resolveFromSearch(baseUrl: string, isin: string, context: RequestContext) {
  const searchUrls = [
    `${baseUrl}/search?q=${encodeURIComponent(isin)}`,
    `${baseUrl}/search?query=${encodeURIComponent(isin)}`,
    `${baseUrl}/us/en/intermediary/etfs/search?query=${encodeURIComponent(isin)}`
  ];

  for (const searchUrl of searchUrls) {
    try {
      const html = await getText(searchUrl, context);
      const links = Array.from(html.matchAll(/<a[^>]+href="([^"]+)"/gi))
        .map((match) => match[1])
        .filter((href) => /spdr|fund|etf|product/i.test(href))
        .map((href) => toAbsoluteUrl(baseUrl, href));
      const uniqueLinks = Array.from(new Set(links)).sort();
      for (const url of uniqueLinks.slice(0, 25)) {
        const resolved = await tryResolveCandidate(url, isin, context);
        if (resolved) return resolved;
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function resolveFromSuggest(baseUrl: string, isin: string, context: RequestContext) {
  const candidateUrls = new Set<string>();
  for (const geoloc of SPDR_GEOLOC_CANDIDATES) {
    for (const roleproduct of SPDR_ROLE_CANDIDATES) {
      try {
        const suggestUrl = `${baseUrl}/public-api/aem/v2/suggest?q=${encodeURIComponent(isin)}&geoloc=${encodeURIComponent(geoloc)}&roleproduct=${encodeURIComponent(roleproduct)}&site=ssmp`;
        const response = await getJson<SpdrSuggestResponse>(suggestUrl, context);
        for (const section of Object.values(response.suggests || {})) {
          for (const item of section || []) {
            const link = String(item?.link || "").trim();
            if (!link) continue;
            if (!/\/etfs\//i.test(link)) continue;
            candidateUrls.add(toAbsoluteUrl(baseUrl, link));
          }
        }
      } catch {
        continue;
      }
    }
  }

  for (const candidateUrl of Array.from(candidateUrls).sort()) {
    const resolved = await tryResolveCandidate(candidateUrl, isin, context);
    if (resolved) return resolved;
  }
  return null;
}

async function loadBestEnglishPage(
  resolved: { productUrl: string; pageHtml?: string | null; isin: string },
  context: RequestContext
) {
  const candidates = buildEnglishProductUrlCandidates(resolved.productUrl);
  const preferred = candidates.sort((a, b) => {
    const aLocale = extractPathLocale(a);
    const bLocale = extractPathLocale(b);
    const aEnglish = isEnglishLocale(aLocale) ? 0 : 1;
    const bEnglish = isEnglishLocale(bLocale) ? 0 : 1;
    if (aEnglish !== bEnglish) return aEnglish - bEnglish;
    return a.localeCompare(b);
  });

  for (const candidateUrl of preferred) {
    try {
      const html = await getText(candidateUrl, context);
      if (!hasIsin(html, resolved.isin)) continue;
      const parsed = parseExposureFromHtml(html);
      if (parsed.country.length || parsed.sector.length) {
        return {
          productUrlUsed: candidateUrl,
          pageHtml: html,
          parsed,
          language: extractPathLocale(candidateUrl)
        };
      }
    } catch {
      continue;
    }
  }

  const fallbackHtml = resolved.pageHtml || (await getText(resolved.productUrl, context));
  return {
    productUrlUsed: resolved.productUrl,
    pageHtml: fallbackHtml,
    parsed: parseExposureFromHtml(fallbackHtml),
    language: extractPathLocale(resolved.productUrl)
  };
}

export const spdrAdapter: IssuerExposureAdapter = {
  issuer: "SPDR",
  source: "SPDR",
  canHandleInstrument(hints) {
    const issuer = lower(hints.issuer);
    const name = lower(hints.name);
    const displayName = lower(hints.displayName);
    return issuer.includes("spdr") || issuer.includes("state street") || issuer.includes("ssga") || name.includes("spdr") || displayName.includes("spdr");
  },
  async resolveByIsin(isin, hints) {
    const context: RequestContext = { cookieJar: new Map<string, string>() };
    if (hints.cachedProductUrl) {
      const resolved = await tryResolveCandidate(hints.cachedProductUrl, isin, context);
      if (resolved) {
        return {
          issuer: "SPDR",
          isin,
          locale: null,
          productUrl: resolved.productUrl,
          factsheetUrl: resolved.factsheetUrl,
          pageHtml: resolved.pageHtml
        };
      }
    }

    for (const baseUrl of SPDR_BASE_URLS) {
      const bySuggest = await resolveFromSuggest(baseUrl, isin, context);
      if (bySuggest) {
        return {
          issuer: "SPDR",
          isin,
          locale: baseUrl,
          productUrl: bySuggest.productUrl,
          factsheetUrl: bySuggest.factsheetUrl,
          pageHtml: bySuggest.pageHtml
        };
      }

      const resolved = await resolveFromSearch(baseUrl, isin, context);
      if (!resolved) continue;
      return {
        issuer: "SPDR",
        isin,
        locale: baseUrl,
        productUrl: resolved.productUrl,
        factsheetUrl: resolved.factsheetUrl,
        pageHtml: resolved.pageHtml
      };
    }

    return null;
  },
  async fetchExposure(resolved, hints) {
    const context: RequestContext = { cookieJar: new Map<string, string>() };
    const selectedPage = await loadBestEnglishPage(
      {
        productUrl: resolved.productUrl,
        pageHtml: resolved.pageHtml,
        isin: resolved.isin
      },
      context
    );
    let parsed = selectedPage.parsed;
    let sourceMeta: Record<string, unknown> = {
      issuer: "SPDR",
      parsingMode: parsed.parsingMode,
      productUrl: selectedPage.productUrlUsed,
      originalProductUrl: resolved.productUrl,
      locale: selectedPage.language || resolved.locale,
      labelsLanguagePreference: "ENGLISH"
    };

    // For SPDR pages, the geo section can be absent; try factsheet PDF fallback when available.
    if (!parsed.country.length && resolved.factsheetUrl) {
      const factsheetUrl = toAbsoluteUrl(selectedPage.productUrlUsed, resolved.factsheetUrl);
      const bytes = await getBytes(factsheetUrl, context);
      const pdf = await parseIsharesFactsheetPdfBytes(bytes);
      parsed = {
        country: pdf.payload.country.map((row) => ({ name: row.country, weight: row.weight })),
        sector: pdf.payload.sector.map((row) => ({ name: row.sector, weight: row.weight })),
        asOfDate: pdf.asOfDate || parsed.asOfDate,
        parsingMode: "PDF"
      };
      sourceMeta = {
        ...sourceMeta,
        parsingMode: "PDF",
        factsheetUrl
      };
    }

    return finalizeExposure({
      rawCountry: parsed.country,
      rawSector: parsed.sector,
      asOfDate: parsed.asOfDate,
      sourceMeta,
      fallbackInput: {
        displayName: hints.displayName || hints.name,
        benchmarkName: hints.trackedIndexName,
        indexName: hints.trackedIndexName
      },
      instrumentId: hints.instrumentId
    });
  }
};
