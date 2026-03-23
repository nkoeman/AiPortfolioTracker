import { finalizeExposure, type RawExposureRow } from "@/lib/etf/exposure/finalizeExposure";
import { getBytes, getText, postJson, type RequestContext } from "@/lib/etf/issuers/httpClient";
import { extractJsonArrayFromScript, extractRowsForHeadings, findFirstPdfUrl, parseAsOfDate, toAbsoluteUrl } from "@/lib/etf/issuers/parseHelpers";
import { extractPdfText as extractPdfTextFromBytes } from "@/lib/etf/issuers/pdfText";
import type { IssuerExposureAdapter } from "@/lib/etf/issuers/types";
import { parseIsharesFactsheetPdfBytes } from "@/lib/ishares/isharesExposure";

const VANGUARD_BASE_URLS = [
  "https://www.vanguard.co.uk",
  "https://www.ie.vanguard"
];
const VANGUARD_SEARCH_BATCH_SIZE = 40;
const GPX_FUND_FINDER_QUERY = `
query FundFinderSearchQuery($portIds: [String!]!) {
  funds(portIds: $portIds) {
    profile {
      portId
      fundFullName
      shareClassName
      polarisPdtTypeIndicator
      assetClassificationLevel1
      identifiers(altIds: ["ISIN", "Ticker", "Bloomberg", "Ticker - Canada"]) {
        altId
        altIdValue
        altIdCode
      }
      listings {
        stockExchangeMarketIdentifierCode
        fundCurrency
        identifiers(
          altIds: [
            "ISIN"
            "Bloomberg"
            "TIDM"
            "Bolsa Ticker"
            "SIX Swiss Exchange Ticker"
            "Borsa Italian Ticker"
            "Deutsche Boerse Ticker"
            "NYSE Euronext Exchange Ticker"
            "Ticker - Canada"
            "Ticker"
            "RIC"
            "SEDOL"
            "Bloomberg iNAV"
          ]
        ) {
          altId
          altIdValue
          altIdCode
        }
      }
    }
  }
}
`;

const GPX_MARKET_ALLOCATION_QUERY = `
query MarketAllocationGqlQuery($portIds: [String!]!) {
  funds(portIds: $portIds) {
    marketAllocation {
      date
      countryName
      fundMktPercent
    }
  }
}
`;

const GPX_SECTOR_DIVERSIFICATION_QUERY = `
query getSectorDiversification($portIds: [String!]!) {
  funds(portIds: $portIds) {
    sectorDiversification {
      date
      sectorName
      fundPercent
    }
  }
}
`;

type VanguardFundProfile = {
  portId: string | null;
  fundFullName: string | null;
  shareClassName: string | null;
  polarisPdtTypeIndicator: string | null;
  assetClassificationLevel1: string | null;
  identifiers?: Array<{ altId?: string | null; altIdValue?: string | null; altIdCode?: string | null }> | null;
  listings?: Array<{
    stockExchangeMarketIdentifierCode?: string | null;
    fundCurrency?: string | null;
    identifiers?: Array<{ altId?: string | null; altIdValue?: string | null; altIdCode?: string | null }> | null;
  }> | null;
};

type VanguardFundRow = {
  profile?: VanguardFundProfile | null;
};

type VanguardFundFinderResponse = {
  data?: {
    funds?: VanguardFundRow[];
  };
  errors?: Array<{ message?: string }>;
};

type VanguardMarketAllocationResponse = {
  data?: {
    funds?: Array<{
      marketAllocation?: Array<{
        date?: string | null;
        countryName?: string | null;
        fundMktPercent?: number | null;
      }> | null;
    }>;
  };
  errors?: Array<{ message?: string }>;
};

type VanguardSectorDiversificationResponse = {
  data?: {
    funds?: Array<{
      sectorDiversification?: Array<{
        date?: string | null;
        sectorName?: string | null;
        fundPercent?: number | null;
      }> | null;
    }>;
  };
  errors?: Array<{ message?: string }>;
};

