import { eodhdClient } from "@/lib/eodhd/client";
import { prisma } from "@/lib/prisma";

type ListingDailyTarget = {
  id: string;
  eodhdCode: string;
  currency: string | null;
};

const DAILY_TIMEOUT_MS = 15000;
const RATE_LIMIT_MS = 50;

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function toDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, label: string) {
  const delays = [250, 500, 1000];
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === delays.length) break;
      await sleep(delays[attempt]);
      console.warn("[DAILY][PRICES] retrying after error", {
        label,
        attempt: attempt + 1,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
  throw lastError;
}

export async function fetchDailyPricesForListing(
  listing: ListingDailyTarget,
  fromDate: Date,
  toDate: Date
): Promise<number> {
  const from = toIsoDate(fromDate);
  const to = toIsoDate(toDate);

  console.info("[DAILY][PRICES] fetching listingId", {
    listingId: listing.id,
    range: `${from}..${to}`
  });

  const requestStart = Date.now();
  const points = await withRetry(
    () =>
      eodhdClient.getHistoricalAdjustedClose(listing.eodhdCode, from, to, "d", {
        timeoutMs: DAILY_TIMEOUT_MS
      }),
    listing.id
  );
  const requestMs = Date.now() - requestStart;

  if (!points.length) {
    console.info("[DAILY][PRICES] fetched listingId", {
      listingId: listing.id,
      points: 0,
      range: `${from}..${to}`,
      requestMs
    });
    return 0;
  }

  const upsertStart = Date.now();
  await prisma.$transaction(
    points.map((point) => {
      const closeValue = point.close ?? null;
      return prisma.dailyListingPrice.upsert({
        where: {
          listingId_date: {
            listingId: listing.id,
            date: toDateOnly(point.date)
          }
        },
        update: {
          adjustedClose: point.adjClose,
          close: closeValue,
          currency: listing.currency,
          source: "EODHD",
          fetchedAt: new Date()
        },
        create: {
          listingId: listing.id,
          date: toDateOnly(point.date),
          adjustedClose: point.adjClose,
          close: closeValue,
          currency: listing.currency,
          source: "EODHD",
          fetchedAt: new Date()
        }
      });
    })
  );
  const upsertMs = Date.now() - upsertStart;

  console.info("[DAILY][PRICES] fetched listingId", {
    listingId: listing.id,
    points: points.length,
    range: `${from}..${to}`,
    requestMs,
    upsertMs
  });

  return points.length;
}

export async function fetchDailyPricesForListings(
  listings: ListingDailyTarget[],
  fromDate: Date,
  toDate: Date
): Promise<{ listingCount: number; pricePoints: number }> {
  if (!listings.length) return { listingCount: 0, pricePoints: 0 };

  console.info("[DAILY][PRICES] batch start", {
    listingCount: listings.length,
    range: `${toIsoDate(fromDate)}..${toIsoDate(toDate)}`
  });

  let totalPoints = 0;
  for (const listing of listings) {
    totalPoints += await fetchDailyPricesForListing(listing, fromDate, toDate);
    await sleep(RATE_LIMIT_MS); // small delay to avoid provider burst limits.
  }

  console.info("[DAILY][PRICES] batch completed", {
    listingCount: listings.length,
    pricePoints: totalPoints
  });

  return { listingCount: listings.length, pricePoints: totalPoints };
}
