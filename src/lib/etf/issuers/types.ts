import type { ExposureSource } from "@prisma/client";
import type { IsharesExposurePayload } from "@/lib/ishares/types";

export type IssuerKey = "ISHARES" | "VANGUARD" | "SPDR" | "COMGEST" | "VANECK";

export type ResolvedIssuerFund = {
  issuer: IssuerKey;
  isin: string;
  locale: string | null;
  productUrl: string;
  factsheetUrl?: string | null;
  dataUrl?: string | null;
  productId?: string | null;
  pageHtml?: string | null;
  resolvedFrom?: "CACHE" | "FACTSHEET_LIST" | "URL_PATTERN";
  localeBaseUsed?: string | null;
};

export type ExposureResult = {
  asOfDate: Date | null;
  payload: IsharesExposurePayload;
  sourceMeta: Record<string, unknown>;
};

export type AdapterInstrumentHints = {
  instrumentId: string;
  isin: string;
  name: string;
  displayName: string | null;
  issuer: string | null;
  securityType: string | null;
  securityType2: string | null;
  marketSector: string | null;
  trackedIndexName: string | null;
  tickerHint: string | null;
  cachedProductUrl: string | null;
};

export interface IssuerExposureAdapter {
  issuer: IssuerKey;
  source: ExposureSource;
  canHandleInstrument(hints: AdapterInstrumentHints): boolean;
  resolveByIsin(isin: string, hints: AdapterInstrumentHints): Promise<ResolvedIssuerFund | null>;
  fetchExposure(resolved: ResolvedIssuerFund, hints: AdapterInstrumentHints): Promise<ExposureResult>;
}