function lower(value: string | null | undefined) {
  return String(value || "").toLowerCase();
}

function hasIsin(text: string, isin: string) {
  return text.toUpperCase().includes(isin.toUpperCase());
}

function slugify(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[()]/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildNameSlugCandidates(fundFullName: string | null | undefined) {
  const base = slugify(fundFullName);
  if (!base) return [];
  return Array.from(
    new Set([
      base,
      base.replace(/-and-/g, "-")
    ])
  );
}

function extractPortIds(pageHtml: string) {
  const match = /"portIds":"([^"]+)"/i.exec(pageHtml);
  if (!match?.[1]) return [];
  return match[1]
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function mapProductType(value: string | null | undefined) {
  const normalized = lower(value);
  if (normalized === "etf") return "etf";
  if (normalized === "fund" || normalized === "mf") return "fund";
  return "fund";
}

function mapAssetClass(value: string | null | undefined) {
  const normalized = lower(value);
  if (normalized.includes("equity")) return "equity";
  if (normalized.includes("bond") || normalized.includes("fixed")) return "bond";
  if (normalized.includes("money")) return "money-market";
  if (normalized.includes("multi")) return "multi-asset";
  if (normalized.includes("balanced")) return "balanced";
  if (normalized.includes("target retirement")) return "target-retirement";
  if (normalized.includes("lifestrategy")) return "lifestrategy";
  return "equity";
}

function toConsumerCandidates(baseUrl: string) {
  const host = new URL(baseUrl).host.toLowerCase();
  if (host.includes("nl.vanguard")) return ["nl0"];
  if (host.includes("ie.vanguard")) return ["ie0"];
  if (host.includes("vanguard.co.uk")) return ["uk0", "gb0"];
  return ["nl0", "ie0", "uk0"];
}

function extractPortIdFromProductUrl(productUrl: string | null | undefined) {
  const match = /\/product\/[^/]+\/[^/]+\/([0-9]{3,8})(?:\/|$)/i.exec(String(productUrl || ""));
  return match?.[1] || null;
}

