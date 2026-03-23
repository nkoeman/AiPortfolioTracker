import { getFxRateForWeek } from "@/lib/fx/convert";
import { prisma } from "@/lib/prisma";
import {
  DEVELOPMENT_MAP_VERSION,
  NORMALIZER_VERSION,
  REGION_MAP_VERSION,
  countryToDevelopment,
  countryToRegion,
  normalizeExposurePayload,
  normalizeExposureSnapshot
} from "@/lib/exposure/normalize";
import type {
  DevelopmentKey,
  NormalizedExposurePayload,
  NormalizedExposureRow,
  RegionKey,
  SectorKey
} from "@/lib/exposure/normalize";

type PortfolioExposureChartKey = "region" | "development" | "country" | "sector";

type PortfolioExposureSlice = {
  key: string;
  label: string;
  value: number;
};

type PortfolioExposureChartMeta = {
  coverage: number;
  noData: number;
};

type PortfolioExposureResponse = {
  asOfDate: string;
  coverage: number;
  charts: Record<PortfolioExposureChartKey, PortfolioExposureSlice[]>;
  chartMeta: Record<PortfolioExposureChartKey, PortfolioExposureChartMeta>;
  meta: {
    normalizerVersion: string;
    regionMapVersion: string;
    developmentMapVersion: string;
    snapshotsUsed: number;
    missingExposureInstruments: number;
    countryCoverage: number;
    sectorCoverage: number;
  };
};

type HoldingPosition = {
  instrumentId: string;
  portfolioWeight: number;
  countryRows: NormalizedExposureRow[];
  sectorRows: NormalizedExposureRow<SectorKey>[];
};

const CHART_MAX_SLICES = 8;

const REGION_LABELS: Record<RegionKey, string> = {
  NORTH_AMERICA: "North America",
  EUROPE: "Europe",
  ASIA: "Asia",
  OCEANIA: "Oceania",
  LATIN_AMERICA: "Latin America",
  AFRICA: "Africa",
  MIDDLE_EAST: "Middle East",
  OTHER: "Other",
  CASH: "Cash"
};

const DEVELOPMENT_LABELS: Record<DevelopmentKey, string> = {
  DEVELOPED: "Developed",
  EMERGING: "Emerging",
  FRONTIER: "Frontier",
  UNKNOWN: "Unknown",
  OTHER: "Other",
  CASH: "Cash"
};

const SECTOR_LABELS: Record<SectorKey, string> = {
  COMMUNICATION_SERVICES: "Communication Services",
  CONSUMER_DISCRETIONARY: "Consumer Discretionary",
  CONSUMER_STAPLES: "Consumer Staples",
  ENERGY: "Energy",
  FINANCIALS: "Financials",
  HEALTH_CARE: "Health Care",
  INDUSTRIALS: "Industrials",
  INFORMATION_TECHNOLOGY: "Information Technology",
  MATERIALS: "Materials",
  REAL_ESTATE: "Real Estate",
  UTILITIES: "Utilities",
  CASH: "Cash",
  OTHER: "Other",
  UNASSIGNED: "Unassigned"
};

function roundValue(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(8));
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object" && "toString" in value) {
    return Number(String(value));
  }
  return Number.NaN;
}

function isNormalizedRow(value: unknown): value is NormalizedExposureRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.key === "string" && Number.isFinite(Number(row.weight));
}

function parseNormalizedPayload(payload: unknown): NormalizedExposurePayload | null {
  if (!payload || typeof payload !== "object") return null;
  const value = payload as Record<string, unknown>;
  const country = Array.isArray(value.country) ? value.country.filter(isNormalizedRow) : [];
  const sector = Array.isArray(value.sector) ? value.sector.filter(isNormalizedRow) : [];
  if (!country.length && !sector.length) return null;

  return {
    country: country.map((row) => ({ key: row.key, weight: roundValue(Number(row.weight)) })),
    sector: sector.map((row) => ({ key: row.key as SectorKey, weight: roundValue(Number(row.weight)) })),
    meta: (value.meta as NormalizedExposurePayload["meta"]) || {
      countrySum: roundValue(country.reduce((total, row) => total + Number(row.weight), 0)),
      sectorSum: roundValue(sector.reduce((total, row) => total + Number(row.weight), 0)),
      unmappedCountryLabels: [],
      unmappedSectorLabels: [],
      normalizerVersion: NORMALIZER_VERSION,
      rawCountryLabels: [],
      rawSectorLabels: []
    }
  };
}

