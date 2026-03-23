import type {
  CountryKey,
  DevelopmentKey,
  RegionKey,
  SectorKey
} from "@/lib/exposure/normalize/types";

export const NORMALIZER_VERSION = "v1";
export const REGION_MAP_VERSION = "v1";
export const DEVELOPMENT_MAP_VERSION = "v1";

type NormalizedKeyResult<K extends string> = {
  key: K;
  confidence: number;
};

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const COUNTRY_SYNONYMS = new Map<string, string>([
  ["US", "US"],
  ["USA", "US"],
  ["U S", "US"],
  ["U S A", "US"],
  ["UNITED STATES", "US"],
  ["UNITED STATES OF AMERICA", "US"],
  ["AMERICA", "US"],
  ["GB", "GB"],
  ["UK", "GB"],
  ["U K", "GB"],
  ["UNITED KINGDOM", "GB"],
  ["GREAT BRITAIN", "GB"],
  ["BRITAIN", "GB"],
  ["ENGLAND", "GB"],
  ["JP", "JP"],
  ["JAPAN", "JP"],
  ["NL", "NL"],
  ["NETHERLANDS", "NL"],
  ["HOLLAND", "NL"],
  ["DE", "DE"],
  ["GERMANY", "DE"],
  ["FR", "FR"],
  ["FRANCE", "FR"],
  ["CH", "CH"],
  ["SWITZERLAND", "CH"],
  ["SE", "SE"],
  ["SWEDEN", "SE"],
  ["NO", "NO"],
  ["NORWAY", "NO"],
  ["DK", "DK"],
  ["DENMARK", "DK"],
  ["FI", "FI"],
  ["FINLAND", "FI"],
  ["IE", "IE"],
  ["IRELAND", "IE"],
  ["ES", "ES"],
  ["SPAIN", "ES"],
  ["IT", "IT"],
  ["ITALY", "IT"],
  ["PT", "PT"],
  ["PORTUGAL", "PT"],
  ["BE", "BE"],
  ["BELGIUM", "BE"],
  ["AT", "AT"],
  ["AUSTRIA", "AT"],
  ["LU", "LU"],
  ["LUXEMBOURG", "LU"],
  ["CA", "CA"],
  ["CANADA", "CA"],
  ["AU", "AU"],
  ["AUSTRALIA", "AU"],
  ["NZ", "NZ"],
  ["NEW ZEALAND", "NZ"],
  ["CN", "CN"],
  ["CHINA", "CN"],
  ["PRC", "CN"],
  ["PEOPLES REPUBLIC OF CHINA", "CN"],
  ["HK", "HK"],
  ["HONG KONG", "HK"],
  ["TW", "TW"],
  ["TAIWAN", "TW"],
  ["KR", "KR"],
  ["SOUTH KOREA", "KR"],
  ["KOREA SOUTH", "KR"],
  ["PANAMA", "PA"],
  ["PA", "PA"],
  ["IN", "IN"],
  ["INDIA", "IN"],
  ["SG", "SG"],
  ["SINGAPORE", "SG"],
  ["BR", "BR"],
  ["BRAZIL", "BR"],
  ["MX", "MX"],
  ["MEXICO", "MX"],
  ["ZA", "ZA"],
  ["SOUTH AFRICA", "ZA"],
  ["AE", "AE"],
  ["UNITED ARAB EMIRATES", "AE"],
  ["UAE", "AE"],
  ["SA", "SA"],
  ["SAUDI ARABIA", "SA"],
  ["IL", "IL"],
  ["ISRAEL", "IL"],
  ["PL", "PL"],
  ["POLAND", "PL"],
  ["CZ", "CZ"],
  ["CZECH REPUBLIC", "CZ"],
  ["HU", "HU"],
  ["HUNGARY", "HU"],
  ["GR", "GR"],
  ["GREECE", "GR"],
  ["TR", "TR"],
  ["TURKEY", "TR"],
  ["ID", "ID"],
  ["INDONESIA", "ID"],
  ["MY", "MY"],
  ["MALAYSIA", "MY"],
  ["TH", "TH"],
  ["THAILAND", "TH"],
  ["PH", "PH"],
  ["PHILIPPINES", "PH"],
  ["VN", "VN"],
  ["VIETNAM", "VN"],
  ["AR", "AR"],
  ["ARGENTINA", "AR"],
  ["CL", "CL"],
  ["CHILE", "CL"],
  ["CO", "CO"],
  ["COLOMBIA", "CO"],
  ["PE", "PE"],
  ["PERU", "PE"]
]);

