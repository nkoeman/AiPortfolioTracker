import { inferSingleCountryExposure } from "@/lib/etf/exposure/inferSingleCountryExposure";
import type { ExposureRowCountry, ExposureRowSector, IsharesExposurePayload } from "@/lib/ishares/types";

export type RawExposureRow = {
  name: string;
  weight: number | string;
};

type FinalizeInput = {
  rawCountry?: RawExposureRow[];
  rawSector?: RawExposureRow[];
  asOfDate?: Date | null;
  sourceMeta?: Record<string, unknown>;
  fallbackInput?: {
    displayName?: string | null;
    benchmarkName?: string | null;
    indexName?: string | null;
  };
  instrumentId?: string | null;
};

type FinalizeOutput = {
  asOfDate: Date | null;
  payload: IsharesExposurePayload;
  sourceMeta: Record<string, unknown>;
};

function toWeight(value: number | string): number | null {
  const rawText = typeof value === "string" ? value : null;
  const hasPercentSign = rawText ? rawText.includes("%") : false;
  const raw = typeof value === "number" ? value : Number(String(value).replace(",", ".").replace(/%/g, "").trim());
  if (!Number.isFinite(raw)) return null;
  if (raw <= 0) return null;
  if (hasPercentSign) return raw / 100;
  if (raw > 1.5) return raw / 100;
  return raw;
}

function sumWeights(rows: Array<{ weight: number }>) {
  return rows.reduce((acc, row) => acc + row.weight, 0);
}

function isValidBreakdown(rows: Array<{ weight: number }>) {
  return rows.length > 0 && sumWeights(rows) >= 0.9;
}

function mapCountryRows(rows: RawExposureRow[]): ExposureRowCountry[] {
  const mapped: ExposureRowCountry[] = [];
  for (const row of rows) {
    const country = String(row.name ?? "");
    const weight = toWeight(row.weight);
    if (!country || weight === null) continue;
    mapped.push({ country, weight });
  }
  return mapped;
}

function mapSectorRows(rows: RawExposureRow[]): ExposureRowSector[] {
  const mapped: ExposureRowSector[] = [];
  for (const row of rows) {
    const sector = String(row.name ?? "");
    const weight = toWeight(row.weight);
    if (!sector || weight === null) continue;
    mapped.push({ sector, weight });
  }
  return mapped;
}

export function finalizeExposure(input: FinalizeInput): FinalizeOutput {
  const country = mapCountryRows(input.rawCountry || []);
  const sector = mapSectorRows(input.rawSector || []);
  const instrumentId = input.instrumentId || "unknown";

  const hasValidCountry = isValidBreakdown(country);
  let nextCountry = country;
  let inferenceMeta: Record<string, unknown> = {
    applied: false,
    reason: hasValidCountry ? "COUNTRY_PRESENT" : "NOT_NEEDED"
  };

  if (!hasValidCountry) {
    const inference = inferSingleCountryExposure({
      displayName: input.fallbackInput?.displayName,
      benchmarkName: input.fallbackInput?.benchmarkName,
      indexName: input.fallbackInput?.indexName
    });

    if (inference && inference.confidence >= 70) {
      const inferredCountryLabel = inference.countryName || inference.countryCode;
      nextCountry = [{ country: inferredCountryLabel, weight: 1 }];
      inferenceMeta = {
        applied: true,
        source: inference.source,
        confidence: inference.confidence,
        countryCode: inference.countryCode,
        countryName: inference.countryName || null
      };
      console.info("[ETF][EXPOSURE] country_missing -> inferred_single_country", {
        instrumentId,
        source: inference.source,
        country: inferredCountryLabel
      });
    } else {
      inferenceMeta = {
        applied: false,
        reason: "AMBIGUOUS_OR_LOW_CONFIDENCE"
      };
      console.warn("[ETF][EXPOSURE] country_missing -> inference_skipped ambiguous", {
        instrumentId
      });
    }
  } else {
    console.info("[ETF][EXPOSURE] country_present -> keep extracted country exposure", {
      instrumentId,
      countryRows: nextCountry.length,
      countryTotal: sumWeights(nextCountry)
    });
  }

  const countryTotal = nextCountry.length ? sumWeights(nextCountry) : null;
  const sectorTotal = sector.length ? sumWeights(sector) : null;

  return {
    asOfDate: input.asOfDate || null,
    payload: {
      country: nextCountry,
      sector
    },
    sourceMeta: {
      ...(input.sourceMeta || {}),
      countryTotal,
      sectorTotal,
      countryInference: inferenceMeta,
      countryRegionInference: inferenceMeta,
      partialBreakdown:
        (countryTotal !== null && (countryTotal < 0.98 || countryTotal > 1.02)) ||
        (sectorTotal !== null && (sectorTotal < 0.98 || sectorTotal > 1.02))
    }
  };
}

export const __testables = {
  toWeight,
  mapCountryRows,
  mapSectorRows,
  sumWeights,
  isValidBreakdown
};
