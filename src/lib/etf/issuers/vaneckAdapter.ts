import { finalizeExposure, type RawExposureRow } from "@/lib/etf/exposure/finalizeExposure";
import { getBytes, getJson, getText, type RequestContext } from "@/lib/etf/issuers/httpClient";
import { parseAsOfDate, toAbsoluteUrl } from "@/lib/etf/issuers/parseHelpers";
import { extractPdfText as extractPdfTextFromBytes } from "@/lib/etf/issuers/pdfText";
import type { IssuerExposureAdapter, ResolvedIssuerFund } from "@/lib/etf/issuers/types";
import { parseIsharesFactsheetPdfBytes } from "@/lib/ishares/isharesExposure";

const PARSER_VERSION = "vaneck-pdf-v1";
const VANECK_FACTSHEET_LIST_PAGES = [
  "https://www.vaneck.com/nl/en/library/fact-sheets/"
];
const DEFAULT_VANECK_LOCALE = {
  country: "nl",
  language: "en"
};

const MONTHS: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11
};

function lower(value: string | null | undefined) {
  return String(value || "").toLowerCase();
}

function toUpper(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase();
}

function strip(value: string | null | undefined) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function tokenizeName(value: string | null | undefined) {
  return strip(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4)
    .filter((token) => !["vaneck", "ucits", "etf", "fund", "distributing", "accumulating"].includes(token));
}

