export type CountryKey = string;

export type SectorKey =
  | "COMMUNICATION_SERVICES"
  | "CONSUMER_DISCRETIONARY"
  | "CONSUMER_STAPLES"
  | "ENERGY"
  | "FINANCIALS"
  | "HEALTH_CARE"
  | "INDUSTRIALS"
  | "INFORMATION_TECHNOLOGY"
  | "MATERIALS"
  | "REAL_ESTATE"
  | "UTILITIES"
  | "CASH"
  | "OTHER"
  | "UNASSIGNED";

export type RegionKey =
  | "NORTH_AMERICA"
  | "EUROPE"
  | "ASIA"
  | "OCEANIA"
  | "LATIN_AMERICA"
  | "AFRICA"
  | "MIDDLE_EAST"
  | "OTHER"
  | "CASH";

export type DevelopmentKey =
  | "DEVELOPED"
  | "EMERGING"
  | "FRONTIER"
  | "UNKNOWN"
  | "OTHER"
  | "CASH";

export type NormalizedExposureRow<K extends string = string> = {
  key: K;
  weight: number;
};

export type NormalizedExposureMeta = {
  countrySum: number;
  sectorSum: number;
  unmappedCountryLabels: string[];
  unmappedSectorLabels: string[];
  normalizerVersion: string;
  rawCountryLabels: string[];
  rawSectorLabels: string[];
  parseError?: string;
};

export type NormalizedExposurePayload = {
  country: NormalizedExposureRow<CountryKey>[];
  sector: NormalizedExposureRow<SectorKey>[];
  meta: NormalizedExposureMeta;
};