function scaleRowsToUnit<K extends string>(rows: NormalizedExposureRow<K>[]) {
  const cleanRows = rows.filter((row) => row.weight > 0);
  const total = cleanRows.reduce((sum, row) => sum + row.weight, 0);
  if (!cleanRows.length || total <= 0) return [] as NormalizedExposureRow<K>[];
  if (total <= 1) return cleanRows.map((row) => ({ key: row.key, weight: roundValue(row.weight) }));
  return cleanRows.map((row) => ({ key: row.key, weight: roundValue(row.weight / total) }));
}

function sumMap(map: Map<string, number>) {
  let total = 0;
  for (const value of map.values()) total += value;
  return roundValue(total);
}

function addToMap(map: Map<string, number>, key: string, value: number) {
  if (!Number.isFinite(value) || value <= 0) return;
  map.set(key, roundValue((map.get(key) || 0) + value));
}

function toSlices(
  map: Map<string, number>,
  options: {
    labelForKey: (key: string) => string;
    noData: number;
  }
): PortfolioExposureSlice[] {
  const rows = Array.from(map.entries())
    .map(([key, value]) => ({ key, label: options.labelForKey(key), value: roundValue(value) }))
    .filter((row) => row.value > 0 && row.key !== "NO_DATA")
    .sort((a, b) => b.value - a.value);

  const explicitOther = rows.find((row) => row.key === "OTHER");
  const nonOtherRows = rows.filter((row) => row.key !== "OTHER");
  const visibleRows = nonOtherRows.slice(0, Math.max(0, CHART_MAX_SLICES - 1));
  const overflowRows = nonOtherRows.slice(visibleRows.length);
  const overflowValue = roundValue(overflowRows.reduce((sum, row) => sum + row.value, 0));
  const mergedOtherValue = roundValue((explicitOther?.value || 0) + overflowValue);
  const slices = [...visibleRows];

  if (mergedOtherValue > 0) {
    slices.push({
      key: "OTHER",
      label: options.labelForKey("OTHER"),
      value: mergedOtherValue
    });
  }

  const noData = roundValue(options.noData);
  if (noData > 0) {
    slices.push({
      key: "NO_DATA",
      label: "No data",
      value: noData
    });
  }

  return slices.sort((a, b) => b.value - a.value);
}

function labelForRegion(key: string) {
  return REGION_LABELS[key as RegionKey] || key;
}

function labelForDevelopment(key: string) {
  return DEVELOPMENT_LABELS[key as DevelopmentKey] || key;
}

function labelForCountry(key: string) {
  if (key === "OTHER") return "Other";
  if (key === "CASH") return "Cash";
  return key;
}

function labelForSector(key: string) {
  return SECTOR_LABELS[key as SectorKey] || key;
}

export function buildPortfolioExposureResponse(
  positions: HoldingPosition[],
  asOfDate: Date
): PortfolioExposureResponse {
  const country = new Map<string, number>();
  const sector = new Map<string, number>();

  let overallCoverage = 0;

  for (const position of positions) {
    const scaledCountry = scaleRowsToUnit(position.countryRows);
    const scaledSector = scaleRowsToUnit(position.sectorRows);

    if (scaledCountry.length || scaledSector.length) {
      overallCoverage += position.portfolioWeight;
    }

    for (const row of scaledCountry) {
      addToMap(country, row.key, position.portfolioWeight * row.weight);
    }

    for (const row of scaledSector) {
      addToMap(sector, row.key, position.portfolioWeight * row.weight);
    }
  }

  const region = new Map<string, number>();
  const development = new Map<string, number>();

  for (const [key, value] of country.entries()) {
    addToMap(region, countryToRegion(key), value);
    addToMap(development, countryToDevelopment(key), value);
  }

  const countryCoverage = Math.min(1, sumMap(country));
  const sectorCoverage = Math.min(1, sumMap(sector));
  const chartMeta: PortfolioExposureResponse["chartMeta"] = {
    region: { coverage: countryCoverage, noData: roundValue(1 - countryCoverage) },
    development: { coverage: countryCoverage, noData: roundValue(1 - countryCoverage) },
    country: { coverage: countryCoverage, noData: roundValue(1 - countryCoverage) },
    sector: { coverage: sectorCoverage, noData: roundValue(1 - sectorCoverage) }
  };

  return {
    asOfDate: asOfDate.toISOString().slice(0, 10),
    coverage: Math.min(1, roundValue(overallCoverage)),
    charts: {
      region: toSlices(region, { labelForKey: labelForRegion, noData: chartMeta.region.noData }),
      development: toSlices(development, { labelForKey: labelForDevelopment, noData: chartMeta.development.noData }),
      country: toSlices(country, { labelForKey: labelForCountry, noData: chartMeta.country.noData }),
      sector: toSlices(sector, { labelForKey: labelForSector, noData: chartMeta.sector.noData })
    },
    chartMeta,
    meta: {
      normalizerVersion: NORMALIZER_VERSION,
      regionMapVersion: REGION_MAP_VERSION,
      developmentMapVersion: DEVELOPMENT_MAP_VERSION,
      snapshotsUsed: 0,
      missingExposureInstruments: 0,
      countryCoverage,
      sectorCoverage
    }
  };
}

