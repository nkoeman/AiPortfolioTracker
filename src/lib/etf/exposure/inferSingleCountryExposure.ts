import { countryCodeToRegion } from "@/lib/geo/countryToRegion";
import { SINGLE_COUNTRY_INDEX_MAP } from "@/lib/etf/exposure/singleCountryIndexMap";

type InferInput = {
  displayName?: string | null;
  benchmarkName?: string | null;
  indexName?: string | null;
};

export type SingleCountryInference = {
  countryCode: string;
  countryName?: string;
  regionName: "North America" | "Europe" | "Asia Pacific" | "Emerging Markets" | "Global" | "Other";
  countryPct: number;
  regionPct: number;
  source: "INDEX_MAP" | "NAME_HEURISTIC";
  confidence: number;
};

const BROAD_MARKET_PATTERNS = [
  /\bWORLD\b/i,
  /\bGLOBAL\b/i,
  /\bALL[-\s]?WORLD\b/i,
  /\bACWI\b/i,
  /\bEMERGING\b/i,
  /\bEM\b/i,
  /\bDEVELOPED\b/i,
  /\bEUROPE\b/i
];

const COUNTRY_NAME_TOKENS: Array<{ token: RegExp; countryCode: string; countryName: string }> = [
  { token: /\bNETHERLANDS\b|\bDUTCH\b/i, countryCode: "NL", countryName: "Netherlands" },
  { token: /\bGERMANY\b|\bGERMAN\b/i, countryCode: "DE", countryName: "Germany" },
  { token: /\bFRANCE\b|\bFRENCH\b/i, countryCode: "FR", countryName: "France" },
  { token: /\bUNITED STATES\b|\bU\.?S\.?A?\b/i, countryCode: "US", countryName: "United States" },
  { token: /\bJAPAN\b|\bJAPANESE\b/i, countryCode: "JP", countryName: "Japan" },
  { token: /\bUNITED KINGDOM\b|\bUK\b|\bBRITISH\b/i, countryCode: "GB", countryName: "United Kingdom" },
  { token: /\bSWITZERLAND\b|\bSWISS\b/i, countryCode: "CH", countryName: "Switzerland" },
  { token: /\bSPAIN\b|\bSPANISH\b/i, countryCode: "ES", countryName: "Spain" },
  { token: /\bITALY\b|\bITALIAN\b/i, countryCode: "IT", countryName: "Italy" },
  { token: /\bSWEDEN\b|\bSWEDISH\b/i, countryCode: "SE", countryName: "Sweden" }
];

function normalizeText(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase();
}

function isBroadMarketText(text: string) {
  return BROAD_MARKET_PATTERNS.some((pattern) => pattern.test(text));
}

function inferFromIndexMap(texts: string[]): SingleCountryInference | null {
  const hits = new Map<string, { countryName: string }>();
  for (const entry of SINGLE_COUNTRY_INDEX_MAP) {
    const keyword = entry.keyword.toUpperCase();
    const matched = texts.some((text) => text.includes(keyword));
    if (matched) {
      hits.set(entry.countryCode, { countryName: entry.countryName });
    }
  }

  if (hits.size !== 1) return null;
  const [[countryCode, data]] = Array.from(hits.entries());
  return {
    countryCode,
    countryName: data.countryName,
    regionName: countryCodeToRegion(countryCode),
    countryPct: 100,
    regionPct: 100,
    source: "INDEX_MAP",
    confidence: 85
  };
}

function inferFromNameHeuristic(displayName: string): SingleCountryInference | null {
  const hits = new Map<string, { countryName: string }>();
  for (const token of COUNTRY_NAME_TOKENS) {
    if (token.token.test(displayName)) {
      hits.set(token.countryCode, { countryName: token.countryName });
    }
  }

  if (hits.size !== 1) return null;
  const [[countryCode, data]] = Array.from(hits.entries());
  return {
    countryCode,
    countryName: data.countryName,
    regionName: countryCodeToRegion(countryCode),
    countryPct: 100,
    regionPct: 100,
    source: "NAME_HEURISTIC",
    confidence: 70
  };
}

export function inferSingleCountryExposure(input: InferInput): SingleCountryInference | null {
  const displayName = normalizeText(input.displayName);
  const benchmarkName = normalizeText(input.benchmarkName);
  const indexName = normalizeText(input.indexName);
  const allText = [displayName, benchmarkName, indexName].filter((value) => value.length > 0).join(" ");
  if (!allText.length) return null;

  // Guardrail: never infer 100% country for broad/global/regional products.
  if (isBroadMarketText(allText)) return null;

  const fromIndex = inferFromIndexMap([displayName, benchmarkName, indexName].filter(Boolean));
  if (fromIndex) return fromIndex;

  return inferFromNameHeuristic(displayName);
}