function normalizeIsin(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

async function extractPdfText(bytes: Buffer) {
  try {
    return await extractPdfTextFromBytes(bytes);
  } catch {
    return bytes.toString("utf8");
  }
}

function containsIsin(text: string, isin: string) {
  const normalizedText = normalizeIsin(text);
  const normalizedIsin = normalizeIsin(isin);
  return normalizedText.includes(normalizedIsin);
}

function extractFactsheetPdfLinks(html: string, baseUrl: string) {
  const matches = Array.from(html.matchAll(/href="([^"]+\.pdf[^"]*)"/gi))
    .map((match) => match[1])
    .map((href) => toAbsoluteUrl(baseUrl, href));
  return Array.from(new Set(matches)).sort();
}

function scorePdfCandidate(
  url: string,
  hints: { tickerHint: string | null; name: string; displayName: string | null }
) {
  const text = url.toLowerCase();
  let score = 0;
  const ticker = lower(hints.tickerHint);
  if (ticker && text.includes(ticker)) score += 10;
  for (const token of tokenizeName(hints.displayName || hints.name)) {
    if (text.includes(token)) score += 1;
  }
  return score;
}

function rankPdfCandidates(
  urls: string[],
  hints: { tickerHint: string | null; name: string; displayName: string | null }
) {
  return urls
    .map((url) => ({ url, score: scorePdfCandidate(url, hints) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.url.localeCompare(b.url);
    })
    .map((row) => row.url);
}

async function verifyFactsheetByIsin(
  factsheetUrl: string,
  isin: string,
  context: RequestContext
) {
  const bytes = await getBytes(factsheetUrl, context);
  const text = await extractPdfText(bytes);
  if (!containsIsin(text, isin)) return null;
  return { bytes, text };
}

function parseLongMonthDate(value: string) {
  const match = /\b([0-3]?\d)\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i.exec(value);
  if (!match) return null;
  const day = Number(match[1]);
  const month = MONTHS[match[2].toLowerCase()];
  const year = Number(match[3]);
  if (!Number.isFinite(day) || month === undefined || !Number.isFinite(year)) return null;
  const parsed = new Date(Date.UTC(year, month, day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseWeightingsAsOfDate(value: string | null | undefined) {
  const normalized = strip(value);
  if (!normalized) return null;

  const contextual = parseAsOfDate(normalized);
  if (contextual) return contextual;

  const longMonth = parseLongMonthDate(normalized);
  if (longMonth) return longMonth;

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/gi, "/");
}

function resolveLocaleFromUrl(url: string | null | undefined) {
  const parsed = /https?:\/\/[^/]+\/([a-z]{2})\/([a-z]{2})\//i.exec(String(url || ""));
  if (!parsed) return DEFAULT_VANECK_LOCALE;
  return {
    country: parsed[1].toLowerCase(),
    language: parsed[2].toLowerCase()
  };
}

function isPdfUrl(url: string | null | undefined) {
  return /\.pdf(?:[?#]|$)/i.test(String(url || "").trim());
}

function seedVaneckConsentCookies(context: RequestContext, localeUrl?: string | null) {
  if (!context.cookieJar) {
    context.cookieJar = new Map<string, string>();
  }

  const locale = resolveLocaleFromUrl(localeUrl || null);
  const consentValue = `iso=${locale.country}&investortype=professional&language=${locale.language}&disclaimer=true&foreigntax=false&foreigntaxdisclaimer=false`;

  context.cookieJar.set(`ve-country-${locale.country}`, encodeURIComponent(consentValue));
  context.cookieJar.set("ve-country", encodeURIComponent(`current=${locale.country}&previous=`));
  context.cookieJar.set("sitelanguage", locale.language);
  context.cookieJar.set("visitortype", "user");
}

function extractInvestmentLinksFromSearch(html: string, baseUrl: string) {
  const links = Array.from(html.matchAll(/href="([^"]*\/investments\/[^"]+)"/gi))
    .map((match) => decodeHtmlEntities(match[1]))
    .map((href) => toAbsoluteUrl(baseUrl, href))
    .map((href) => href.split("?")[0]);
  return Array.from(new Set(links)).sort();
}

function buildProductPageCandidates(url: string) {
  const normalized = url.split("?")[0].replace(/\/+$/, "");
  if (!normalized) return [];
  const portfolioUrl = /\/portfolio$/i.test(normalized)
    ? normalized
    : `${normalized}/portfolio`;
  return Array.from(new Set([normalized, portfolioUrl]));
}

async function resolveFromSearch(
  isin: string,
  hints: { tickerHint: string | null; name: string; displayName: string | null },
  context: RequestContext
): Promise<ResolvedIssuerFund | null> {
  const searchBase = "https://www.vaneck.com/nl/en";
  const searchUrl = `${searchBase}/search/?searchtext=${encodeURIComponent(isin)}`;
  try {
    seedVaneckConsentCookies(context, searchBase);
    const searchHtml = await getText(searchUrl, context);
    const candidates = extractInvestmentLinksFromSearch(searchHtml, searchBase);
    for (const candidate of candidates) {
      const pageCandidates = buildProductPageCandidates(candidate);
      for (const pageUrl of pageCandidates) {
        try {
          const pageHtml = await getText(pageUrl, context);
          if (!containsIsin(pageHtml, isin)) continue;

          const factsheetCandidates = rankPdfCandidates(
            extractFactsheetPdfLinks(pageHtml, pageUrl).filter((url) => /fact-?sheet/i.test(url)),
            hints
          );

          for (const factsheetUrl of factsheetCandidates) {
            const resolved = await resolveByKnownFactsheetUrl(
              factsheetUrl,
              isin,
              context,
              "FACTSHEET_LIST",
              searchBase
            );
            if (resolved) {
              return {
                ...resolved,
                productUrl: pageUrl,
                pageHtml
              };
            }
          }

          // If the product page itself contains the ISIN, accept its factsheet link
          // even when the PDF ISIN verification endpoint is temporarily blocked.
          const firstFactsheetUrl = factsheetCandidates[0];
          if (firstFactsheetUrl) {
            console.warn("[VANECK][RESOLVE] using unverified page-linked factsheet fallback", {
              isin,
              pageUrl,
              factsheetUrl: firstFactsheetUrl
            });
            return {
              issuer: "VANECK",
              isin,
              locale: searchBase,
              localeBaseUsed: searchBase,
              productUrl: pageUrl,
              factsheetUrl: firstFactsheetUrl,
              pageHtml,
              resolvedFrom: "FACTSHEET_LIST"
            };
          }
        } catch {
          continue;
        }
      }
    }
  } catch (error) {
    console.warn("[VANECK][RESOLVE] search route failed", {
      isin,
      searchUrl,
      message: error instanceof Error ? error.message : String(error)
    });
  }
  return null;
}

function parseAsOfDateFromText(text: string) {
  const helperParsed = parseAsOfDate(text);
  if (helperParsed) return helperParsed;

  const contextual = /(?:as of|as at|data as at|updated(?: on)?|facts as at)\s*:?\s*([0-3]?\d\s+[A-Za-z]{3,9}\s+\d{4})/i.exec(text);
  const contextualParsed = parseLongMonthDate(contextual?.[1] || "");
  if (contextualParsed) return contextualParsed;

  const genericParsed = parseLongMonthDate(text);
  return genericParsed;
}

function buildPatternUrls(hints: { tickerHint: string | null }) {
  const ticker = lower(hints.tickerHint);
  if (!ticker) return [];

  const candidates = [
    `https://www.vaneck.com/nl/en/library/fact-sheets/${ticker}-fact-sheet.pdf`,
    `https://www.vaneck.com/nl/en/library/fact-sheets/${ticker}.pdf`,
  ];
  return Array.from(new Set(candidates));
}

function parseWeight(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value / 100;
  }
  const normalized = strip(String(value || ""))
    .replace("%", "")
    .replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed / 100;
}

function isLikelyExposureLabel(value: string | null | undefined) {
  const label = String(value || "");
  const trimmed = label.trim();
  if (!trimmed) return false;
  if (/^\/[A-Za-z]/.test(trimmed)) return false;
  if (/^(?:obj|endobj|stream|endstream|xref|trailer)$/i.test(trimmed)) return false;
  return /[A-Za-z]/.test(trimmed);
}

function filterPdfExposureRows(rows: RawExposureRow[]) {
  const filtered = rows.filter((row) => isLikelyExposureLabel(row.name));
  return {
    rows: filtered,
    droppedCount: rows.length - filtered.length
  };
}

function extractWeightingBlocks(pageHtml: string) {
  const matches = Array.from(
    pageHtml.matchAll(
      /<ve-holdingsweightingschartblock[^>]*data-blockid="(\d+)"[^>]*data-pageid="(\d+)"[^>]*data-template="([^"]*)"[^>]*>/gi
    )
  );
  return matches.map((match) => ({
    blockId: match[1],
    pageId: match[2],
    template: strip(match[3]) || "HoldingsWeightingsChartBlock"
  }));
}

type WeightingsResponse = {
  data?: {
    WeightingsType?: string | null;
    AsOfDate?: string | null;
    Holdings?: Array<Record<string, unknown>> | null;
  } | null;
};

async function fetchWeightingsFromProductPage(
  pageHtml: string,
  productUrl: string,
  tickerHint: string | null,
  context: RequestContext
) {
  const blocks = extractWeightingBlocks(pageHtml);
  if (!blocks.length) {
    return {
      sector: [] as RawExposureRow[],
      country: [] as RawExposureRow[],
      asOfDate: null as Date | null
    };
  }

  const origin = new URL(productUrl).origin;
  const sectorRows: RawExposureRow[] = [];
  const countryRows: RawExposureRow[] = [];
  let latestAsOfDate: Date | null = null;

  for (const block of blocks) {
    const endpoint = `${origin}/Main/${block.template}/GetContent/?blockid=${encodeURIComponent(
      block.blockId
    )}&pageid=${encodeURIComponent(block.pageId)}${tickerHint ? `&ticker=${encodeURIComponent(tickerHint)}` : ""}`;

    try {
      const response = await getJson<WeightingsResponse>(endpoint, context);
      const weightingsType = lower(response?.data?.WeightingsType);
      const holdings = Array.isArray(response?.data?.Holdings) ? response.data?.Holdings : [];
      const asOfDate = parseWeightingsAsOfDate(response?.data?.AsOfDate || "");
      if (asOfDate && (!latestAsOfDate || asOfDate.getTime() > latestAsOfDate.getTime())) {
        latestAsOfDate = asOfDate;
      }

      for (const row of holdings || []) {
        const weight = parseWeight(row.Weight);
        if (weight === null || weight <= 0) continue;
        const sectorName = String(row.Sector || row.Label || "");
        const countryName = String(row.Country || row.Label || "");

        if (weightingsType.includes("sector")) {
          if (sectorName.trim()) sectorRows.push({ name: sectorName, weight });
          continue;
        }
        if (weightingsType.includes("country")) {
          if (countryName.trim()) countryRows.push({ name: countryName, weight });
        }
      }
    } catch (error) {
      console.warn("[VANECK][FETCH] holdings weightings block failed", {
        productUrl,
        blockId: block.blockId,
        pageId: block.pageId,
        template: block.template,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return { sector: sectorRows, country: countryRows, asOfDate: latestAsOfDate };
}

async function resolveByKnownFactsheetUrl(
  url: string,
  isin: string,
  context: RequestContext,
  resolvedFrom: ResolvedIssuerFund["resolvedFrom"],
  localeBaseUsed: string | null
): Promise<ResolvedIssuerFund | null> {
  if (!isPdfUrl(url)) return null;
  try {
    seedVaneckConsentCookies(context, localeBaseUsed);
    const verified = await verifyFactsheetByIsin(url, isin, context);
    if (!verified) return null;
    console.info("[VANECK][RESOLVE] verified factsheet", {
      isin,
      resolvedFrom,
      factsheetUrl: url
    });
    return {
      issuer: "VANECK",
      isin,
      locale: localeBaseUsed,
      localeBaseUsed,
      productUrl: url,
      factsheetUrl: url,
      pageHtml: null,
      resolvedFrom
    };
  } catch {
    return null;
  }
}

async function resolveFromFactsheetList(
  isin: string,
  hints: { tickerHint: string | null; name: string; displayName: string | null },
  context: RequestContext
) {
  const maxCandidates = Number(process.env.VANECK_MAX_FACTSHEET_CANDIDATES || 160);
  for (const listUrl of VANECK_FACTSHEET_LIST_PAGES) {
    try {
      const html = await getText(listUrl, context);
      const urls = extractFactsheetPdfLinks(html, listUrl);
      if (!urls.length) continue;
      const ranked = rankPdfCandidates(urls, hints).slice(0, maxCandidates);
      for (const candidate of ranked) {
        const resolved = await resolveByKnownFactsheetUrl(candidate, isin, context, "FACTSHEET_LIST", listUrl);
        if (resolved) return resolved;
      }
    } catch (error) {
      console.warn("[VANECK][RESOLVE] factsheet list failed", {
        isin,
        listUrl,
        message: error instanceof Error ? error.message : String(error)
      });
      continue;
    }
  }
  return null;
}

export const vaneckAdapter: IssuerExposureAdapter = {
  issuer: "VANECK",
  source: "VANECK",
  canHandleInstrument(hints) {
    const issuer = lower(hints.issuer);
    const name = lower(hints.name);
    const displayName = lower(hints.displayName);
    return issuer.includes("vaneck") || name.includes("vaneck") || displayName.includes("vaneck");
  },
  async resolveByIsin(isin, hints) {
    const context: RequestContext = { cookieJar: new Map<string, string>() };
    seedVaneckConsentCookies(context, "https://www.vaneck.com/nl/en");

    if (hints.cachedProductUrl && isPdfUrl(hints.cachedProductUrl)) {
      const fromCache = await resolveByKnownFactsheetUrl(hints.cachedProductUrl, isin, context, "CACHE", null);
      if (fromCache) return fromCache;
    }

    const fromSearch = await resolveFromSearch(isin, hints, context);
    if (fromSearch) return fromSearch;

    const fromList = await resolveFromFactsheetList(isin, hints, context);
    if (fromList) return fromList;

    const patternUrls = buildPatternUrls({ tickerHint: hints.tickerHint });
    for (const url of patternUrls) {
      const byPattern = await resolveByKnownFactsheetUrl(url, isin, context, "URL_PATTERN", "https://www.vaneck.com");
      if (byPattern) return byPattern;
    }

    return null;
  },
  async fetchExposure(resolved, hints) {
    const context: RequestContext = { cookieJar: new Map<string, string>() };
    seedVaneckConsentCookies(context, resolved.localeBaseUsed || resolved.locale || "https://www.vaneck.com/nl/en");
    const factsheetUrl = resolved.factsheetUrl || resolved.productUrl;
    if (!factsheetUrl) {
      throw new Error("VanEck factsheet URL is missing.");
    }

    const bytes = await getBytes(factsheetUrl, context);
    const pdfText = await extractPdfText(bytes);
    const parsed = await parseIsharesFactsheetPdfBytes(bytes);

    let asOfDate = parseAsOfDateFromText(pdfText) || parsed.asOfDate;
    const parsedCountryRows: RawExposureRow[] = parsed.payload.country.map((row) => ({
      name: row.country,
      weight: row.weight
    }));
    const parsedSectorRows: RawExposureRow[] = parsed.payload.sector.map((row) => ({
      name: row.sector,
      weight: row.weight
    }));
    const filteredCountry = filterPdfExposureRows(parsedCountryRows);
    const filteredSector = filterPdfExposureRows(parsedSectorRows);
    const rawCountry: RawExposureRow[] = [...filteredCountry.rows];
    const rawSector: RawExposureRow[] = [...filteredSector.rows];

    if (filteredCountry.droppedCount || filteredSector.droppedCount) {
      console.warn("[VANECK][PARSE] discarded suspicious PDF exposure rows", {
        isin: hints.isin,
        droppedCountryRows: filteredCountry.droppedCount,
        droppedSectorRows: filteredSector.droppedCount
      });
    }

    const needsWeightingsFallback = !rawSector.length || !rawCountry.length;
    let productUrlForWeightings = resolved.productUrl && !isPdfUrl(resolved.productUrl) ? resolved.productUrl : null;
    let pageHtml = resolved.pageHtml || null;

    if (needsWeightingsFallback && (!productUrlForWeightings || !pageHtml)) {
      const fromSearch = await resolveFromSearch(resolved.isin, hints, context);
      if (fromSearch?.productUrl && !isPdfUrl(fromSearch.productUrl)) {
        productUrlForWeightings = fromSearch.productUrl;
        pageHtml = fromSearch.pageHtml || null;
      }
    }

    if (needsWeightingsFallback && productUrlForWeightings) {
      const pageCandidates = buildProductPageCandidates(productUrlForWeightings);
      for (const pageCandidate of pageCandidates) {
        let candidateHtml = pageHtml;
        if (!candidateHtml || pageCandidate !== productUrlForWeightings) {
          try {
            candidateHtml = await getText(pageCandidate, context);
          } catch {
            candidateHtml = null;
          }
        }
        if (!candidateHtml) continue;

        const fromBlocks = await fetchWeightingsFromProductPage(
          candidateHtml,
          pageCandidate,
          hints.tickerHint,
          context
        );
        const sectorFilledFromBlocks = !rawSector.length && fromBlocks.sector.length > 0;
        const countryFilledFromBlocks = !rawCountry.length && fromBlocks.country.length > 0;

        if (sectorFilledFromBlocks) {
          rawSector.push(...fromBlocks.sector);
        }
        if (countryFilledFromBlocks) {
          rawCountry.push(...fromBlocks.country);
        }
        if (fromBlocks.asOfDate && (!asOfDate || sectorFilledFromBlocks || countryFilledFromBlocks)) {
          asOfDate = fromBlocks.asOfDate;
        }
        if (rawSector.length && rawCountry.length) {
          break;
        }
      }
    }

    const finalized = finalizeExposure({
      rawCountry,
      rawSector,
      asOfDate,
      sourceMeta: {
        issuer: "VANECK",
        parsingMode: "PDF",
        parserVersion: PARSER_VERSION,
        factsheetUrl,
        productUrl: productUrlForWeightings || resolved.productUrl,
        locale: resolved.locale,
        localeBaseUsed: resolved.localeBaseUsed || resolved.locale || null,
        resolvedFrom: resolved.resolvedFrom || null,
        sourcePdfParser: parsed.sourceMeta?.parser || null,
        sourceCountriesExtracted: parsed.sourceMeta?.countriesExtracted ?? null,
        sourceSectorsExtracted: parsed.sourceMeta?.sectorsExtracted ?? null,
        droppedSuspiciousPdfCountryRows: filteredCountry.droppedCount,
        droppedSuspiciousPdfSectorRows: filteredSector.droppedCount
      },
      fallbackInput: {
        displayName: hints.displayName || hints.name,
        benchmarkName: hints.trackedIndexName,
        indexName: hints.trackedIndexName
      },
      instrumentId: hints.instrumentId
    });

    console.info("[VANECK][PARSE]", {
      isin: hints.isin,
      asOfDate: finalized.asOfDate ? finalized.asOfDate.toISOString().slice(0, 10) : null,
      countries: finalized.payload.country.length,
      sectors: finalized.payload.sector.length,
      partial: Boolean((finalized.sourceMeta as Record<string, unknown>).partialBreakdown)
    });

    return finalized;
  }
};
