import { addDays, startOfDay } from "date-fns";
import { MappingStatus } from "@prisma/client";
import { getEnabledBenchmarks, type BenchmarkConfig } from "@/lib/benchmarks/config";
import { fetchDailyPricesForListing } from "@/lib/prices/fetchDailyAdjustedClose";
import { prisma } from "@/lib/prisma";

export type BenchmarkPricePoint = {
  date: string;
  close: number;
};

export type BenchmarkPriceSeries = {
  id: BenchmarkConfig["id"];
  label: string;
  symbol: string;
  currency: string;
  prices: BenchmarkPricePoint[];
};

const benchmarkSyncQueue = new Map<string, Promise<void>>();

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function parseBenchmarkSymbol(symbol: string) {
  const [ticker, ...suffixParts] = symbol.split(".");
  const exchangeCode = suffixParts.join(".") || "UNKNOWN";
  return {
    ticker: ticker || symbol,
    exchangeCode
  };
}

function queueKey(benchmark: BenchmarkConfig, fromDate: Date, toDate: Date) {
  return `${benchmark.provider}:${benchmark.symbol}:${toIsoDate(fromDate)}:${toIsoDate(toDate)}`;
}

async function ensureBenchmarkListing(benchmark: BenchmarkConfig) {
  const parsed = parseBenchmarkSymbol(benchmark.symbol);

  await prisma.instrument.upsert({
    where: { isin: benchmark.isin },
    update: {
      name: benchmark.label,
      displayName: benchmark.label,
      assetClass: "BENCHMARK",
      issuer: "Benchmark"
    },
    create: {
      isin: benchmark.isin,
      name: benchmark.label,
      displayName: benchmark.label,
      assetClass: "BENCHMARK",
      issuer: "Benchmark"
    }
  });

  return prisma.instrumentListing.upsert({
    where: { eodhdCode: benchmark.symbol },
    update: {
      isin: benchmark.isin,
      exchangeName: parsed.exchangeCode,
      exchangeCode: parsed.exchangeCode,
      eodhdCode: benchmark.symbol,
      currency: benchmark.currency,
      isPrimary: true,
      mappingStatus: MappingStatus.MAPPED,
      mappingError: null,
      lastMappedAt: new Date()
    },
    create: {
      isin: benchmark.isin,
      exchangeName: parsed.exchangeCode,
      exchangeCode: parsed.exchangeCode,
      eodhdCode: benchmark.symbol,
      currency: benchmark.currency,
      isPrimary: true,
      mappingStatus: MappingStatus.MAPPED,
      lastMappedAt: new Date()
    },
    select: {
      id: true,
      eodhdCode: true,
      currency: true
    }
  });
}

async function fetchMissingBenchmarkRanges(benchmark: BenchmarkConfig, fromDate: Date, toDate: Date) {
  const listing = await ensureBenchmarkListing(benchmark);
  if (!listing.eodhdCode) return;

  const bounds = await prisma.dailyListingPrice.aggregate({
    where: {
      listingId: listing.id,
      date: {
        gte: fromDate,
        lte: toDate
      }
    },
    _min: { date: true },
    _max: { date: true }
  });

  const ranges: Array<[Date, Date]> = [];
  const minDate = bounds._min.date ? startOfDay(bounds._min.date) : null;
  const maxDate = bounds._max.date ? startOfDay(bounds._max.date) : null;

  if (!minDate || !maxDate) {
    ranges.push([fromDate, toDate]);
  } else {
    if (minDate.getTime() > fromDate.getTime()) {
      ranges.push([fromDate, addDays(minDate, -1)]);
    }
    if (maxDate.getTime() < toDate.getTime()) {
      ranges.push([addDays(maxDate, 1), toDate]);
    }
  }

  for (const [rangeStart, rangeEnd] of ranges) {
    if (rangeStart.getTime() > rangeEnd.getTime()) continue;
    await fetchDailyPricesForListing(
      {
        id: listing.id,
        eodhdCode: listing.eodhdCode,
        currency: listing.currency
      },
      rangeStart,
      rangeEnd
    );
  }
}

export function queueBenchmarkPriceSync(fromDate: Date, toDate: Date) {
  const benchmarks = getEnabledBenchmarks();
  for (const benchmark of benchmarks) {
    const key = queueKey(benchmark, fromDate, toDate);
    if (benchmarkSyncQueue.has(key)) continue;

    const task = fetchMissingBenchmarkRanges(benchmark, fromDate, toDate)
      .catch((error) => {
        console.warn("[BENCHMARK][PRICES] background sync failed", {
          benchmarkId: benchmark.id,
          symbol: benchmark.symbol,
          range: `${toIsoDate(fromDate)}..${toIsoDate(toDate)}`,
          error: error instanceof Error ? error.message : String(error)
        });
      })
      .then(() => {
        benchmarkSyncQueue.delete(key);
      });

    benchmarkSyncQueue.set(key, task);
  }
}

export async function getBenchmarkPriceSeries(fromDate: Date, toDate: Date): Promise<BenchmarkPriceSeries[]> {
  const benchmarks = getEnabledBenchmarks();
  if (!benchmarks.length) return [];

  const series: BenchmarkPriceSeries[] = [];
  for (const benchmark of benchmarks) {
    const listing = await ensureBenchmarkListing(benchmark);
    const rows = await prisma.dailyListingPrice.findMany({
      where: {
        listingId: listing.id,
        date: {
          gte: fromDate,
          lte: toDate
        }
      },
      select: {
        date: true,
        adjustedClose: true
      },
      orderBy: {
        date: "asc"
      }
    });

    series.push({
      id: benchmark.id,
      label: benchmark.label,
      symbol: benchmark.symbol,
      currency: benchmark.currency,
      prices: rows.map((row) => ({
        date: toIsoDate(row.date),
        close: Number(row.adjustedClose)
      }))
    });
  }

  return series;
}
