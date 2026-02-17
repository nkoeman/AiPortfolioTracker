import { ensureEodhdExchangeDirectoryLoaded } from "@/lib/eodhd/exchanges";
import { resolveOrCreateListingForTransaction } from "@/lib/eodhd/mapping";
import { ensureWeeklyFxRates } from "@/lib/fx/sync";
import { refreshDailyPortfolioValuesForUser } from "@/lib/valuation/dailyPortfolioValue";
import { syncDailyPricesForUser } from "@/lib/prices/syncDailyPrices";
import { prisma } from "@/lib/prisma";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_SYNC_DAYS = 35;

function startOfDay(value: Date) {
  return new Date(`${value.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function subtractDays(value: Date, days: number) {
  return new Date(value.getTime() - days * ONE_DAY_MS);
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

type SyncMode = "full" | "recent";

export type SyncPipelineResult = {
  mode: SyncMode;
  fromDate: Date;
  toDate: Date;
  prices: {
    listingCount: number;
    pricePoints: number;
  };
  daily: {
    days: number;
    missingDays: number;
  };
  durationMs: number;
};

type SyncOptions = {
  fromDate: Date;
  toDate: Date;
  mode: SyncMode;
};

async function linkUnmappedTransactionsForUser(userId: string) {
  const unmappedTransactions = await prisma.transaction.findMany({
    where: {
      userId,
      listingId: null
    },
    include: {
      instrument: {
        select: {
          isin: true,
          name: true
        }
      }
    },
    orderBy: { tradeAt: "asc" }
  });
  if (!unmappedTransactions.length) return;

  const attempts = new Map<string, typeof unmappedTransactions[number]>();
  for (const tx of unmappedTransactions) {
    const beursCode = String(tx.exchangeCode || tx.exchange || "UNKNOWN").trim().toUpperCase() || "UNKNOWN";
    const key = `${tx.instrumentId}|${beursCode}|${String(tx.currency || "UNKNOWN").trim().toUpperCase()}`;
    if (!attempts.has(key)) {
      attempts.set(key, tx);
    }
  }

  for (const tx of attempts.values()) {
    const beursCode = String(tx.exchangeCode || tx.exchange || "UNKNOWN").trim().toUpperCase() || "UNKNOWN";
    const listing = await resolveOrCreateListingForTransaction({
      userId,
      isin: tx.instrument.isin,
      productName: tx.instrument.name,
      degiroBeursCode: beursCode,
      transactionCurrency: tx.currency || "UNKNOWN"
    });
    if (!listing) continue;

    await prisma.transaction.updateMany({
      where: {
        userId,
        listingId: null,
        instrumentId: tx.instrumentId,
        exchangeCode: beursCode
      },
      data: { listingId: listing.id }
    });
  }
}

async function runSyncPipeline(userId: string, options: SyncOptions): Promise<SyncPipelineResult> {
  const fromDate = startOfDay(options.fromDate);
  const toDate = startOfDay(options.toDate);
  const startMs = Date.now();

  await ensureEodhdExchangeDirectoryLoaded();
  await linkUnmappedTransactionsForUser(userId);

  const prices = await syncDailyPricesForUser(userId, fromDate, toDate);
  await ensureWeeklyFxRates({ userId, fromDate, toDate });

  const dailySeries = await refreshDailyPortfolioValuesForUser(userId, { fromDate, toDate });
  const daily = {
    days: dailySeries.points.length,
    missingDays: Math.max(0, Math.floor((toDate.getTime() - fromDate.getTime()) / ONE_DAY_MS) + 1 - dailySeries.points.length)
  };

  const result: SyncPipelineResult = {
    mode: options.mode,
    fromDate,
    toDate,
    prices: {
      listingCount: prices.listingCount,
      pricePoints: prices.pricePoints
    },
    daily,
    durationMs: Date.now() - startMs
  };

  console.info("[SYNC][DONE]", {
    userId,
    mode: result.mode,
    from: toIsoDate(result.fromDate),
    to: toIsoDate(result.toDate),
    durationMs: result.durationMs,
    listings: result.prices.listingCount,
    priceUpserts: result.prices.pricePoints,
    dailyDays: result.daily.days
  });

  return result;
}

async function getFullSyncRange(userId: string) {
  const firstTx = await prisma.transaction.findFirst({
    where: { userId },
    orderBy: { tradeAt: "asc" },
    select: { tradeAt: true }
  });
  const toDate = startOfDay(new Date());
  const fromDate = firstTx ? startOfDay(firstTx.tradeAt) : toDate;
  return { fromDate, toDate };
}

export async function syncFullForUser(userId: string): Promise<SyncPipelineResult> {
  const range = await getFullSyncRange(userId);
  return runSyncPipeline(userId, {
    mode: "full",
    fromDate: range.fromDate,
    toDate: range.toDate
  });
}

export async function syncLast4WeeksForUser(userId: string): Promise<SyncPipelineResult> {
  const toDate = startOfDay(new Date());
  const fromDate = startOfDay(subtractDays(toDate, RECENT_SYNC_DAYS));
  return runSyncPipeline(userId, {
    mode: "recent",
    fromDate,
    toDate
  });
}

// Backward-compatible wrapper for legacy callers.
export async function syncPricesForUser(userId: string): Promise<SyncPipelineResult> {
  return syncLast4WeeksForUser(userId);
}
