import { prisma } from "@/lib/prisma";
import { getOrCreateDailyPortfolioSeries, DailyPortfolioSeries } from "@/lib/portfolio/getOrCreateDailyPortfolioSeries";

function startOfDay(value: Date) {
  return new Date(`${value.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

// Refreshes and persists daily portfolio values for the provided range.
export async function refreshDailyPortfolioValuesForUser(
  userId: string,
  range?: { fromDate?: Date; toDate?: Date }
): Promise<DailyPortfolioSeries> {
  const toDate = startOfDay(range?.toDate ?? new Date());
  let fromDate = range?.fromDate ? startOfDay(range.fromDate) : null;

  if (!fromDate) {
    const firstTx = await prisma.transaction.findFirst({
      where: { userId },
      orderBy: { tradeAt: "asc" },
      select: { tradeAt: true }
    });
    fromDate = firstTx ? startOfDay(firstTx.tradeAt) : toDate;
  }

  return getOrCreateDailyPortfolioSeries(userId, {
    fromDate,
    toDate,
    forceRecompute: true,
    priceLookbackDays: 7
  });
}
