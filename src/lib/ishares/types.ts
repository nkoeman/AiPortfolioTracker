export type ExposureRowCountry = {
  country: string;
  weight: number;
};

export type ExposureRowSector = {
  sector: string;
  weight: number;
};

export type IsharesExposurePayload = {
  country: ExposureRowCountry[];
  sector: ExposureRowSector[];
};

export type IsharesResolution = {
  isin: string;
  locale: string;
  localeSuffix: string;
  productUrl: string;
  productId: string | null;
  ticker: string | null;
  factsheetUrl: string | null;
  pageHtml: string;
};

export type IsharesExposureResult = {
  asOfDate: Date | null;
  payload: IsharesExposurePayload;
  sourceMeta: Record<string, unknown>;
};
