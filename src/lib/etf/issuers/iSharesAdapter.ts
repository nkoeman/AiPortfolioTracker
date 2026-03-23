import type { IssuerExposureAdapter } from "@/lib/etf/issuers/types";
import { fetchIsharesExposureByIsin } from "@/lib/ishares/isharesExposure";
import { resolveIsharesFundByIsin } from "@/lib/ishares/isharesResolve";

function lower(value: string | null | undefined) {
  return String(value || "").toLowerCase();
}

export const iSharesAdapter: IssuerExposureAdapter = {
  issuer: "ISHARES",
  source: "ISHARES",
  canHandleInstrument(hints) {
    const issuer = lower(hints.issuer);
    const name = lower(hints.name);
    const displayName = lower(hints.displayName);
    return issuer.includes("ishares") || name.startsWith("ishares") || displayName.startsWith("ishares");
  },
  async resolveByIsin(isin, hints) {
    const resolved = await resolveIsharesFundByIsin(isin, {
      ticker: hints.tickerHint,
      productName: hints.displayName || hints.name
    });
    if (!resolved) return null;
    return {
      issuer: "ISHARES",
      isin,
      locale: resolved.locale,
      productUrl: resolved.productUrl,
      factsheetUrl: resolved.factsheetUrl,
      productId: resolved.productId,
      pageHtml: resolved.pageHtml
    };
  },
  async fetchExposure(_resolved, hints) {
    return fetchIsharesExposureByIsin(hints.isin, {
      instrumentId: hints.instrumentId,
      ticker: hints.tickerHint,
      productName: hints.displayName || hints.name,
      indexName: hints.trackedIndexName
    });
  }
};
