import { AssetClass, AssetType, Instrument, Region } from "@prisma/client";

type ProfilePatch = {
  assetType: AssetType;
  assetClass: AssetClass;
  region: Region;
  trackedIndexName: string | null;
  fxHedged: boolean | null;
  sector: string | null;
  industry: string | null;
  issuer: string | null;
  countryOfRisk: string | null;
  confidence: number;
};

type RuleResult = {
  profilePatch: ProfilePatch;
  debugReasons: string[];
};

// Ordered index keyword rules. First match wins and sets region/confidence.
const INDEX_RULES: Array<{
  pattern: RegExp;
  indexName: string;
  region: Region;
  confidence: number;
}> = [
  { pattern: /\bMSCI WORLD\b/i, indexName: "MSCI World", region: Region.GLOBAL, confidence: 0.9 },
  { pattern: /\bFTSE ALL[-\s]?WORLD\b/i, indexName: "FTSE All-World", region: Region.GLOBAL, confidence: 0.9 },
  { pattern: /\bS&P 500\b/i, indexName: "S&P 500", region: Region.US, confidence: 0.9 },
  { pattern: /\bNASDAQ[-\s]?100\b/i, indexName: "NASDAQ-100", region: Region.US, confidence: 0.9 },
  { pattern: /\bMSCI EM\b/i, indexName: "MSCI Emerging Markets", region: Region.EM, confidence: 0.9 },
  { pattern: /\bEMERGING MARKETS\b/i, indexName: "Emerging Markets", region: Region.EM, confidence: 0.8 },
  { pattern: /\bSTOXX EUROPE 600\b/i, indexName: "STOXX Europe 600", region: Region.EU, confidence: 0.9 },
  { pattern: /\bMSCI EUROPE\b/i, indexName: "MSCI Europe", region: Region.EU, confidence: 0.9 },
  { pattern: /\bMSCI ACWI\b/i, indexName: "MSCI ACWI", region: Region.GLOBAL, confidence: 0.85 }
];

// Keyword heuristics for asset type/class detection.
const BOND_KEYWORDS = /\b(BOND|TREASURY|GOVT|GOVERNMENT|AGGREGATE|CORP|CORPORATE|FIXED INCOME)\b/i;
const COMMODITY_KEYWORDS = /\b(GOLD|COMMODITY|OIL|SILVER|ENERGY|METAL)\b/i;
const ETF_KEYWORDS = /\b(ETF|UCITS ETF)\b/i;
const HEDGED_KEYWORDS = /\bHEDGED\b/i;

function normalize(value: string | null | undefined) {
  return String(value || "").toUpperCase();
}

function deriveAssetType(securityType2: string, name: string, reasons: string[]) {
  if (ETF_KEYWORDS.test(name) || securityType2.includes("ETF")) {
    reasons.push("assetType=ETF (securityType2/name)");
    return AssetType.ETF;
  }
  if (securityType2.includes("BOND") || BOND_KEYWORDS.test(name)) {
    reasons.push("assetType=BOND (securityType2/name)");
    return AssetType.BOND;
  }
  if (securityType2.includes("FUND")) {
    reasons.push("assetType=FUND (securityType2)");
    return AssetType.FUND;
  }
  if (securityType2.includes("COMMON STOCK") || securityType2.includes("EQUITY")) {
    reasons.push("assetType=STOCK (securityType2)");
    return AssetType.STOCK;
  }

  reasons.push("assetType=OTHER (default)");
  return AssetType.OTHER;
}

function deriveAssetClass(name: string, securityType2: string, reasons: string[]) {
  if (BOND_KEYWORDS.test(name) || securityType2.includes("BOND")) {
    reasons.push("assetClass=BOND (keyword/securityType2)");
    return AssetClass.BOND;
  }
  if (COMMODITY_KEYWORDS.test(name)) {
    reasons.push("assetClass=COMMODITY (keyword)");
    return AssetClass.COMMODITY;
  }
  if (INDEX_RULES.some((rule) => rule.pattern.test(name))) {
    reasons.push("assetClass=EQUITY (index keyword)");
    return AssetClass.EQUITY;
  }
  if (securityType2.includes("ETF") || securityType2.includes("EQUITY")) {
    reasons.push("assetClass=EQUITY (securityType2)");
    return AssetClass.EQUITY;
  }

  reasons.push("assetClass=OTHER (default)");
  return AssetClass.OTHER;
}

function deriveRegion(name: string, reasons: string[]) {
  if (/\bEUROPE\b/i.test(name)) {
    reasons.push("region=EU (keyword)");
    return Region.EU;
  }
  if (/\bUNITED STATES\b|\bU\.S\.\b|\bUSA\b/i.test(name)) {
    reasons.push("region=US (keyword)");
    return Region.US;
  }
  if (/\bUNITED KINGDOM\b|\bUK\b/i.test(name)) {
    reasons.push("region=UK (keyword)");
    return Region.UK;
  }
  if (/\bJAPAN\b|\bASIA PACIFIC\b/i.test(name)) {
    reasons.push("region=APAC (keyword)");
    return Region.APAC;
  }
  if (/\bCHINA\b/i.test(name)) {
    reasons.push("region=COUNTRY_SPECIFIC (keyword)");
    return Region.COUNTRY_SPECIFIC;
  }
  if (/\bEMERGING MARKETS\b|\bEM\b/i.test(name)) {
    reasons.push("region=EM (keyword)");
    return Region.EM;
  }
  if (/\bGLOBAL\b|\bWORLD\b/i.test(name)) {
    reasons.push("region=GLOBAL (keyword)");
    return Region.GLOBAL;
  }

  reasons.push("region=UNKNOWN (default)");
  return Region.UNKNOWN;
}

export function buildInstrumentProfileFromRules(instrument: Instrument): RuleResult {
  const displayName = instrument.displayName || instrument.name || "";
  const normalizedName = displayName.toUpperCase();
  const securityType2 = normalize(instrument.securityType2);
  const reasons: string[] = [];

  // Start with a base confidence and increase when rules are more specific.
  let confidence = 0.5;
  let trackedIndexName: string | null = null;
  let region: Region = Region.UNKNOWN;

  for (const rule of INDEX_RULES) {
    if (rule.pattern.test(displayName)) {
      trackedIndexName = rule.indexName;
      region = rule.region;
      confidence = Math.max(confidence, rule.confidence);
      reasons.push(`trackedIndex=${rule.indexName}`);
      reasons.push(`region=${rule.region} (index)`);
      break;
    }
  }

  if (!trackedIndexName) {
    region = deriveRegion(normalizedName, reasons);
    if (region !== Region.UNKNOWN) confidence = Math.max(confidence, 0.7);
  }

  const assetType = deriveAssetType(securityType2, normalizedName, reasons);
  const assetClass = deriveAssetClass(normalizedName, securityType2, reasons);

  if (assetType === AssetType.ETF) confidence = Math.max(confidence, 0.8);

  const fxHedged = HEDGED_KEYWORDS.test(normalizedName) ? true : null;
  if (fxHedged) {
    reasons.push("fxHedged=true (keyword)");
    confidence = Math.max(confidence, 0.8);
  }

  const sector = instrument.marketSector ? instrument.marketSector : null;
  if (sector) reasons.push("sector=marketSector (OpenFIGI)");

  return {
    profilePatch: {
      assetType,
      assetClass,
      region,
      trackedIndexName,
      fxHedged,
      sector,
      industry: null,
      issuer: instrument.issuer || null,
      countryOfRisk: instrument.countryOfRisk || null,
      confidence
    },
    debugReasons: reasons
  };
}
