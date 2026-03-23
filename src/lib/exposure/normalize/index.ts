export {
  DEVELOPMENT_MAP_VERSION,
  NORMALIZER_VERSION,
  REGION_MAP_VERSION,
  countryToDevelopment,
  countryToRegion,
  normalizeCountryLabelToIso2,
  normalizeSectorLabelToGics11
} from "@/lib/exposure/normalize/mapping";
export {
  backfillNormalizeExposureSnapshots,
  normalizeExposurePayload,
  normalizeExposureSnapshot
} from "@/lib/exposure/normalize/snapshot";
export type {
  CountryKey,
  DevelopmentKey,
  NormalizedExposureMeta,
  NormalizedExposurePayload,
  NormalizedExposureRow,
  RegionKey,
  SectorKey
} from "@/lib/exposure/normalize/types";