function parseYyyyMmDdDate(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const parsed = new Date(`${normalized}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function toUnitWeight(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric > 1 ? numeric / 100 : numeric;
}

function latestDateValue(values: Array<string | null | undefined>) {
  let latest: Date | null = null;
  for (const value of values) {
    const parsed = parseYyyyMmDdDate(value);
    if (!parsed) continue;
    if (!latest || parsed.getTime() > latest.getTime()) {
      latest = parsed;
    }
  }
  return latest;
}

async function fetchVanguardGpxExposure(
  baseUrl: string,
  portId: string,
  context: RequestContext
) {
  const consumerId = toConsumerCandidates(baseUrl)[0] || "uk0";
  const headers = {
    "X-Consumer-ID": consumerId,
    "X-Request-URL": "/professional/product"
  };

  const [sectorResponse, marketResponse] = await Promise.all([
    postJson<VanguardSectorDiversificationResponse>(
      toAbsoluteUrl(baseUrl, "/gpx/graphql"),
      {
        query: GPX_SECTOR_DIVERSIFICATION_QUERY,
        operationName: "getSectorDiversification",
        variables: { portIds: [portId] }
      },
      context,
      headers
    ),
    postJson<VanguardMarketAllocationResponse>(
      toAbsoluteUrl(baseUrl, "/gpx/graphql"),
      {
        query: GPX_MARKET_ALLOCATION_QUERY,
        operationName: "MarketAllocationGqlQuery",
        variables: { portIds: [portId] }
      },
      context,
      headers
    )
  ]);

  if (sectorResponse.errors?.length || marketResponse.errors?.length) {
    return null;
  }

  const sectorRowsRaw = sectorResponse.data?.funds?.[0]?.sectorDiversification || [];
  const countryRowsRaw = marketResponse.data?.funds?.[0]?.marketAllocation || [];

  const sectorRows = sectorRowsRaw
    .map((row) => {
      const name = String(row.sectorName || "");
      const weight = toUnitWeight(row.fundPercent);
      if (!name.trim() || weight === null) return null;
      return { name, weight };
    })
    .filter((row): row is { name: string; weight: number } => Boolean(row));

  const countryRows = countryRowsRaw
    .map((row) => {
      const name = String(row.countryName || "");
      const weight = toUnitWeight(row.fundMktPercent);
      if (!name.trim() || weight === null) return null;
      return { name, weight };
    })
    .filter((row): row is { name: string; weight: number } => Boolean(row));

  const asOfDate = latestDateValue([
    ...sectorRowsRaw.map((row) => row.date),
    ...countryRowsRaw.map((row) => row.date)
  ]);

  if (!sectorRows.length && !countryRows.length) {
    return null;
  }

  return {
    sector: sectorRows,
    country: countryRows,
    asOfDate,
    meta: {
      gpxPortId: portId,
      gpxConsumerId: consumerId
    }
  };
}

function collectIsinCandidates(row: VanguardFundRow) {
  const candidates = new Set<string>();
  for (const identifier of row.profile?.identifiers || []) {
    const value = String(identifier?.altIdValue || "").trim().toUpperCase();
    if (value) candidates.add(value);
  }
  for (const listing of row.profile?.listings || []) {
    for (const identifier of listing.identifiers || []) {
      const value = String(identifier?.altIdValue || "").trim().toUpperCase();
      if (value) candidates.add(value);
    }
  }
  return candidates;
}

function matchesTickerHint(row: VanguardFundRow, tickerHint: string | null | undefined) {
  const normalizedHint = String(tickerHint || "").trim().toUpperCase();
  if (!normalizedHint) return false;
  for (const identifier of row.profile?.identifiers || []) {
    const candidate = String(identifier?.altIdValue || "").trim().toUpperCase();
    if (candidate === normalizedHint) return true;
  }
  for (const listing of row.profile?.listings || []) {
    for (const identifier of listing.identifiers || []) {
      const candidate = String(identifier?.altIdValue || "").trim().toUpperCase();
      if (candidate === normalizedHint) return true;
    }
  }
  return false;
}

function chunk<T>(items: T[], size: number) {
  const buckets: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    buckets.push(items.slice(index, index + size));
  }
  return buckets;
}

async function findFundByIsinViaGpx(
  baseUrl: string,
  portIds: string[],
  isin: string,
  tickerHint: string | null | undefined,
  context: RequestContext
) {
  const targetIsin = isin.trim().toUpperCase();
  const batches = chunk(portIds, VANGUARD_SEARCH_BATCH_SIZE);
  const sortedMatches: VanguardFundRow[] = [];

  for (const consumerId of toConsumerCandidates(baseUrl)) {
    for (const batch of batches) {
      const response = await postJson<VanguardFundFinderResponse>(
        toAbsoluteUrl(baseUrl, "/gpx/graphql"),
        {
          query: GPX_FUND_FINDER_QUERY,
          operationName: "FundFinderSearchQuery",
          variables: {
            portIds: batch
          }
        },
        context,
        {
          "X-Consumer-ID": consumerId,
          "X-Request-URL": "/professional/product"
        }
      );

      if (response.errors?.length) {
        continue;
      }

      for (const fund of response.data?.funds || []) {
        const isins = collectIsinCandidates(fund);
        if (isins.has(targetIsin)) {
          sortedMatches.push(fund);
        }
      }

      if (sortedMatches.length > 0) {
        return sortedMatches
          .sort((a, b) => String(a.profile?.portId || "").localeCompare(String(b.profile?.portId || "")))[0] || null;
      }
    }
  }

  if (tickerHint) {
    for (const consumerId of toConsumerCandidates(baseUrl)) {
      for (const batch of batches) {
        const response = await postJson<VanguardFundFinderResponse>(
          toAbsoluteUrl(baseUrl, "/gpx/graphql"),
          {
            query: GPX_FUND_FINDER_QUERY,
            operationName: "FundFinderSearchQuery",
            variables: {
              portIds: batch
            }
          },
          context,
          {
            "X-Consumer-ID": consumerId,
            "X-Request-URL": "/professional/product"
          }
        );

        if (response.errors?.length) {
          continue;
        }

        const tickerMatch = (response.data?.funds || [])
          .filter((fund) => matchesTickerHint(fund, tickerHint))
          .sort((a, b) => String(a.profile?.portId || "").localeCompare(String(b.profile?.portId || "")))[0];

        if (tickerMatch) return tickerMatch;
      }
    }
  }

  return null;
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

function extractPdfUrlsFromHtml(pageHtml: string, baseUrl: string) {
  const links = Array.from(pageHtml.matchAll(/href="([^"]+\.pdf[^"]*)"/gi))
    .map((match) => match[1])
    .map((href) => toAbsoluteUrl(baseUrl, href));
  return Array.from(new Set(links));
}

function scoreVanguardPdf(url: string) {
  const value = url.toLowerCase();
  let score = 0;

  if (value.includes("fund-docs.vanguard.com")) score += 20;
  if (value.includes("factsheet") || value.includes("fact-sheet")) score += 18;
  if (value.includes("_int_")) score += 12;
  if (value.includes("_uk_en") || value.includes("_en.pdf") || value.includes("/en/")) score += 16;
  if (value.includes("_du.pdf") || value.includes("_nl.pdf")) score -= 10;
  if (value.includes("priips")) score -= 20;
  if (value.includes("prospectus")) score -= 20;
  if (value.includes("annual-report") || value.includes("semiannual-report")) score -= 20;
  if (value.includes("memorandum")) score -= 20;

  return score;
}

function buildVanguardFactsheetCandidates(pageHtml: string, productUrl: string, resolvedFactsheetUrl?: string | null) {
  const candidates = new Set<string>();
  if (resolvedFactsheetUrl) {
    candidates.add(toAbsoluteUrl(productUrl, resolvedFactsheetUrl));
  }
  for (const url of extractPdfUrlsFromHtml(pageHtml, productUrl)) {
    candidates.add(url);
  }
  return Array.from(candidates)
    .sort((a, b) => {
      const scoreDiff = scoreVanguardPdf(b) - scoreVanguardPdf(a);
      if (scoreDiff !== 0) return scoreDiff;
      return a.localeCompare(b);
    })
    .slice(0, 6);
}

function toWeight(value: string) {
  const parsed = Number(String(value).replace(",", ".").trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed / 100;
}

async function extractPdfText(bytes: Buffer) {
  try {
    return await extractPdfTextFromBytes(bytes);
  } catch {
    return bytes.toString("utf8");
  }
}

function extractVanguardSectorRowsFromPdfText(text: string): Array<{ name: string; weight: number }> {
  const lines = text.split(/\r?\n/);
  const stopMarkers = [
    /market allocation/i,
    /country allocation/i,
    /country exposure/i,
    /geographic/i,
    /top [0-9]+ holdings/i,
    /holdings/i,
    /trading information/i,
    /risk indicator/i,
    /fund benchmark/i
  ];
  const rowPattern = /^([A-Za-z][A-Za-z&/,'().\- ]+?)\s+([0-9]{1,3}(?:[.,][0-9]{1,2})?)%?$/;

  const rows: Array<{ name: string; weight: number }> = [];
  let inSectorSection = false;

  for (const line of lines) {
    const normalizedLine = line.replace(/\u00a0/g, " ");
    const controlLine = normalizedLine.trim();
    if (!controlLine) continue;

    const markerMatch = /(weighted exposure|sector allocation|sector exposure|industry allocation|industry exposure)\s*(.*)$/i.exec(controlLine);
    if (!inSectorSection && markerMatch) {
      inSectorSection = true;
      const trailing = markerMatch[2]?.trim() || "";
      if (trailing) {
        const inlineMatch = rowPattern.exec(trailing);
        if (inlineMatch) {
          const weight = toWeight(inlineMatch[2]);
          if (weight !== null) {
            rows.push({ name: inlineMatch[1].trim(), weight });
          }
        }
      }
      continue;
    }

    if (!inSectorSection) continue;
    if (stopMarkers.some((regex) => regex.test(controlLine))) {
      if (rows.length > 0) break;
      continue;
    }

    const match = rowPattern.exec(controlLine);
    if (!match) continue;
    const weight = toWeight(match[2]);
    if (weight === null) continue;
    const name = match[1];
    if (!name) continue;
    rows.push({ name, weight });
  }

  return rows;
}

function parseExposureFromPageHtml(pageHtml: string) {
  const jsonCountry = mapJsonRows(
    extractJsonArrayFromScript<Record<string, unknown>>(pageHtml, [
      "countryExposure",
      "countryAllocation",
      "geographicExposure"
    ])
  );
  const jsonSector = mapJsonRows(
    extractJsonArrayFromScript<Record<string, unknown>>(pageHtml, [
      "sectorExposure",
      "industryExposure",
      "sectorAllocation",
      "industryAllocation"
    ])
  );

  const htmlCountry = extractRowsForHeadings(pageHtml, [
    "country exposure",
    "country allocation",
    "geographical exposure",
    "geographic exposure"
  ]);
  const htmlSector = extractRowsForHeadings(pageHtml, [
    "sector allocation",
    "sector exposure",
    "industry allocation",
    "industry exposure"
  ]);

  return {
    country: jsonCountry.length ? jsonCountry : htmlCountry,
    sector: jsonSector.length ? jsonSector : htmlSector,
    parsingMode: jsonCountry.length || jsonSector.length ? "JSON" : "HTML",
    asOfDate: parseAsOfDate(pageHtml)
  };
}

async function tryResolveCandidate(url: string, isin: string, context: RequestContext) {
  try {
    const html = await getText(url, context);
    if (/<title>\s*404\b/i.test(html) || /cannot find the page you requested/i.test(html)) {
      return null;
    }
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

async function tryResolveCandidateForMatchedFund(url: string, context: RequestContext) {
  try {
    const html = await getText(url, context);
    if (/<title>\s*404\b/i.test(html) || /cannot find the page you requested/i.test(html)) {
      return null;
    }
    return {
      productUrl: url,
      pageHtml: html,
      factsheetUrl: findFirstPdfUrl(html)
    };
  } catch {
    return null;
  }
}

async function resolveFromGpxProductSearch(baseUrl: string, isin: string, tickerHint: string | null | undefined, context: RequestContext) {
  try {
    const productListPageUrl = toAbsoluteUrl(baseUrl, "/professional/product?search=") + encodeURIComponent(isin);
    const pageHtml = await getText(productListPageUrl, context);
    const portIds = extractPortIds(pageHtml);
    if (!portIds.length) return null;

    const fund = await findFundByIsinViaGpx(baseUrl, portIds, isin, tickerHint, context);
    if (!fund?.profile?.portId) return null;

    const portId = fund.profile.portId;
    const productType = mapProductType(fund.profile.polarisPdtTypeIndicator);
    const assetClass = mapAssetClass(fund.profile.assetClassificationLevel1);
    const nameSlugs = buildNameSlugCandidates(fund.profile.fundFullName);

    const candidates = [
      toAbsoluteUrl(baseUrl, `/professional/product/${productType}/${assetClass}/${portId}`),
      ...nameSlugs.map((nameSlug) =>
        toAbsoluteUrl(baseUrl, `/professional/product/${productType}/${assetClass}/${portId}/${nameSlug}`)
      )
    ];

    for (const candidateUrl of Array.from(new Set(candidates))) {
      const resolved = await tryResolveCandidateForMatchedFund(candidateUrl, context);
      if (resolved) {
        console.info("[VANGUARD][RESOLVE] matched via product search route", {
          isin,
          baseUrl,
          portId,
          candidateUrl
        });
        return resolved;
      }
    }

    console.warn("[VANGUARD][RESOLVE] product search matched portId but candidate URL validation failed", {
      isin,
      baseUrl,
      portId
    });
  } catch (error) {
    console.warn("[VANGUARD][RESOLVE] product search route failed", {
      isin,
      baseUrl,
      message: error instanceof Error ? error.message : String(error)
    });
  }

  return null;
}

async function resolveFromSearch(baseUrl: string, isin: string, context: RequestContext) {
  const searchUrls = [
    `${baseUrl}/search?query=${encodeURIComponent(isin)}`,
    `${baseUrl}/search?q=${encodeURIComponent(isin)}`,
    `${baseUrl}/what-we-offer/all-products?query=${encodeURIComponent(isin)}`
  ];
  for (const searchUrl of searchUrls) {
    try {
      const html = await getText(searchUrl, context);
      const links = Array.from(html.matchAll(/<a[^>]+href="([^"]+)"/gi))
        .map((match) => match[1])
        .filter((href) => /product|fund|etf/i.test(href))
        .map((href) => toAbsoluteUrl(baseUrl, href));
      const uniqueLinks = Array.from(new Set(links)).sort();
      for (const candidateUrl of uniqueLinks.slice(0, 25)) {
        const candidate = await tryResolveCandidate(candidateUrl, isin, context);
        if (candidate) return candidate;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export const vanguardAdapter: IssuerExposureAdapter = {
  issuer: "VANGUARD",
  source: "VANGUARD",
  canHandleInstrument(hints) {
    const issuer = lower(hints.issuer);
    const name = lower(hints.name);
    const displayName = lower(hints.displayName);
    return issuer.includes("vanguard") || name.includes("vanguard") || displayName.includes("vanguard");
  },
  async resolveByIsin(isin, hints) {
    const context: RequestContext = { cookieJar: new Map<string, string>() };
    if (hints.cachedProductUrl) {
      const resolved = await tryResolveCandidate(hints.cachedProductUrl, isin, context);
      if (resolved) {
        return {
          issuer: "VANGUARD",
          isin,
          locale: null,
          productUrl: resolved.productUrl,
          factsheetUrl: resolved.factsheetUrl,
          pageHtml: resolved.pageHtml
        };
      }
    }

    for (const baseUrl of VANGUARD_BASE_URLS) {
      const byProductSearch = await resolveFromGpxProductSearch(baseUrl, isin, hints.tickerHint, context);
      if (byProductSearch) {
        return {
          issuer: "VANGUARD",
          isin,
          locale: baseUrl,
          productUrl: byProductSearch.productUrl,
          productId: extractPortIdFromProductUrl(byProductSearch.productUrl),
          factsheetUrl: byProductSearch.factsheetUrl,
          pageHtml: byProductSearch.pageHtml
        };
      }

      const resolved = await resolveFromSearch(baseUrl, isin, context);
      if (!resolved) continue;
      return {
        issuer: "VANGUARD",
        isin,
        locale: baseUrl,
        productUrl: resolved.productUrl,
        productId: extractPortIdFromProductUrl(resolved.productUrl),
        factsheetUrl: resolved.factsheetUrl,
        pageHtml: resolved.pageHtml
      };
    }
    return null;
  },
  async fetchExposure(resolved, hints) {
    const context: RequestContext = { cookieJar: new Map<string, string>() };
    const pageHtml = resolved.pageHtml || (await getText(resolved.productUrl, context));
    let parsed = parseExposureFromPageHtml(pageHtml);
    let parsingMode = parsed.parsingMode;
    let sourceMeta: Record<string, unknown> = {
      issuer: "VANGUARD",
      parsingMode,
      productUrl: resolved.productUrl,
      locale: resolved.locale
    };

    if (!parsed.sector.length || !parsed.country.length) {
      const baseUrl = resolved.locale || VANGUARD_BASE_URLS[0];
      const portId = resolved.productId || extractPortIdFromProductUrl(resolved.productUrl);
      if (portId) {
        try {
          const gpxExposure = await fetchVanguardGpxExposure(baseUrl, portId, context);
          if (gpxExposure) {
            if (!parsed.sector.length && gpxExposure.sector.length) {
              parsed = {
                ...parsed,
                sector: gpxExposure.sector
              };
            }
            if (!parsed.country.length && gpxExposure.country.length) {
              parsed = {
                ...parsed,
                country: gpxExposure.country
              };
            }
            if (!parsed.asOfDate && gpxExposure.asOfDate) {
              parsed = {
                ...parsed,
                asOfDate: gpxExposure.asOfDate
              };
            }
            if (gpxExposure.sector.length || gpxExposure.country.length) {
              parsingMode = "GPX_GRAPHQL";
            }
            sourceMeta = {
              ...sourceMeta,
              parsingMode,
              ...gpxExposure.meta
            };
            console.info("[VANGUARD][FETCH] gpx exposure used", {
              instrumentId: hints.instrumentId,
              isin: resolved.isin,
              portId,
              sectors: gpxExposure.sector.length,
              countries: gpxExposure.country.length,
              asOfDate: gpxExposure.asOfDate ? gpxExposure.asOfDate.toISOString().slice(0, 10) : null
            });
          }
        } catch (error) {
          console.warn("[VANGUARD][FETCH] gpx exposure query failed", {
            instrumentId: hints.instrumentId,
            isin: resolved.isin,
            portId,
            message: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    if (!parsed.sector.length && resolved.factsheetUrl) {
      const factsheetCandidates = buildVanguardFactsheetCandidates(
        pageHtml,
        resolved.productUrl,
        resolved.factsheetUrl
      );

      let selected: {
        factsheetUrl: string;
        country: Array<{ name: string; weight: number }>;
        sector: Array<{ name: string; weight: number }>;
        asOfDate: Date | null;
        fallbackApplied: boolean;
      } | null = null;

      for (const factsheetUrl of factsheetCandidates) {
        try {
          const bytes = await getBytes(factsheetUrl, context);
          const pdf = await parseIsharesFactsheetPdfBytes(bytes);
          let sectorRows = pdf.payload.sector.map((row) => ({ name: row.sector, weight: row.weight }));
          let fallbackApplied = false;
          if (!sectorRows.length) {
            const pdfText = await extractPdfText(bytes);
            sectorRows = extractVanguardSectorRowsFromPdfText(pdfText);
            fallbackApplied = sectorRows.length > 0;
          }

          const candidate = {
            factsheetUrl,
            country: pdf.payload.country.map((row) => ({ name: row.country, weight: row.weight })),
            sector: sectorRows,
            asOfDate: pdf.asOfDate || parsed.asOfDate,
            fallbackApplied
          };
          if (!selected) selected = candidate;
          if (candidate.sector.length > 0) {
            selected = candidate;
            break;
          }
        } catch {
          continue;
        }
      }

      if (selected) {
        parsed = {
          country: selected.country,
          sector: selected.sector,
          asOfDate: selected.asOfDate,
          parsingMode: "PDF"
        };
        parsingMode = "PDF";
        sourceMeta = {
          ...sourceMeta,
          parsingMode,
          factsheetUrl: selected.factsheetUrl,
          factsheetCandidatesTried: factsheetCandidates,
          vanguardSectorFallback: selected.fallbackApplied
        };
      }
    }

    const finalized = finalizeExposure({
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

    return finalized;
  }
};
