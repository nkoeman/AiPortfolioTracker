import { getFxRateForWeek } from "@/lib/fx/convert";
import { prisma } from "@/lib/prisma";

type ExposureCountry = { country: string; weight: number };
type ExposureSector = { sector: string; weight: number };

export type PortfolioExposureSummary = {
  asOfDate: Date;
  totalValueEur: number;
  coveredValueEur: number;
  coverage: number;
  country: ExposureCountry[];
  sector: ExposureSector[];
  missingInstrumentIds: string[];
};

function toNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value);
}

function isCountryRow(value: unknown): value is ExposureCountry {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.country === "string" && Number.isFinite(Number(row.weight));
}

function isSectorRow(value: unknown): value is ExposureSector {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.sector === "string" && Number.isFinite(Number(row.weight));
}

function parsePayload(payload: unknown) {
  const value = (payload || {}) as Record<string, unknown>;
  const country = Array.isArray(value.country) ? value.country.filter(isCountryRow) : [];
  const sector = Array.isArray(value.sector) ? value.sector.filter(isSectorRow) : [];
  return { country, sector };
}

function sortRows<T extends { weight: number }>(rows: T[]): T[] {
  return rows.sort((a, b) => b.weight - a.weight);
}

function mapToSortedArray(map: Map<string, number>) {
  return Array.from(map.entries())
    .map(([key, weight]) => ({ key, weight }))
    .filter((row) => row.weight > 0)
    .sort((a, b) => b.weight - a.weight);
}

export async function getPortfolioExposureSummary(
  userId: string,
  options: { asOfDate?: Date } = {}
): Promise<PortfolioExposureSummary> {
  const asOfDate = options.asOfDate ?? new Date();
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: "TRADE",
      listingId: { not: null },
      tradeAt: { lte: asOfDate }
    },
    select: {
      listingId: true,
      quantity: true
    },
    orderBy: { tradeAt: "asc" }
  });

  const holdings = new Map<string, number>();
  for (const tx of transactions) {
    if (!tx.listingId) continue;
    holdings.set(tx.listingId, (holdings.get(tx.listingId) || 0) + toNumber(tx.quantity));
  }

  const openHoldings = Array.from(holdings.entries()).filter(([, qty]) => qty > 0);
  if (!openHoldings.length) {
    return {
      asOfDate,
      totalValueEur: 0,
      coveredValueEur: 0,
      coverage: 0,
      country: [],
      sector: [],
      missingInstrumentIds: []
    };
  }

  const listingIds = openHoldings.map(([listingId]) => listingId);
  const listings = await prisma.instrumentListing.findMany({
    where: { id: { in: listingIds } },
    select: {
      id: true,
      currency: true,
      instrument: {
        select: {
          id: true,
          exposureSnapshots: {
            where: { status: "READY" },
            orderBy: { fetchedAt: "desc" },
            take: 1,
            select: { payload: true }
          }
        }
      }
    }
  });

  const latestPrices = await prisma.dailyListingPrice.findMany({
    where: {
      listingId: { in: listingIds },
      date: { lte: asOfDate }
    },
    orderBy: [{ listingId: "asc" }, { date: "desc" }],
    select: {
      listingId: true,
      date: true,
      close: true,
      adjustedClose: true,
      currency: true
    }
  });

  const latestPriceByListing = new Map<string, typeof latestPrices[number]>();
  for (const row of latestPrices) {
    if (!latestPriceByListing.has(row.listingId)) {
      latestPriceByListing.set(row.listingId, row);
    }
  }

  const listingById = new Map(listings.map((listing) => [listing.id, listing]));
  const country = new Map<string, number>();
  const sector = new Map<string, number>();

  let totalValueEur = 0;
  let coveredValueEur = 0;
  const missingInstrumentIds = new Set<string>();

  for (const [listingId, qty] of openHoldings) {
    const listing = listingById.get(listingId);
    const price = latestPriceByListing.get(listingId);
    if (!listing || !price) continue;

    const priceValue = price.close !== null ? toNumber(price.close) : toNumber(price.adjustedClose);
    if (!Number.isFinite(priceValue) || priceValue <= 0) continue;

    const quoteCurrency = String(price.currency || listing.currency || "EUR").toUpperCase();
    let fxToEur = 1;
    try {
      fxToEur = await getFxRateForWeek(price.date, quoteCurrency);
    } catch {
      continue;
    }

    const positionValueEur = qty * priceValue * fxToEur;
    if (!Number.isFinite(positionValueEur) || positionValueEur <= 0) continue;
    totalValueEur += positionValueEur;

    const snapshot = listing.instrument.exposureSnapshots[0];
    if (!snapshot?.payload) {
      missingInstrumentIds.add(listing.instrument.id);
      continue;
    }

    coveredValueEur += positionValueEur;
    const payload = parsePayload(snapshot.payload);

    for (const row of payload.country) {
      country.set(row.country, (country.get(row.country) || 0) + positionValueEur * row.weight);
    }
    for (const row of payload.sector) {
      sector.set(row.sector, (sector.get(row.sector) || 0) + positionValueEur * row.weight);
    }
  }

  if (totalValueEur <= 0) {
    return {
      asOfDate,
      totalValueEur: 0,
      coveredValueEur: 0,
      coverage: 0,
      country: [],
      sector: [],
      missingInstrumentIds: Array.from(missingInstrumentIds)
    };
  }

  const countryRows = sortRows(
    mapToSortedArray(country).map((row) => ({ country: row.key, weight: row.weight / totalValueEur }))
  );
  const sectorRows = sortRows(
    mapToSortedArray(sector).map((row) => ({ sector: row.key, weight: row.weight / totalValueEur }))
  );

  return {
    asOfDate,
    totalValueEur,
    coveredValueEur,
    coverage: coveredValueEur / totalValueEur,
    country: countryRows,
    sector: sectorRows,
    missingInstrumentIds: Array.from(missingInstrumentIds)
  };
}
