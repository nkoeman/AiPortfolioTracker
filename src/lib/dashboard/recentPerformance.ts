import { startOfDay, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getFxRateForWeek } from "@/lib/fx/convert";
import { getWeeklySeriesFromDaily } from "@/lib/valuation/portfolioSeries";

export type RecentPerformancePoint = {
  weekEndDate: Date;
  valueEur: number;
};

export type RecentPerformanceContributor = {
  instrumentId: string;
  isin: string;
  instrumentName: string;
  contributionEur: number;
  contributionPctOfMove: number | null;
  localReturnPct: number | null;
};

export type RecentPerformanceResult = {
  window: {
    startWeekEndDate: Date | null;
    endWeekEndDate: Date | null;
    weeksCount: number;
    points: RecentPerformancePoint[];
  };
  portfolio: {
    startValueEur: number | null;
    endValueEur: number | null;
    changeEur: number | null;
    changePct: number | null;
    netFlowEur: number | null;
    valueGainedEur: number | null;
    valueGainedPct: number | null;
  };
  contributors: {
    topGainers: RecentPerformanceContributor[];
    topLosers: RecentPerformanceContributor[];
  };
  notes: string[];
  approximationNote: string | null;
};

type ListingLite = {
  id: string;
  isPrimary: boolean;
  mappingStatus: string;
  eodhdCode: string | null;
  currency: string | null;
};

type InstrumentLite = {
  id: string;
  isin: string;
  name: string;
  displayName: string | null;
  listings: ListingLite[];
};

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value);
}

export function selectRecentWeeks(weeks: RecentPerformancePoint[], windowSize = 4) {
  if (!weeks.length) return [];
  const sorted = [...weeks].sort((a, b) => a.weekEndDate.getTime() - b.weekEndDate.getTime());
  return sorted.slice(-windowSize);
}

export function computeWindowChange(weeks: RecentPerformancePoint[]) {
  if (weeks.length === 0) {
    return { startValueEur: null, endValueEur: null, changeEur: null, changePct: null };
  }
  if (weeks.length === 1) {
    const value = toNumber(weeks[0].valueEur);
    if (!Number.isFinite(value)) {
      return { startValueEur: null, endValueEur: null, changeEur: null, changePct: null };
    }
    return { startValueEur: value, endValueEur: value, changeEur: 0, changePct: null };
  }
  const startValueEur = toNumber(weeks[0].valueEur);
  const endValueEur = toNumber(weeks[weeks.length - 1].valueEur);
  if (!Number.isFinite(startValueEur) || !Number.isFinite(endValueEur)) {
    return { startValueEur: null, endValueEur: null, changeEur: null, changePct: null };
  }
  const changeEur = endValueEur - startValueEur;
  const changePct = startValueEur === 0 ? null : changeEur / startValueEur;
  return { startValueEur, endValueEur, changeEur, changePct };
}

export function rankContributors(rows: RecentPerformanceContributor[]) {
  const topGainers = rows
    .filter((row) => row.contributionEur > 0)
    .sort((a, b) => b.contributionEur - a.contributionEur)
    .slice(0, 5);
  const topLosers = rows
    .filter((row) => row.contributionEur < 0)
    .sort((a, b) => a.contributionEur - b.contributionEur)
    .slice(0, 5);
  return { topGainers, topLosers };
}

function pickListing(listings: ListingLite[], fallbackListingId: string | null) {
  const primaryMapped = listings.find((listing) =>
    listing.isPrimary && listing.mappingStatus === "MAPPED" && listing.eodhdCode
  );
  const fallback = fallbackListingId
    ? listings.find((listing) => listing.id === fallbackListingId && listing.eodhdCode)
    : null;
  const anyMapped = listings.find((listing) => listing.mappingStatus === "MAPPED" && listing.eodhdCode);
  return primaryMapped || fallback || anyMapped || null;
}

