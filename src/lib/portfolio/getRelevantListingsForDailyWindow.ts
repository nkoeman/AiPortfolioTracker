import { prisma } from "@/lib/prisma";

export type DailyListingTarget = {
  id: string;
  eodhdCode: string;
  currency: string | null;
};

// Returns all mapped listings referenced by user transactions up to the target end date.
export async function getRelevantListingsForUser(
  userId: string,
  toDate: Date
): Promise<DailyListingTarget[]> {
  const transactions = await prisma.transaction.findMany({
    where: { userId, tradeAt: { lte: toDate } },
    select: {
      instrumentId: true,
      listingId: true,
      instrument: {
        select: {
          listings: {
            where: {
              mappingStatus: "MAPPED",
              eodhdCode: { not: null }
            },
            orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
            select: { id: true }
          }
        }
      }
    },
    orderBy: { tradeAt: "asc" }
  });

  if (!transactions.length) return [];

  const fallbackListingByInstrument = new Map<string, string>();
  for (const tx of transactions) {
    const fallback = tx.instrument.listings[0]?.id;
    if (fallback && !fallbackListingByInstrument.has(tx.instrumentId)) {
      fallbackListingByInstrument.set(tx.instrumentId, fallback);
    }
  }

  const listingIds = Array.from(
    new Set(
      transactions
        .map((tx) => tx.listingId || fallbackListingByInstrument.get(tx.instrumentId) || null)
        .filter((value): value is string => Boolean(value))
    )
  );

  if (!listingIds.length) return [];

  const listings = await prisma.instrumentListing.findMany({
    where: {
      id: { in: listingIds },
      mappingStatus: "MAPPED",
      eodhdCode: { not: null }
    },
    select: { id: true, eodhdCode: true, currency: true }
  });

  return listings.map((listing) => ({
    id: listing.id,
    eodhdCode: listing.eodhdCode as string,
    currency: listing.currency || null
  }));
}

// Backward-compatible alias retained while callers migrate to the new naming.
export const getRelevantListingsForDailyWindow = getRelevantListingsForUser;