const COUNTRY_REGION_MAP = new Map<string, RegionKey>([
  ["US", "NORTH_AMERICA"],
  ["CA", "NORTH_AMERICA"],
  ["MX", "LATIN_AMERICA"],
  ["PA", "LATIN_AMERICA"],
  ["BR", "LATIN_AMERICA"],
  ["AR", "LATIN_AMERICA"],
  ["CL", "LATIN_AMERICA"],
  ["CO", "LATIN_AMERICA"],
  ["PE", "LATIN_AMERICA"],
  ["GB", "EUROPE"],
  ["IE", "EUROPE"],
  ["NL", "EUROPE"],
  ["DE", "EUROPE"],
  ["FR", "EUROPE"],
  ["CH", "EUROPE"],
  ["SE", "EUROPE"],
  ["NO", "EUROPE"],
  ["DK", "EUROPE"],
  ["FI", "EUROPE"],
  ["ES", "EUROPE"],
  ["IT", "EUROPE"],
  ["PT", "EUROPE"],
  ["BE", "EUROPE"],
  ["AT", "EUROPE"],
  ["LU", "EUROPE"],
  ["PL", "EUROPE"],
  ["CZ", "EUROPE"],
  ["HU", "EUROPE"],
  ["GR", "EUROPE"],
  ["RO", "EUROPE"],
  ["JP", "ASIA"],
  ["CN", "ASIA"],
  ["HK", "ASIA"],
  ["TW", "ASIA"],
  ["KR", "ASIA"],
  ["IN", "ASIA"],
  ["SG", "ASIA"],
  ["ID", "ASIA"],
  ["MY", "ASIA"],
  ["TH", "ASIA"],
  ["PH", "ASIA"],
  ["VN", "ASIA"],
  ["TR", "MIDDLE_EAST"],
  ["IL", "MIDDLE_EAST"],
  ["AE", "MIDDLE_EAST"],
  ["SA", "MIDDLE_EAST"],
  ["AU", "OCEANIA"],
  ["NZ", "OCEANIA"],
  ["ZA", "AFRICA"],
  ["KE", "AFRICA"],
  ["NG", "AFRICA"],
  ["MA", "AFRICA"]
]);

const COUNTRY_DEVELOPMENT_MAP = new Map<string, DevelopmentKey>([
  ["US", "DEVELOPED"],
  ["CA", "DEVELOPED"],
  ["GB", "DEVELOPED"],
  ["IE", "DEVELOPED"],
  ["NL", "DEVELOPED"],
  ["DE", "DEVELOPED"],
  ["FR", "DEVELOPED"],
  ["CH", "DEVELOPED"],
  ["SE", "DEVELOPED"],
  ["NO", "DEVELOPED"],
  ["DK", "DEVELOPED"],
  ["FI", "DEVELOPED"],
  ["ES", "DEVELOPED"],
  ["IT", "DEVELOPED"],
  ["PT", "DEVELOPED"],
  ["BE", "DEVELOPED"],
  ["AT", "DEVELOPED"],
  ["LU", "DEVELOPED"],
  ["JP", "DEVELOPED"],
  ["AU", "DEVELOPED"],
  ["NZ", "DEVELOPED"],
  ["SG", "DEVELOPED"],
  ["HK", "DEVELOPED"],
  ["IL", "DEVELOPED"],
  ["KR", "EMERGING"],
  ["TW", "EMERGING"],
  ["CN", "EMERGING"],
  ["IN", "EMERGING"],
  ["BR", "EMERGING"],
  ["MX", "EMERGING"],
  ["ZA", "EMERGING"],
  ["ID", "EMERGING"],
  ["MY", "EMERGING"],
  ["TH", "EMERGING"],
  ["PH", "EMERGING"],
  ["TR", "EMERGING"],
  ["SA", "EMERGING"],
  ["AE", "EMERGING"],
  ["PL", "EMERGING"],
  ["CZ", "EMERGING"],
  ["HU", "EMERGING"],
  ["GR", "EMERGING"],
  ["AR", "EMERGING"],
  ["CL", "EMERGING"],
  ["CO", "EMERGING"],
  ["PE", "EMERGING"],
  ["VN", "FRONTIER"],
  ["KE", "FRONTIER"],
  ["NG", "FRONTIER"],
  ["PK", "FRONTIER"],
  ["RO", "FRONTIER"],
  ["KZ", "FRONTIER"],
  ["MA", "FRONTIER"]
]);

