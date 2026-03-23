import { finalizeExposure, type RawExposureRow } from "@/lib/etf/exposure/finalizeExposure";
import { getText, type RequestContext } from "@/lib/etf/issuers/httpClient";
import { extractJsonArrayFromScript, extractRowsForHeadings, parseAsOfDate, toAbsoluteUrl } from "@/lib/etf/issuers/parseHelpers";
import type { IssuerExposureAdapter } from "@/lib/etf/issuers/types";

const COMGEST_BASE_URLS = [
  "https://www.comgest.com/en/en/individual-investors",
  "https://www.comgest.com/en/en/professional-investors"
];

function lower(value: string | null | undefined) {
  return String(value || "").toLowerCase();
}

function hasIsin(text: string, isin: string) {
  return text.toUpperCase().includes(isin.toUpperCase());
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

function parseExposureFromHtml(html: string) {
  const jsonCountry = mapJsonRows(
    extractJsonArrayFromScript<Record<string, unknown>>(html, ["countryExposure", "countryBreakdown", "geographicBreakdown"])
  );
  const jsonSector = mapJsonRows(
    extractJsonArrayFromScript<Record<string, unknown>>(html, ["sectorExposure", "industryExposure", "sectorBreakdown", "industryBreakdown"])
  );

  const htmlCountry = extractRowsForHeadings(html, ["country breakdown", "country exposure", "geographic breakdown"]);
  const htmlSector = extractRowsForHeadings(html, ["sector breakdown", "sector exposure", "industry breakdown", "industry exposure"]);

  return {
    country: jsonCountry.length ? jsonCountry : htmlCountry,
    sector: jsonSector.length ? jsonSector : htmlSector,
    parsingMode: jsonCountry.length || jsonSector.length ? "JSON" : "HTML",
    asOfDate: parseAsOfDate(html)
  };
}

async function tryResolveCandidate(url: string, isin: string, context: RequestContext) {
  try {
    const html = await getText(url, context);
    if (!hasIsin(html, isin)) return null;
    return {
      productUrl: url,
      pageHtml: html
    };
  } catch {
    return null;
  }
}

async function resolveFromSearch(baseUrl: string, isin: string, context: RequestContext) {
  const searchUrls = [
    `${baseUrl}/search?query=${encodeURIComponent(isin)}`,
    `${baseUrl}/search?q=${encodeURIComponent(isin)}`
  ];
  for (const searchUrl of searchUrls) {
    try {
      const html = await getText(searchUrl, context);
      const links = Array.from(html.matchAll(/<a[^>]+href="([^"]+)"/gi))
        .map((match) => match[1])
        .filter((href) => /fund|strategy|product|comgest/i.test(href))
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

export const comgestAdapter: IssuerExposureAdapter = {
  issuer: "COMGEST",
  source: "COMGEST",
  canHandleInstrument(hints) {
    const issuer = lower(hints.issuer);
    const name = lower(hints.name);
    const displayName = lower(hints.displayName);
    return issuer.includes("comgest") || name.includes("comgest") || displayName.includes("comgest");
  },
  async resolveByIsin(isin, hints) {
    const context: RequestContext = { cookieJar: new Map<string, string>() };
    if (hints.cachedProductUrl) {
      const resolved = await tryResolveCandidate(hints.cachedProductUrl, isin, context);
      if (resolved) {
        return {
          issuer: "COMGEST",
          isin,
          locale: null,
          productUrl: resolved.productUrl,
          pageHtml: resolved.pageHtml
        };
      }
    }

    for (const baseUrl of COMGEST_BASE_URLS) {
      const resolved = await resolveFromSearch(baseUrl, isin, context);
      if (!resolved) continue;
      return {
        issuer: "COMGEST",
        isin,
        locale: baseUrl,
        productUrl: resolved.productUrl,
        pageHtml: resolved.pageHtml
      };
    }
    return null;
  },
  async fetchExposure(resolved, hints) {
    const context: RequestContext = { cookieJar: new Map<string, string>() };
    const pageHtml = resolved.pageHtml || (await getText(resolved.productUrl, context));
    const parsed = parseExposureFromHtml(pageHtml);

    return finalizeExposure({
      rawCountry: parsed.country,
      rawSector: parsed.sector,
      asOfDate: parsed.asOfDate,
      sourceMeta: {
        issuer: "COMGEST",
        parsingMode: parsed.parsingMode,
        productUrl: resolved.productUrl,
        locale: resolved.locale
      },
      fallbackInput: {
        displayName: hints.displayName || hints.name,
        benchmarkName: hints.trackedIndexName,
        indexName: hints.trackedIndexName
      },
      instrumentId: hints.instrumentId
    });
  }
};