export async function getRecentPerformance(userId: string, windowWeeks = 4): Promise<RecentPerformanceResult> {
  const windowDays = Math.max(1, windowWeeks * 7 + 7);
  const today = startOfDay(new Date());
  const windowStartDate = subDays(today, windowDays - 1);

  const dailyValues = await prisma.dailyPortfolioValue.findMany({
    where: {
      userId,
      date: {
        gte: windowStartDate,
        lte: today
      }
    },
    orderBy: { date: "asc" }
  });

  const weeklySeries = getWeeklySeriesFromDaily(
    dailyValues.map((row) => ({
      date: row.date,
      valueEur: toNumber(row.valueEur),
      partialValuation: row.partialValuation,
      cumulativeReturnPct: row.cumulativeReturnPct === null ? null : Number(row.cumulativeReturnPct)
    }))
  );

  const points = selectRecentWeeks(
    weeklySeries.map((row) => ({
      weekEndDate: row.weekEndDate,
      valueEur: row.valueEur
    })),
    windowWeeks
  );
  const notes: string[] = [];

  if (points.length > 0 && points.length < windowWeeks) {
    const label = points.length === 1 ? "week" : "weeks";
    notes.push(`Only ${points.length} ${label} of history are available right now.`);
  }

  const { startValueEur, endValueEur, changeEur, changePct } = computeWindowChange(points);
  const windowStart = points[0]?.weekEndDate ?? null;
  const windowEnd = points.length ? points[points.length - 1].weekEndDate : null;
  let netFlowEur: number | null = null;
  let valueGainedEur: number | null = changeEur;
  let valueGainedPct: number | null = changePct;

  let contributors: RecentPerformanceContributor[] = [];
  let approximationNote: string | null = null;

  if (points.length >= 2 && windowStart && windowEnd) {

    const transactions = await prisma.transaction.findMany({
      where: { userId, tradeAt: { lte: windowEnd } },
      include: {
        instrument: {
          include: {
            listings: true
          }
        }
      },
      orderBy: { tradeAt: "asc" }
    });

    const flowTransactions = transactions.filter(
      (tx) => tx.tradeAt.getTime() > windowStart.getTime() && tx.tradeAt.getTime() <= windowEnd.getTime()
    );
    if (flowTransactions.length) {
      const flowSum = flowTransactions.reduce((total, tx) => {
        const raw = tx.valueEur ?? tx.totalEur;
        if (raw === null || raw === undefined) return total;
        const absValue = Math.abs(toNumber(raw));
        if (!Number.isFinite(absValue)) return total;
        // Treat buys as cash outflows and sells as inflows.
        const qty = toNumber(tx.quantity);
        if (qty > 0) return total + absValue;
        if (qty < 0) return total - absValue;
        return total;
      }, 0);
      netFlowEur = Number.isFinite(flowSum) ? flowSum : null;
    } else {
      netFlowEur = 0;
    }

    if (changeEur !== null && netFlowEur !== null) {
      valueGainedEur = changeEur - netFlowEur;
      valueGainedPct = startValueEur === null || startValueEur === 0 ? null : valueGainedEur / startValueEur;
    }

    const byInstrument = new Map<
      string,
      {
        instrument: InstrumentLite;
        qty: number;
        fallbackListingId: string | null;
      }
    >();

    for (const tx of transactions) {
      const entry = byInstrument.get(tx.instrumentId) || {
        instrument: tx.instrument,
        qty: 0,
        fallbackListingId: tx.listingId ?? null
      };
      entry.qty += toNumber(tx.quantity);
      if (!entry.fallbackListingId && tx.listingId) entry.fallbackListingId = tx.listingId;
      byInstrument.set(tx.instrumentId, entry);
    }

    const chosenListingByInstrument = new Map<string, ListingLite>();
    const listingIds = new Set<string>();

    for (const [instrumentId, entry] of byInstrument.entries()) {
      if (!entry.qty) continue;
      const chosen = pickListing(entry.instrument.listings, entry.fallbackListingId);
      if (!chosen) continue;
      chosenListingByInstrument.set(instrumentId, chosen);
      listingIds.add(chosen.id);
    }

    const prices = listingIds.size
      ? await prisma.dailyListingPrice.findMany({
          where: {
            listingId: { in: Array.from(listingIds) },
            date: { gte: windowStart, lte: windowEnd }
          }
        })
      : [];

    const priceMap = new Map<string, { date: string; adjClose: number; currency: string }[]>();
    for (const price of prices) {
      const listingPrices = priceMap.get(price.listingId) || [];
      listingPrices.push({
        date: toIsoDate(price.date),
        adjClose: toNumber(price.adjustedClose),
        currency: price.currency ?? ""
      });
      priceMap.set(price.listingId, listingPrices);
    }

    const fxCache = new Map<string, number>();
    const contributionRows: RecentPerformanceContributor[] = [];

    for (const [instrumentId, entry] of byInstrument.entries()) {
      if (!entry.qty) continue;
      const listing = chosenListingByInstrument.get(instrumentId);
      if (!listing) continue;

      const listingPrices = priceMap.get(listing.id);
      if (!listingPrices || listingPrices.length < 2) continue;
      listingPrices.sort((a, b) => a.date.localeCompare(b.date));
      const startPrice = listingPrices[0];
      const endPrice = listingPrices[listingPrices.length - 1];

      if (!endPrice.currency) continue;
      let fxRate = fxCache.get(endPrice.currency);
      if (!fxRate) {
        try {
          fxRate = await getFxRateForWeek(windowEnd, endPrice.currency);
          fxCache.set(endPrice.currency, fxRate);
        } catch (error) {
          continue;
        }
      }

      // MVP approximation: uses end-of-window quantity and price change only (ignores trade timing in-window).
      // TODO: Replace with time-weighted contributions using holdings at each week end.
      const contributionEur = entry.qty * (endPrice.adjClose - startPrice.adjClose) * fxRate;
      const localReturnPct = startPrice.adjClose === 0 ? null : endPrice.adjClose / startPrice.adjClose - 1;
      const contributionPctOfMove =
        changeEur === null || changeEur === 0 ? null : contributionEur / changeEur;

      contributionRows.push({
        instrumentId,
        isin: entry.instrument.isin,
        instrumentName: entry.instrument.displayName || entry.instrument.name,
        contributionEur,
        contributionPctOfMove,
        localReturnPct
      });
    }

    contributors = contributionRows;
    approximationNote = contributionRows.length
      ? "Contributions approximate the 28-day move using end-of-window quantities and price change (no trade timing)."
      : null;
  }

  const ranked = rankContributors(contributors);

  console.info("[DASH][28D] recent performance computed", {
    userId,
    daysLoaded: points.length,
    windowStart: windowStart ? toIsoDate(windowStart) : null,
    windowEnd: windowEnd ? toIsoDate(windowEnd) : null,
    changeEur,
    changePct,
    contributors: contributors.length,
    topGainers: ranked.topGainers.slice(0, 3).map((row) => ({
      instrumentId: row.instrumentId,
      contributionEur: row.contributionEur
    })),
    topLosers: ranked.topLosers.slice(0, 3).map((row) => ({
      instrumentId: row.instrumentId,
      contributionEur: row.contributionEur
    }))
  });

  return {
    window: {
      startWeekEndDate: windowStart,
      endWeekEndDate: windowEnd,
      weeksCount: points.length,
      points
    },
    portfolio: {
      startValueEur,
      endValueEur,
      changeEur,
      changePct,
      netFlowEur,
      valueGainedEur,
      valueGainedPct
    },
    contributors: {
      topGainers: ranked.topGainers,
      topLosers: ranked.topLosers
    },
    notes,
    approximationNote
  };
}