const SECTOR_SYNONYMS = new Map<string, SectorKey>([
  ["BASIC MATERIALS", "MATERIALS"],
  ["MATERIALS", "MATERIALS"],
  ["TECHNOLOGY", "INFORMATION_TECHNOLOGY"],
  ["INFORMATION TECHNOLOGY", "INFORMATION_TECHNOLOGY"],
  ["COMMUNICATION", "COMMUNICATION_SERVICES"],
  ["COMMUNICATION SERVICES", "COMMUNICATION_SERVICES"],
  ["TELECOMMUNICATIONS", "COMMUNICATION_SERVICES"],
  ["CONSUMER DISCRETIONARY", "CONSUMER_DISCRETIONARY"],
  ["CONSUMER STAPLES", "CONSUMER_STAPLES"],
  ["ENERGY", "ENERGY"],
  ["FINANCIALS", "FINANCIALS"],
  ["HEALTH CARE", "HEALTH_CARE"],
  ["INDUSTRIALS", "INDUSTRIALS"],
  ["REAL ESTATE", "REAL_ESTATE"],
  ["UTILITIES", "UTILITIES"],
  ["OTHER", "OTHER"],
  ["UNASSIGNED", "UNASSIGNED"]
]);

export function normalizeCountryLabelToIso2(label: string): NormalizedKeyResult<CountryKey> {
  const normalized = normalizeText(label);
  if (!normalized) return { key: "OTHER", confidence: 0 };
  const hasCash = normalized.includes("CASH");
  const hasOther = normalized.includes("OTHER");
  if (hasOther && hasCash) return { key: "CASH", confidence: 1 };
  if (hasCash) return { key: "CASH", confidence: 1 };
  if (hasOther) return { key: "OTHER", confidence: 1 };

  const direct = COUNTRY_SYNONYMS.get(normalized);
  if (direct) return { key: direct, confidence: 1 };

  if (/^[A-Z]{2}$/.test(normalized)) return { key: normalized, confidence: 0.7 };

  return { key: "OTHER", confidence: 0 };
}

export function normalizeSectorLabelToGics11(label: string): NormalizedKeyResult<SectorKey> {
  const normalized = normalizeText(label);
  if (!normalized) return { key: "OTHER", confidence: 0 };
  if (normalized.includes("OTHER") && normalized.includes("CASH")) return { key: "CASH", confidence: 1 };
  if (normalized.includes("CASH")) return { key: "CASH", confidence: 1 };

  const direct = SECTOR_SYNONYMS.get(normalized);
  if (direct) {
    const confidence = normalized === "COMMUNICATION" ? 0.8 : 1;
    return { key: direct, confidence };
  }

  return { key: "OTHER", confidence: 0 };
}

export function countryToRegion(iso2: string): RegionKey {
  const normalized = normalizeText(iso2);
  if (normalized === "CASH") return "CASH";
  if (normalized === "OTHER") return "OTHER";
  return COUNTRY_REGION_MAP.get(normalized) || "OTHER";
}

export function countryToDevelopment(iso2: string): DevelopmentKey {
  const normalized = normalizeText(iso2);
  if (normalized === "CASH") return "CASH";
  if (normalized === "OTHER") return "OTHER";
  return COUNTRY_DEVELOPMENT_MAP.get(normalized) || "UNKNOWN";
}