async function resolveNormalizedPayload(snapshot: {
  id: string;
  normalizedPayload: unknown;
  normalizerVersion: string | null;
  payload: unknown;
}) {
  if (snapshot.normalizedPayload && snapshot.normalizerVersion === NORMALIZER_VERSION) {
    return parseNormalizedPayload(snapshot.normalizedPayload);
  }

  if (snapshot.payload === null || snapshot.payload === undefined) {
    return null;
  }

  const inline = normalizeExposurePayload(snapshot.payload).normalizedPayload;
  try {
    await normalizeExposureSnapshot(snapshot.id);
  } catch (error) {
    console.warn("[EXPOSURE][NORMALIZE] inline normalization persist failed", {
      snapshotId: snapshot.id,
      message: error instanceof Error ? error.message : String(error)
    });
  }
  return inline;
}

function chooseSnapshot<T extends { asOfDate: Date | null }>(snapshots: T[], asOfDate: Date) {
  const eligible = snapshots.filter((snapshot) => !snapshot.asOfDate || snapshot.asOfDate.getTime() <= asOfDate.getTime());
  return eligible[0] || snapshots[0] || null;
}

export async function getPortfolioExposure(
  userId: string,
  asOfDate = new Date()
): Promise<PortfolioExposureResponse> {
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: "TRADE",
      tradeAt: { lte: asOfDate }
    },
    include: {
      instrument: {
        select: {
          id: true,
          listings: {
            select: {
              id: true,
              eodhdCode: true,
              isPrimary: true,
              mappingStatus: true
            }
          }
        }
      }
    },
    orderBy: { tradeAt: "asc" }
  });

  if (!transactions.length) {
    return buildPortfolioExposureResponse([], asOfDate);
  }

  const byInstrument = new Map<
    string,
    {
      instrumentId: string;
      quantity: number;
      fallbackListingId: string | null;
      listings: Array<{ id: string; eodhdCode: string | null; isPrimary: boolean; mappingStatus: string }>;
    }
  >();

  for (const tx of transactions) {
    const entry = byInstrument.get(tx.instrumentId) || {
      instrumentId: tx.instrumentId,
      quantity: 0,
      fallbackListingId: tx.listingId,
      listings: tx.instrument.listings
    };
    entry.quantity += toNumber(tx.quantity);
    if (!entry.fallbackListingId && tx.listingId) entry.fallbackListingId = tx.listingId;
    byInstrument.set(tx.instrumentId, entry);
  }

  const chosenListingByInstrument = new Map<string, string>();
  const chosenListingIds = new Set<string>();

  for (const entry of byInstrument.values()) {
    if (entry.quantity <= 0) continue;
    const primaryMapped = entry.listings.find((listing) => listing.isPrimary && listing.mappingStatus === "MAPPED" && listing.eodhdCode);
    const fallback = entry.listings.find((listing) => listing.id === entry.fallbackListingId && listing.eodhdCode);
    const anyMapped = entry.listings.find((listing) => listing.mappingStatus === "MAPPED" && listing.eodhdCode);
    const chosen = primaryMapped || fallback || anyMapped || null;
    if (!chosen) continue;
    chosenListingByInstrument.set(entry.instrumentId, chosen.id);
    chosenListingIds.add(chosen.id);
  }

  if (!chosenListingIds.size) {
    return buildPortfolioExposureResponse([], asOfDate);
  }

  const [prices, snapshots] = await Promise.all([
    prisma.dailyListingPrice.findMany({
      where: {
        listingId: { in: Array.from(chosenListingIds) },
        date: { lte: asOfDate }
      },
      orderBy: [{ listingId: "asc" }, { date: "desc" }],
      select: {
        listingId: true,
        date: true,
        adjustedClose: true,
        currency: true
      }
    }),
    prisma.instrumentExposureSnapshot.findMany({
      where: {
        instrumentId: { in: Array.from(byInstrument.keys()) },
        status: "READY"
      },
      orderBy: [{ asOfDate: "desc" }, { fetchedAt: "desc" }],
      select: {
        id: true,
        instrumentId: true,
        asOfDate: true,
        payload: true,
        normalizedPayload: true,
        normalizerVersion: true
      }
    })
  ]);

  const latestPriceByListing = new Map<string, typeof prices[number]>();
  for (const price of prices) {
    if (!latestPriceByListing.has(price.listingId)) {
      latestPriceByListing.set(price.listingId, price);
    }
  }

  const snapshotsByInstrument = new Map<string, typeof snapshots>();
  for (const snapshot of snapshots) {
    const rows = snapshotsByInstrument.get(snapshot.instrumentId) || [];
    rows.push(snapshot);
    snapshotsByInstrument.set(snapshot.instrumentId, rows);
  }

  const rawPositions: Array<{
    instrumentId: string;
    valueEur: number;
    payload: NormalizedExposurePayload | null;
  }> = [];

  let totalValueEur = 0;
  let snapshotsUsed = 0;
  let missingExposureInstruments = 0;

  for (const entry of byInstrument.values()) {
    if (entry.quantity <= 0) continue;
    const listingId = chosenListingByInstrument.get(entry.instrumentId);
    if (!listingId) continue;

    const price = latestPriceByListing.get(listingId);
    if (!price) continue;

    const adjustedClose = toNumber(price.adjustedClose);
    if (!Number.isFinite(adjustedClose) || adjustedClose <= 0) continue;

    let fxToEur = 1;
    try {
      fxToEur = await getFxRateForWeek(price.date, String(price.currency || "EUR"));
    } catch (error) {
      console.warn("[EXPOSURE][PORTFOLIO] skipping instrument due to missing FX", {
        userId,
        instrumentId: entry.instrumentId,
        listingId,
        currency: price.currency || "EUR",
        message: error instanceof Error ? error.message : String(error)
      });
      continue;
    }

    const valueEur = roundValue(entry.quantity * adjustedClose * fxToEur);
    if (!Number.isFinite(valueEur) || valueEur <= 0) continue;

    totalValueEur += valueEur;
    const snapshot = chooseSnapshot(snapshotsByInstrument.get(entry.instrumentId) || [], asOfDate);
    const payload = snapshot ? await resolveNormalizedPayload(snapshot) : null;
    const hasExposure = Boolean(payload?.country.length || payload?.sector.length);

    if (hasExposure) {
      snapshotsUsed += 1;
    } else {
      missingExposureInstruments += 1;
    }

    rawPositions.push({
      instrumentId: entry.instrumentId,
      valueEur,
      payload
    });
  }

  if (totalValueEur <= 0 || !rawPositions.length) {
    return buildPortfolioExposureResponse([], asOfDate);
  }

  const positions: HoldingPosition[] = rawPositions.map((position) => ({
    instrumentId: position.instrumentId,
    portfolioWeight: roundValue(position.valueEur / totalValueEur),
    countryRows: position.payload?.country || [],
    sectorRows: position.payload?.sector || []
  }));

  const response = buildPortfolioExposureResponse(positions, asOfDate);
  response.meta.snapshotsUsed = snapshotsUsed;
  response.meta.missingExposureInstruments = missingExposureInstruments;

  console.info("[EXPOSURE][PORTFOLIO]", {
    userId,
    asOfDate: response.asOfDate,
    positions: positions.length,
    snapshotsUsed,
    missingExposureInstruments,
    coverage: response.coverage,
    countryCoverage: response.meta.countryCoverage,
    sectorCoverage: response.meta.sectorCoverage
  });

  return response;
}

export type { PortfolioExposureChartKey, PortfolioExposureResponse, PortfolioExposureSlice };
