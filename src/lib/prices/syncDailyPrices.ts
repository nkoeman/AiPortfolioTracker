import { prisma } from "@/lib/prisma";
import { fetchDailyPricesForListings } from "@/lib/prices/fetchDailyAdjustedClose";
import { getRelevantListingsForUser } from "@/lib/portfolio/getRelevantListingsForDailyWindow";

function startOfDay(value: Date) {
  return new Date(`${value.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export type DailyPriceSyncResult = {
  listingCount: number;
  pricePoints: number;
  fromDate: Date;
  toDate: Date;
};

export async function syncDailyPricesForListings(
  listingIds: string[],
  fromDate: Date,
  toDate: Date
): Promise<DailyPriceSyncResult> {
  const from = startOfDay(fromDate);
  const to = startOfDay(toDate);
  if (!listingIds.length || from.getTime() > to.getTime()) {
    return { listingCount: 0, pricePoints: 0, fromDate: from, toDate: to };
  }

  const listings = await prisma.instrumentListing.findMany({
    where: {
      id: { in: listingIds },
      mappingStatus: "MAPPED",
      eodhdCode: { not: null }
    },
    select: {
      id: true,
      eodhdCode: true,
      currency: true
    }
  });

  const { listingCount, pricePoints } = await fetchDailyPricesForListings(
    listings.map((listing) => ({
      id: listing.id,
      eodhdCode: listing.eodhdCode as string,
      currency: listing.currency || null
    })),
    from,
    to
  );

  console.info("[SYNC][PRICES] completed", {
    listings: listingCount,
    from: toIsoDate(from),
    to: toIsoDate(to),
    upserts: pricePoints
  });

  return { listingCount, pricePoints, fromDate: from, toDate: to };
}

export async function syncDailyPricesForUser(
  userId: string,
  fromDate: Date,
  toDate: Date
): Promise<DailyPriceSyncResult> {
  const from = startOfDay(fromDate);
  const to = startOfDay(toDate);
  if (from.getTime() > to.getTime()) {
    return { listingCount: 0, pricePoints: 0, fromDate: from, toDate: to };
  }

  const listings = await getRelevantListingsForUser(userId, to);
  const { listingCount, pricePoints } = await fetchDailyPricesForListings(listings, from, to);

  console.info("[SYNC][PRICES] user sync completed", {
    userId,
    listings: listingCount,
    from: toIsoDate(from),
    to: toIsoDate(to),
    upserts: pricePoints
  });

  return { listingCount, pricePoints, fromDate: from, toDate: to };
}
