import { MappingStatus } from "@prisma/client";
import { fetchEcbFxSeries, EcbDailyFxPoint } from "@/lib/ecb/client";
import { prisma } from "@/lib/prisma";

type EnsureFxOptions = {
  userId?: string;
  listingIds?: string[];
  fromDate?: Date;
  toDate?: Date;
};

type WeeklyFxSyncResult = {
  currencies: number;
  weeks: number;
  upserted: number;
};

function toDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function subtractDays(value: Date, days: number) {
  return new Date(value.getTime() - days * 24 * 60 * 60 * 1000);
}

function normalizeCurrency(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase();
}

function uniqueDates(values: Date[]) {
  return Array.from(
    new Set(values.map((value) => toIsoDate(value))).values()
  )
    .sort((a, b) => a.localeCompare(b))
    .map(toDateOnly);
}

function startOfDay(value: Date) {
  return new Date(`${value.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function getFridaysInRange(fromDate: Date, toDate: Date) {
  const from = startOfDay(fromDate);
  const to = startOfDay(toDate);
  if (from.getTime() > to.getTime()) return [];
  const dates: Date[] = [];
  let cursor = from;
  while (cursor.getTime() <= to.getTime()) {
    if (cursor.getUTCDay() === 5) {
      dates.push(cursor);
    }
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return dates;
}

// Weekly FX points are aligned to provider week-end dates. When ECB is closed on that day,
// we carry backward to the most recent prior observation and log the fallback date.
function findObservationOnOrBefore(points: EcbDailyFxPoint[], weekEndDate: string): EcbDailyFxPoint | null {
  let left = 0;
  let right = points.length - 1;
  let found: EcbDailyFxPoint | null = null;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const point = points[mid];
    if (point.date <= weekEndDate) {
      found = point;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return found;
}

export async function getRequiredCurrencies(options: EnsureFxOptions = {}) {
  const rows = await prisma.instrumentListing.findMany({
    where: {
      mappingStatus: MappingStatus.MAPPED,
      eodhdCode: { not: null },
      currency: { not: null },
      ...(options.listingIds?.length ? { id: { in: options.listingIds } } : {}),
      ...(options.userId ? { transactions: { some: { userId: options.userId } } } : {})
    },
    select: { currency: true },
    distinct: ["currency"]
  });

  return rows
    .map((row) => normalizeCurrency(row.currency))
    .filter((currency) => Boolean(currency) && currency !== "EUR")
    .sort();
}

export async function getRequiredWeekEndDates(options: EnsureFxOptions = {}) {
  if (options.fromDate && options.toDate) {
    return getFridaysInRange(options.fromDate, options.toDate);
  }

  const rows = await prisma.dailyListingPrice.findMany({
    where: {
      ...(options.listingIds?.length ? { listingId: { in: options.listingIds } } : {}),
      ...(options.userId ? { listing: { transactions: { some: { userId: options.userId } } } } : {}),
      ...(options.toDate ? { date: { lte: options.toDate } } : {})
    },
    select: { date: true },
    distinct: ["date"],
    orderBy: { date: "asc" }
  });

  const byFriday = new Set<string>();
  for (const row of rows) {
    const date = startOfDay(row.date);
    const day = date.getUTCDay();
    if (day < 1 || day > 5) continue;
    const friday = new Date(date.getTime() + (5 - day) * 24 * 60 * 60 * 1000);
    if (options.fromDate && friday.getTime() < startOfDay(options.fromDate).getTime()) continue;
    byFriday.add(toIsoDate(friday));
  }

  return Array.from(byFriday.values()).sort((a, b) => a.localeCompare(b)).map(toDateOnly);
}

export async function syncWeeklyFxRates(
  weekEndDates: Date[],
  currencies: string[]
): Promise<WeeklyFxSyncResult> {
  const uniqueWeekDates = uniqueDates(weekEndDates);
  const normalizedCurrencies = Array.from(new Set(currencies.map(normalizeCurrency).filter(Boolean))).filter(
    (currency) => currency !== "EUR"
  );

  if (!uniqueWeekDates.length || !normalizedCurrencies.length) {
    return { currencies: normalizedCurrencies.length, weeks: uniqueWeekDates.length, upserted: 0 };
  }

  // Look back one week so the earliest week-end can still use nearest prior ECB business-day quote.
  const start = toIsoDate(subtractDays(uniqueWeekDates[0], 7));
  const end = toIsoDate(uniqueWeekDates[uniqueWeekDates.length - 1]);
  let upserted = 0;

  for (const currency of normalizedCurrencies) {
    const points = await fetchEcbFxSeries(currency, start, end);
    console.info("[FX][ECB] fetched series", {
      currency,
      points: points.length,
      range: `${start}..${end}`
    });

    const existing = await prisma.fxRate.findMany({
      where: {
        base: "EUR",
        quote: currency,
        weekEndDate: { in: uniqueWeekDates }
      },
      select: { weekEndDate: true }
    });

    const existingByWeek = new Set(existing.map((row) => toIsoDate(row.weekEndDate)));
    let inserted = 0;
    let updated = 0;

    for (const weekEndDate of uniqueWeekDates) {
      const weekEndIso = toIsoDate(weekEndDate);
      const observed = findObservationOnOrBefore(points, weekEndIso);
      if (!observed) {
        console.warn("[FX][SYNC] missing ECB observation for week", {
          currency,
          weekEndDate: weekEndIso
        });
        continue;
      }

      if (observed.date !== weekEndIso) {
        console.warn("[FX][FALLBACK] using prior ECB observation", {
          currency,
          weekEndDate: weekEndIso,
          observedDate: observed.date
        });
      }

      await prisma.fxRate.upsert({
        where: {
          weekEndDate_base_quote: {
            weekEndDate,
            base: "EUR",
            quote: currency
          }
        },
        update: {
          rate: observed.rate,
          observedDate: toDateOnly(observed.date),
          source: "ECB"
        },
        create: {
          weekEndDate,
          base: "EUR",
          quote: currency,
          rate: observed.rate,
          observedDate: toDateOnly(observed.date),
          source: "ECB"
        }
      });

      upserted += 1;
      if (existingByWeek.has(weekEndIso)) {
        updated += 1;
      } else {
        inserted += 1;
      }
    }

    console.info("[FX][WEEK] weekly upserts completed", {
      currency,
      weeks: uniqueWeekDates.length,
      inserted,
      updated
    });
  }

  return {
    currencies: normalizedCurrencies.length,
    weeks: uniqueWeekDates.length,
    upserted
  };
}

export async function ensureWeeklyFxRates(options: EnsureFxOptions = {}) {
  const [weekEndDates, currencies] = await Promise.all([
    getRequiredWeekEndDates(options),
    getRequiredCurrencies(options)
  ]);

  const result = await syncWeeklyFxRates(weekEndDates, currencies);
  console.info("[FX][SYNC] weekly FX coverage ensured", {
    userId: options.userId || null,
    listingCount: options.listingIds?.length || null,
    currencies: result.currencies,
    weeks: result.weeks,
    upserted: result.upserted
  });
  return result;
}

export const __testables = {
  findObservationOnOrBefore
};
