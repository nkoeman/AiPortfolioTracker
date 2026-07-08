"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PortfolioChart, type PortfolioChartPoint } from "@/components/PortfolioChart";
import {
  PortfolioReturnBarChart,
  type PortfolioReturnBarPoint,
  type ReturnPeriodGranularity
} from "@/components/PortfolioReturnBarChart";
import {
  getPerformanceRangeCutoff,
  getPerformanceTimeWindow,
  type ExtendedPerformanceRangeOption,
  usesWeeklyGranularity
} from "@/lib/charts/performanceRange";
import { computeTimeTicks, type TimeWindow } from "@/lib/charts/timeTicks";
import type { BenchmarkPriceSeries } from "@/lib/benchmarks/prices";

type PortfolioValueCardProps = {
  dailyValueData: PortfolioChartPoint[];
  latestCloseDate: string | null;
  benchmarks?: BenchmarkPriceSeries[];
};

type RangeOption = ExtendedPerformanceRangeOption;
type MetricOption = "value" | "return";

type TimeAxisConfig = {
  ticks: number[];
  tickFormatter: (value: number) => string;
};

type PerformanceSummary = {
  returnPct: number | null;
  netInvestedEur: number | null;
  portfolioGainEur: number | null;
};
type KpiStripData = {
  marketValueEur: number | null;
  todayDeltaEur: number | null;
  todayDeltaPct: number | null;
  latestCloseDate: string | null;
  ytdReturnPct: number | null;
  ytdReturnEur: number | null;
  totalReturnPct: number | null;
  totalReturnEur: number | null;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const BENCHMARK_COLORS: Record<string, string> = {
  sp500: "#2f6fd6",
  ftse_all_world: "#c9761c"
};

function useObservedWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const updateWidth = () => {
      const next = Math.round(node.getBoundingClientRect().width);
      setWidth((prev) => (prev === next ? prev : next));
    };
    updateWidth();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const next = Math.round(entry.contentRect.width);
        setWidth((prev) => (prev === next ? prev : next));
      });
      observer.observe(node);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  return [ref, width] as const;
}

function formatThousandsTick(value: number) {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value) < 0.5) return "0";
  return `${Math.round(value / 1000)}K`;
}

function formatEurThousandsTick(value: number) {
  if (!Number.isFinite(value)) return "";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs < 1000) return `${sign}\u20AC${Math.round(abs)}`;
  return `${sign}\u20AC${Math.round(abs / 1000)}K`;
}

const eurFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const eurNlFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const eurNlWholeFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

function formatValueEurPoints(value: number, name: string) {
  const label =
    name === "EUR" || name === "Value (EUR)" || name === "Portfolio value"
      ? "Portfolio value"
      : name === "Invested"
        ? "Invested"
        : name;
  return [eurFormatter.format(value), label] as [string, string];
}

function formatSignedEur(value: number) {
  if (!Number.isFinite(value)) return "-";
  if (value > 0) return `+${eurNlFormatter.format(value)}`;
  return eurNlFormatter.format(value);
}

function formatReturnEurPoints(value: number, name: string) {
  const label = name === "ReturnEur" ? "Return (\u20AC)" : name;
  return [formatSignedEur(value), label] as [string, string];
}

function formatSignedPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "\u2014";
  const rounded = Number(value.toFixed(2));
  if (rounded > 0) return `+${rounded.toFixed(2)}%`;
  return `${rounded.toFixed(2)}%`;
}

function formatSignedEurForCard(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "\u2014";
  return formatSignedEur(value);
}

function formatUnsignedEur(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "\u2014";
  return eurNlFormatter.format(value);
}

function formatWholeEur(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "\u2014";
  if (value > 0) return `+${eurNlWholeFormatter.format(value)}`;
  return eurNlWholeFormatter.format(value);
}

function formatCloseDate(value: string | null) {
  if (!value) return "\u2014";
  const date = toDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC"
  }).format(date);
}

function todayIsoDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function toDate(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function computeValueDomain(data: Array<{ date: string }>, keys: string[]) {
  const values: number[] = [];
  for (const point of data) {
    const indexedPoint = point as Record<string, unknown>;
    for (const key of keys) {
      const raw = indexedPoint[key];
      if (typeof raw === "number" && Number.isFinite(raw)) {
        values.push(raw);
      }
    }
  }
  if (!values.length) return undefined;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    const delta = Math.max(1, Math.abs(min) * 0.01);
    return [min - delta, max + delta] as [number, number];
  }
  return [min, max] as [number, number];
}

function computeDomainIncludingZero(data: Array<{ date: string }>, keys: string[]) {
  const domain = computeValueDomain(data, keys);
  if (!domain) return undefined;
  const min = Math.min(domain[0], 0);
  const max = Math.max(domain[1], 0);
  if (min === max) {
    const delta = Math.max(1, Math.abs(min) * 0.01);
    return [min - delta, max + delta] as [number, number];
  }
  return [min, max] as [number, number];
}

function computePaddedDomainIncludingZero(data: Array<{ date: string }>, keys: string[], paddingRatio = 0.12) {
  const domain = computeDomainIncludingZero(data, keys);
  if (!domain) return undefined;
  const [min, max] = domain;
  const span = max - min;
  if (!Number.isFinite(span) || span <= 0) {
    const delta = Math.max(1, Math.abs(max) * paddingRatio);
    return [min - delta, max + delta] as [number, number];
  }
  const padding = span * paddingRatio;
  return [min - padding, max + padding] as [number, number];
}

function computeNiceStep(rawStep: number) {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;
  const exponent = Math.floor(Math.log10(rawStep));
  const magnitude = 10 ** exponent;
  const normalized = rawStep / magnitude;
  if (normalized <= 1) return 1 * magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function buildLinearTicks(
  domain: [number, number] | undefined,
  options: { step?: number; targetTicks?: number } = {}
) {
  if (!domain) return undefined;
  const [min, max] = domain;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return undefined;
  if (min === max) return [min];

  const targetTicks = Math.max(2, options.targetTicks ?? 6);
  const step = options.step ?? computeNiceStep((max - min) / (targetTicks - 1));
  if (!Number.isFinite(step) || step <= 0) return undefined;

  const first = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let tick = first; tick <= max + step * 0.25; tick += step) {
    if (tick >= min - step * 0.25 && tick <= max + step * 0.25) {
      ticks.push(Number(tick.toFixed(8)));
    }
  }

  if (min <= 0 && max >= 0 && !ticks.some((tick) => Math.abs(tick) < 1e-8)) {
    ticks.push(0);
  }

  return Array.from(new Set(ticks)).sort((a, b) => a - b);
}

function sortByDateAsc(data: PortfolioChartPoint[]) {
  return [...data].sort((a, b) => {
    const aDate = toDate(a.date);
    const bDate = toDate(b.date);
    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;
    return aDate.getTime() - bDate.getTime();
  });
}

function toIsoDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isWeekday(date: Date) {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

function previousWeekday(date: Date) {
  const previous = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  do {
    previous.setUTCDate(previous.getUTCDate() - 1);
  } while (!isWeekday(previous));
  return previous;
}

function effectiveTradingDate(date: Date) {
  if (isWeekday(date)) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }
  return previousWeekday(date);
}

function findPreviousTradingClosePoint(fullSeries: PortfolioChartPoint[], latest: PortfolioChartPoint) {
  const latestDate = toDate(latest.date);
  if (!latestDate) return fullSeries.length > 1 ? fullSeries[fullSeries.length - 2] : null;

  const previousTradingDate = previousWeekday(effectiveTradingDate(latestDate));
  const previousTradingKey = toIsoDateKey(previousTradingDate);
  const exactPrevious = fullSeries.find((point) => point.date === previousTradingKey);
  if (exactPrevious) return exactPrevious;

  for (let idx = fullSeries.length - 2; idx >= 0; idx -= 1) {
    const pointDate = toDate(fullSeries[idx].date);
    if (!pointDate) continue;
    if (pointDate.getTime() <= previousTradingDate.getTime() && isWeekday(pointDate)) {
      return fullSeries[idx];
    }
  }

  return fullSeries.length > 1 ? fullSeries[fullSeries.length - 2] : null;
}

function findLatestCompletedClosePoint(fullSeries: PortfolioChartPoint[]) {
  const todayKey = todayIsoDateKey();
  for (let idx = fullSeries.length - 1; idx >= 0; idx -= 1) {
    const point = fullSeries[idx];
    const pointDate = toDate(point.date);
    if (!pointDate) continue;
    if (point.date < todayKey && isWeekday(pointDate)) {
      return point;
    }
  }
  return fullSeries[fullSeries.length - 1] ?? null;
}

function sumNetExternalFlowsBetween(
  fullSeries: PortfolioChartPoint[],
  previous: PortfolioChartPoint,
  latest: PortfolioChartPoint
) {
  const previousDate = toDate(previous.date);
  const latestDate = toDate(latest.date);
  if (!previousDate || !latestDate) return 0;

  return fullSeries.reduce((sum, point) => {
    const pointDate = toDate(point.date);
    if (!pointDate) return sum;
    if (pointDate.getTime() <= previousDate.getTime() || pointDate.getTime() > latestDate.getTime()) return sum;
    return sum + (getNumericField(point, "NetExternalFlow") ?? 0);
  }, 0);
}

function startOfIsoWeekUtc(date: Date) {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - diffToMonday);
  return utc;
}

function withDateMs(source: PortfolioChartPoint[]) {
  return source
    .map((point) => {
      const parsed = toDate(point.date);
      if (!parsed) return null;
      return {
        ...point,
        dateMs: parsed.getTime()
      };
    })
    .filter((point): point is PortfolioChartPoint & { dateMs: number } => point !== null);
}

function toWeeklySeries(source: PortfolioChartPoint[]) {
  const sorted = sortByDateAsc(source);
  const byWeek = new Map<string, PortfolioChartPoint>();

  for (const point of sorted) {
    const parsed = toDate(point.date);
    if (!parsed) continue;
    const weekKey = toIsoDateKey(startOfIsoWeekUtc(parsed));
    byWeek.set(weekKey, point);
  }

  return sortByDateAsc(Array.from(byWeek.values()));
}

function getReturnGranularityForRange(range: RangeOption): ReturnPeriodGranularity {
  if (range === "max") return "year";
  if (range === "1m") return "day";
  return "month";
}

function granularityLabel(granularity: ReturnPeriodGranularity) {
  if (granularity === "day") return "Daily";
  if (granularity === "year") return "Yearly";
  return "Monthly";
}

function formatCompactMonthYear(value: number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = new Intl.DateTimeFormat("en-GB", {
    month: "short",
    timeZone: "UTC"
  }).format(date);
  const year = new Intl.DateTimeFormat("en-GB", {
    year: "2-digit",
    timeZone: "UTC"
  }).format(date);
  return `${month} '${year}`;
}

function buildCompactTimeAxisConfig(sorted: number[]): TimeAxisConfig {
  const first = sorted[0];
  const middle = sorted[Math.floor((sorted.length - 1) / 2)];
  const last = sorted[sorted.length - 1];
  const ticks = Array.from(new Set([first, middle, last])).sort((a, b) => a - b);
  const labelByValue = new Map(ticks.map((tick) => [tick, formatCompactMonthYear(tick)] as const));

  return {
    ticks,
    tickFormatter: (value: number) => labelByValue.get(value) ?? ""
  };
}

function buildTimeAxisConfig(
  data: Array<{ date: string; dateMs?: number }>,
  window: TimeWindow,
  chartWidthPx: number,
  axisRangeSource?: Array<{ date: string; dateMs?: number }>,
  compact = false
): TimeAxisConfig | undefined {
  const source = axisRangeSource && axisRangeSource.length ? axisRangeSource : data;
  if (!source.length) return undefined;

  const sorted = [...source]
    .map((point) => {
      if (typeof point.dateMs === "number" && Number.isFinite(point.dateMs)) return point.dateMs;
      const parsed = toDate(point.date);
      return parsed ? parsed.getTime() : null;
    })
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);

  if (!sorted.length) return undefined;
  if (compact) return buildCompactTimeAxisConfig(sorted);

  const startDate = new Date(sorted[0]);
  const endDate = new Date(sorted[sorted.length - 1]);
  const computed = computeTimeTicks({
    startDate,
    endDate,
    window,
    chartWidthPx,
    locale: "en-GB",
    timeZone: "UTC"
  });
  const ticks = computed.map((tick) => tick.value);
  const labelByValue = new Map(computed.map((tick) => [tick.value, tick.label] as const));

  const tickFormatter = (value: number) => {
    if (labelByValue.has(value)) return labelByValue.get(value) ?? "";
    const nearest = ticks.find((tick) => Math.abs(tick - value) <= ONE_DAY_MS / 2);
    if (nearest !== undefined) return labelByValue.get(nearest) ?? "";
    return "";
  };

  return {
    ticks,
    tickFormatter
  };
}

function getSeriesBounds(data: Array<{ date: string; dateMs?: number }>) {
  const values = data
    .map((point) => {
      if (typeof point.dateMs === "number" && Number.isFinite(point.dateMs)) return point.dateMs;
      const parsed = toDate(point.date);
      return parsed ? parsed.getTime() : null;
    })
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  if (!values.length) return undefined;
  return [values[0], values[values.length - 1]] as [number, number];
}

function getPeriodMeta(date: Date, granularity: ReturnPeriodGranularity) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  if (granularity === "year") {
    const startDate = `${year}-01-01`;
    const anchorMs = Date.UTC(year, 5, 30, 12, 0, 0, 0);
    return { key: String(year), startDate, anchorMs };
  }

  if (granularity === "month") {
    const monthIdx = Number(month) - 1;
    const startMs = Date.UTC(year, monthIdx, 1);
    const nextStartMs = Date.UTC(year, monthIdx + 1, 1);
    const anchorMs = startMs + Math.floor((nextStartMs - startMs) / 2);
    const startDate = `${year}-${month}-01`;
    return { key: `${year}-${month}`, startDate, anchorMs };
  }

  const startDate = `${year}-${month}-${day}`;
  const startMs = Date.UTC(year, Number(month) - 1, Number(day));
  return {
    key: `${year}-${month}-${day}`,
    startDate,
    anchorMs: startMs
  };
}

function getPeriodEndDate(date: Date, granularity: ReturnPeriodGranularity) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  if (granularity === "year") {
    return new Date(Date.UTC(year, 11, 31));
  }

  if (granularity === "month") {
    return new Date(Date.UTC(year, month + 1, 0));
  }

  return new Date(Date.UTC(year, month, day));
}

function benchmarkDataKey(id: string) {
  return `Benchmark_${id.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

function findFirstBenchmarkCloseAtOrAfter(
  prices: Array<{ date: Date; close: number }>,
  startDate: Date
) {
  return prices.find((point) => point.date.getTime() >= startDate.getTime() && point.close > 0) ?? null;
}

function findLastBenchmarkCloseAtOrBefore(
  prices: Array<{ date: Date; close: number }>,
  targetDate: Date
) {
  for (let idx = prices.length - 1; idx >= 0; idx -= 1) {
    const point = prices[idx];
    if (point.date.getTime() <= targetDate.getTime() && point.close > 0) {
      return point;
    }
  }
  return null;
}

function buildBenchmarkReturnData(
  returnSeries: PortfolioReturnBarPoint[],
  benchmarks: BenchmarkPriceSeries[],
  activeBenchmarkIds: string[],
  granularity: ReturnPeriodGranularity,
  startDate: Date | null
) {
  const activeIds = new Set(activeBenchmarkIds);
  const benchmarkLines: Array<{ key: string; label: string; color: string }> = [];
  const data = returnSeries.map((point) => ({ ...point }));

  if (!startDate || !returnSeries.length || !benchmarks.length || !activeIds.size) {
    return { data, benchmarkLines };
  }

  for (const benchmark of benchmarks) {
    if (!activeIds.has(benchmark.id)) continue;

    const prices = benchmark.prices
      .map((price) => {
        const parsed = toDate(price.date);
        if (!parsed || !Number.isFinite(price.close) || price.close <= 0) return null;
        return { date: parsed, close: price.close };
      })
      .filter((price): price is { date: Date; close: number } => price !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const base = findFirstBenchmarkCloseAtOrAfter(prices, startDate);
    if (!base) continue;

    const key = benchmarkDataKey(benchmark.id);
    let hasValues = false;

    for (const point of data) {
      if (point.IsReturnAnchor === 1) {
        point[key] = 0;
        hasValues = true;
        continue;
      }
      const pointDate = toDate(point.date);
      if (!pointDate) continue;
      const targetDate = getPeriodEndDate(pointDate, granularity);
      const close = findLastBenchmarkCloseAtOrBefore(prices, targetDate);
      if (!close || close.date.getTime() < base.date.getTime()) {
        point[key] = null;
        continue;
      }

      point[key] = Number(((close.close / base.close - 1) * 100).toFixed(6));
      hasValues = true;
    }

    if (hasValues) {
      benchmarkLines.push({
        key,
        label: benchmark.label,
        color: BENCHMARK_COLORS[benchmark.id] ?? "var(--muted-text)"
      });
    }
  }

  return { data, benchmarkLines };
}

function getNumericField(
  point: PortfolioChartPoint,
  key: "EUR" | "Invested" | "PeriodReturnPct" | "NetExternalFlow" | "ReturnEur"
) {
  const raw = point[key];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

function buildReturnSeries(
  source: PortfolioChartPoint[],
  granularity: ReturnPeriodGranularity
): PortfolioReturnBarPoint[] {
  const sorted = sortByDateAsc(source);
  if (!sorted.length) return [];
  let cumulativeGrowth = 1;
  let hasCumulativeReturnData = false;
  const firstDate = toDate(sorted[0].date);
  const anchorPoint: PortfolioReturnBarPoint | null = firstDate
    ? {
        date: sorted[0].date,
        dateMs: firstDate.getTime(),
        Return: null,
        CumulativeReturn: 0,
        GainEur: null,
        IsReturnAnchor: 1
      }
    : null;

  const withDailyOrganic = sorted.map((point, idx) => {
    const value = getNumericField(point, "EUR");
    const invested = getNumericField(point, "Invested");
    if (idx === 0) return { point, organicGainEur: null as number | null };

    const prevPoint = sorted[idx - 1];
    const prevValue = getNumericField(prevPoint, "EUR");
    const prevInvested = getNumericField(prevPoint, "Invested");
    if (value === null || invested === null || prevValue === null || prevInvested === null) {
      return { point, organicGainEur: null as number | null };
    }

    return {
      point,
      organicGainEur: Number(((value - prevValue) - (invested - prevInvested)).toFixed(8))
    };
  });

  if (granularity === "day") {
    const dailyPoints: PortfolioReturnBarPoint[] = anchorPoint ? [anchorPoint] : [];
    for (const [index, { point, organicGainEur }] of withDailyOrganic.entries()) {
      if (index === 0) continue;
      const raw = getNumericField(point, "PeriodReturnPct");
      if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
      const parsed = toDate(point.date);
      if (!parsed) continue;

      if (!hasCumulativeReturnData) {
        cumulativeGrowth = 1;
        hasCumulativeReturnData = true;
      } else {
        cumulativeGrowth *= 1 + raw / 100;
      }

      dailyPoints.push({
        date: point.date,
        dateMs: parsed.getTime(),
        Return: Number(raw.toFixed(6)),
        CumulativeReturn: hasCumulativeReturnData
          ? Number(((cumulativeGrowth - 1) * 100).toFixed(6))
          : null,
        GainEur: organicGainEur
      });
    }
    return dailyPoints;
  }

  const points: PortfolioReturnBarPoint[] = anchorPoint ? [anchorPoint] : [];
  let activeKey: string | null = null;
  let activeDate = "";
  let activeDateMs = 0;
  let compoundedGrowth = 1;
  let hasReturnData = false;
  let organicGainEurTotal = 0;
  let hasOrganicGain = false;
  let activeCumulativeReturn: number | null = null;

  const flush = () => {
    if (!activeKey || !hasReturnData) return;
    points.push({
      date: activeDate,
      dateMs: activeDateMs,
      Return: Number(((compoundedGrowth - 1) * 100).toFixed(6)),
      CumulativeReturn: activeCumulativeReturn,
      GainEur: hasOrganicGain ? Number(organicGainEurTotal.toFixed(2)) : null
    });
  };

  for (const row of withDailyOrganic) {
    const point = row.point;
    const parsed = toDate(point.date);
    if (!parsed) continue;
    const { key, startDate, anchorMs } = getPeriodMeta(parsed, granularity);

    if (key !== activeKey) {
      flush();
      activeKey = key;
      activeDate = startDate;
      activeDateMs = anchorMs;
      compoundedGrowth = 1;
      hasReturnData = false;
      organicGainEurTotal = 0;
      hasOrganicGain = false;
      activeCumulativeReturn = null;
    }

    const raw = getNumericField(point, "PeriodReturnPct");
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue;

    if (!hasCumulativeReturnData) {
      cumulativeGrowth = 1;
      hasCumulativeReturnData = true;
    } else {
      cumulativeGrowth *= 1 + raw / 100;
    }

    compoundedGrowth *= 1 + raw / 100;
    hasReturnData = true;
    activeCumulativeReturn = Number(((cumulativeGrowth - 1) * 100).toFixed(6));

    if (typeof row.organicGainEur === "number" && Number.isFinite(row.organicGainEur)) {
      organicGainEurTotal += row.organicGainEur;
      hasOrganicGain = true;
    }
  }

  flush();
  return points;
}

function computePerformanceSummary(rangeSeries: PortfolioChartPoint[]): PerformanceSummary {
  if (!rangeSeries.length) {
    return { returnPct: null, netInvestedEur: null, portfolioGainEur: null };
  }

  const startPoint = rangeSeries[0];
  const endPoint = rangeSeries[rangeSeries.length - 1];
  const startValue = getNumericField(startPoint, "EUR");
  const endValue = getNumericField(endPoint, "EUR");

  let growth = 1;
  let hasReturnData = false;
  for (const point of rangeSeries) {
    const periodPct = getNumericField(point, "PeriodReturnPct");
    if (periodPct === null) continue;
    growth *= 1 + periodPct / 100;
    hasReturnData = true;
  }
  const returnPct = hasReturnData ? Number(((growth - 1) * 100).toFixed(6)) : null;

  const netExternalFlows = rangeSeries
    .map((point) => getNumericField(point, "NetExternalFlow"))
    .filter((value): value is number => value !== null);
  const netInvestedEur =
    netExternalFlows.length > 0
      ? Number((-netExternalFlows.reduce((total, value) => total + value, 0)).toFixed(8))
      : null;

  const portfolioGainEur =
    startValue !== null && endValue !== null && netInvestedEur !== null
      ? Number((endValue - startValue - netInvestedEur).toFixed(8))
      : null;

  return {
    returnPct,
    netInvestedEur,
    portfolioGainEur
  };
}

function computeCompoundedReturnPct(series: PortfolioChartPoint[]) {
  let growth = 1;
  let hasData = false;
  for (const point of series) {
    const periodPct = getNumericField(point, "PeriodReturnPct");
    if (periodPct === null) continue;
    growth *= 1 + periodPct / 100;
    hasData = true;
  }
  return hasData ? Number(((growth - 1) * 100).toFixed(6)) : null;
}

function computeKpiStripData(
  fullSeries: PortfolioChartPoint[],
  ytdSeries: PortfolioChartPoint[]
): KpiStripData {
  if (!fullSeries.length) {
    return {
      marketValueEur: null,
      todayDeltaEur: null,
      todayDeltaPct: null,
      latestCloseDate: null,
      ytdReturnPct: null,
      ytdReturnEur: null,
      totalReturnPct: null,
      totalReturnEur: null
    };
  }

  const latest = findLatestCompletedClosePoint(fullSeries);
  if (!latest) {
    return {
      marketValueEur: null,
      todayDeltaEur: null,
      todayDeltaPct: null,
      latestCloseDate: null,
      ytdReturnPct: null,
      ytdReturnEur: null,
      totalReturnPct: null,
      totalReturnEur: null
    };
  }
  const previous = findPreviousTradingClosePoint(fullSeries, latest);
  const marketValueEur = getNumericField(latest, "EUR");
  const totalReturnEur = getNumericField(latest, "ReturnEur");
  const completedSeries = fullSeries.filter((point) => point.date <= latest.date);
  const totalReturnPct = computeCompoundedReturnPct(completedSeries);
  const ytdSummary = computePerformanceSummary(ytdSeries);
  const netExternalFlowSincePrevious =
    previous && marketValueEur !== null ? sumNetExternalFlowsBetween(fullSeries, previous, latest) : 0;

  const todayDeltaEur =
    previous && marketValueEur !== null
      ? (() => {
          const prevValue = getNumericField(previous, "EUR");
          return prevValue === null
            ? null
            : Number((marketValueEur - prevValue + netExternalFlowSincePrevious).toFixed(8));
        })()
      : null;
  const todayDeltaPct =
    previous && marketValueEur !== null
      ? (() => {
          const prevValue = getNumericField(previous, "EUR");
          if (prevValue === null || prevValue === 0) return null;
          return Number(
            (((marketValueEur - prevValue + netExternalFlowSincePrevious) / prevValue) * 100).toFixed(6)
          );
        })()
      : null;

  return {
    marketValueEur,
    todayDeltaEur,
    todayDeltaPct,
    latestCloseDate: latest.date,
    ytdReturnPct: ytdSummary.returnPct,
    ytdReturnEur: ytdSummary.portfolioGainEur,
    totalReturnPct,
    totalReturnEur
  };
}

export function PortfolioValueCard({
  dailyValueData,
  latestCloseDate,
  benchmarks = []
}: PortfolioValueCardProps) {
  const [range, setRange] = useState<RangeOption>("ytd");
  const [metric, setMetric] = useState<MetricOption>("return");
  const [activeBenchmarkIds, setActiveBenchmarkIds] = useState<string[]>([]);
  const [chartRef, chartWidth] = useObservedWidth<HTMLDivElement>();
  const effectiveChartWidth = chartWidth > 0 ? chartWidth : 900;

  useEffect(() => {
    setActiveBenchmarkIds((current) => {
      const availableIds = benchmarks.map((benchmark) => String(benchmark.id));
      const availableSet = new Set<string>(availableIds);
      return current.filter((id) => availableSet.has(id));
    });
  }, [benchmarks]);

  const sortedDaily = useMemo(
    () => withDateMs(sortByDateAsc(dailyValueData)),
    [dailyValueData]
  );

  const rangeSeries = useMemo(() => {
    const source = sortedDaily;
    if (!source.length || range === "max") return source;

    const latestDate = toDate(source[source.length - 1].date);
    if (!latestDate) return source;
    const cutoff = getPerformanceRangeCutoff(latestDate, range);

    return source.filter((point) => {
      const pointDate = toDate(point.date);
      return pointDate ? pointDate.getTime() >= cutoff.getTime() : false;
    });
  }, [range, sortedDaily]);

  const ytdSeries = useMemo(() => {
    if (!sortedDaily.length) return [] as Array<PortfolioChartPoint & { dateMs: number }>;
    const latestDate = toDate(sortedDaily[sortedDaily.length - 1].date);
    if (!latestDate) return sortedDaily;
    const ytdCutoff = getPerformanceRangeCutoff(latestDate, "ytd");
    return sortedDaily.filter((point) => {
      const pointDate = toDate(point.date);
      return pointDate ? pointDate.getTime() >= ytdCutoff.getTime() : false;
    });
  }, [sortedDaily]);

  const chartWindow = useMemo(() => getPerformanceTimeWindow(range), [range]);
  const valueSeries = useMemo(
    () => (usesWeeklyGranularity(range) ? toWeeklySeries(rangeSeries) : rangeSeries),
    [range, rangeSeries]
  );

  const returnGranularity = useMemo(() => getReturnGranularityForRange(range), [range]);
  const returnSeries = useMemo(
    () => buildReturnSeries(rangeSeries, returnGranularity),
    [rangeSeries, returnGranularity]
  );
  const returnStartDate = useMemo(() => {
    const first = rangeSeries[0];
    return first ? toDate(first.date) : null;
  }, [rangeSeries]);
  const benchmarkReturn = useMemo(
    () => buildBenchmarkReturnData(returnSeries, benchmarks, activeBenchmarkIds, returnGranularity, returnStartDate),
    [activeBenchmarkIds, benchmarks, returnGranularity, returnSeries, returnStartDate]
  );
  const summary = useMemo(() => computePerformanceSummary(rangeSeries), [rangeSeries]);
  const kpiData = useMemo(
    () => computeKpiStripData(sortedDaily, ytdSeries),
    [sortedDaily, ytdSeries]
  );
  const compactValueChart = effectiveChartWidth <= 640;

  const valueAxis = useMemo(
    () => buildTimeAxisConfig(valueSeries, chartWindow, effectiveChartWidth, undefined, compactValueChart),
    [valueSeries, chartWindow, effectiveChartWidth, compactValueChart]
  );
  const returnAxis = useMemo(
    () => buildTimeAxisConfig(returnSeries, chartWindow, effectiveChartWidth, rangeSeries, compactValueChart),
    [returnSeries, chartWindow, effectiveChartWidth, rangeSeries, compactValueChart]
  );
  const returnXAxisDomain = useMemo(
    () => getSeriesBounds(rangeSeries),
    [rangeSeries]
  );

  const valueDomain = useMemo(
    () => (metric === "value" ? computeValueDomain(valueSeries, ["EUR", "Invested"]) : undefined),
    [metric, valueSeries]
  );
  const returnDomain = useMemo(
    () =>
      metric === "return"
        ? computePaddedDomainIncludingZero(benchmarkReturn.data, [
            "Return",
            "CumulativeReturn",
            ...benchmarkReturn.benchmarkLines.map((line) => line.key)
          ])
        : undefined,
    [benchmarkReturn.benchmarkLines, benchmarkReturn.data, metric]
  );

  const valueTicks = useMemo(
    () => (metric === "value" ? buildLinearTicks(valueDomain, { targetTicks: 6 }) : undefined),
    [metric, valueDomain]
  );
  const returnYAxisTicks = useMemo(
    () => (metric === "return" ? buildLinearTicks(returnDomain, { targetTicks: 6 }) : undefined),
    [metric, returnDomain]
  );
  const hasSeries =
    metric === "return"
      ? returnSeries.length >= 1
      : valueSeries.length >= 2;

  const rangeOptions: Array<{ key: RangeOption; label: string }> = [
    { key: "1m", label: "1M" },
    { key: "3m", label: "3M" },
    { key: "ytd", label: "YTD" },
    { key: "1y", label: "1Y" },
    { key: "max", label: "MAX" }
  ];
  const metricOptions: Array<{ key: MetricOption; label: string }> = [
    { key: "return", label: "Return (%)" },
    { key: "value", label: "Value (\u20AC)" }
  ];
  const closeDateLabel = formatCloseDate(kpiData.latestCloseDate ?? latestCloseDate);
  const toggleBenchmark = (benchmarkId: string) => {
    setActiveBenchmarkIds((current) =>
      current.includes(benchmarkId)
        ? current.filter((id) => id !== benchmarkId)
        : [...current, benchmarkId]
    );
  };

  return (
    <div className="stack portfolio-performance-card">
      <div className="kpi-strip">
        <div className="kpi kpi-hero">
          <div className="kpi-label">Portfolio value</div>
          <div className="kpi-value">{formatUnsignedEur(kpiData.marketValueEur)}</div>
          <div className="kpi-meta">
            <span className={`delta ${(kpiData.todayDeltaEur || 0) >= 0 ? "pos" : "neg"}`}>
              {(kpiData.todayDeltaEur || 0) >= 0 ? "\u25B2" : "\u25BC"} {formatSignedEurForCard(kpiData.todayDeltaEur)}{" "}
              {formatSignedPercent(kpiData.todayDeltaPct)}
            </span>
            <span>last close ({closeDateLabel})</span>
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Total return</div>
          <div className={`kpi-value ${(kpiData.totalReturnEur || 0) >= 0 ? "tone-positive" : "tone-negative"}`}>
            {formatWholeEur(kpiData.totalReturnEur)}
          </div>
          <div className="kpi-meta">
            <span className={`delta ${(kpiData.totalReturnPct || 0) >= 0 ? "pos" : "neg"}`}>
              {formatSignedPercent(kpiData.totalReturnPct)}
            </span>
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Year to date</div>
          <div className={`kpi-value ${(kpiData.ytdReturnEur || 0) >= 0 ? "tone-positive" : "tone-negative"}`}>
            {formatWholeEur(kpiData.ytdReturnEur)}
          </div>
          <div className="kpi-meta">
            <span className={`delta ${(kpiData.ytdReturnPct || 0) >= 0 ? "pos" : "neg"}`}>
              {formatSignedPercent(kpiData.ytdReturnPct)}
            </span>
          </div>
        </div>
      </div>

      <div className="card stack">
        <div className="card-head">
          <div>
            <h2 className="card-title">Portfolio performance</h2>
          </div>
          <div className="row row-tight portfolio-performance-controls">
            <div className="range-pills" role="tablist" aria-label="Metric">
              {metricOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`range-pill${metric === option.key ? " active" : ""}`}
                  onClick={() => setMetric(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="range-pills" role="tablist" aria-label="Range">
              {rangeOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`range-pill${range === option.key ? " active" : ""}`}
                  onClick={() => setRange(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {hasSeries ? (
          <div className="portfolio-performance-chart" ref={chartRef}>
            {metric === "value" ? (
              <>
                <PortfolioChart
                  data={valueSeries}
                  currencies={["EUR", "Invested"]}
                  showLegend={false}
                  valueFormatter={formatValueEurPoints}
                  yAxisDomain={valueDomain}
                  yAxisTicks={valueTicks}
                  yAxisTickFormatter={formatThousandsTick}
                  xAxisType="number"
                  xAxisDataKey="dateMs"
                  xAxisTickFormatter={valueAxis?.tickFormatter}
                  xAxisTicks={valueAxis?.ticks}
                  compact={compactValueChart}
                  showAreaFill
                  showLastPointDot
                />
                <div className="portfolio-chart-legend" aria-label="Portfolio value chart legend">
                  <span className="portfolio-chart-legend-item">
                    <span className="portfolio-chart-legend-swatch portfolio-chart-legend-swatch-value" />
                    Portfolio value
                  </span>
                  <span className="portfolio-chart-legend-item">
                    <span className="portfolio-chart-legend-swatch portfolio-chart-legend-swatch-invested" />
                    Invested
                  </span>
                </div>
              </>
            ) : (
              <>
                <PortfolioReturnBarChart
                  data={benchmarkReturn.data}
                  benchmarkLines={benchmarkReturn.benchmarkLines}
                  showLegend={false}
                  xAxisType="number"
                  xAxisDataKey="dateMs"
                  xAxisTickFormatter={returnAxis?.tickFormatter}
                  xAxisTicks={returnAxis?.ticks}
                  xAxisDomain={returnXAxisDomain}
                  yAxisDomain={returnDomain}
                  yAxisTicks={returnYAxisTicks}
                  granularity={returnGranularity}
                  compact={compactValueChart}
                />
                <div className="portfolio-chart-legend portfolio-chart-legend-return" aria-label="Return chart legend">
                  <span className="portfolio-chart-legend-item">
                    <span className="portfolio-chart-legend-swatch portfolio-chart-legend-swatch-cumulative" />
                    Cumulative return
                  </span>
                  <span className="portfolio-chart-legend-item">
                    <span className="portfolio-chart-legend-swatch portfolio-chart-legend-swatch-gain" />
                    {granularityLabel(returnGranularity)} gain
                  </span>
                  <span className="portfolio-chart-legend-item">
                    <span className="portfolio-chart-legend-swatch portfolio-chart-legend-swatch-loss" />
                    {granularityLabel(returnGranularity)} loss
                  </span>
                  {benchmarkReturn.benchmarkLines.map((line) => (
                    <span className="portfolio-chart-legend-item" key={line.key}>
                      <span
                        className="portfolio-chart-legend-swatch portfolio-chart-legend-swatch-benchmark"
                        style={{ borderColor: line.color }}
                      />
                      {line.label}
                    </span>
                  ))}
                </div>
                {benchmarks.length ? (
                  <div className="portfolio-chart-compare" aria-label="Compare benchmarks">
                    <span className="portfolio-chart-compare-label">Compare</span>
                    <div className="portfolio-chart-compare-pills">
                      {benchmarks.map((benchmark) => {
                        const active = activeBenchmarkIds.includes(benchmark.id);
                        return (
                          <button
                            key={benchmark.id}
                            type="button"
                            className={`portfolio-chart-compare-pill${active ? " active" : ""}`}
                            style={{ "--benchmark-color": BENCHMARK_COLORS[benchmark.id] ?? "var(--muted-text)" } as React.CSSProperties}
                            onClick={() => toggleBenchmark(benchmark.id)}
                            aria-pressed={active}
                          >
                            <span className="portfolio-chart-compare-dot" aria-hidden="true" />
                            {benchmark.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : (
          <small>Not enough data yet to render this portfolio metric.</small>
        )}

        <div className="portfolio-core-metrics">
          <div className="metric-tile">
            <small>Return</small>
            <div className="metric-emphasis">{formatSignedPercent(summary.returnPct)}</div>
          </div>
          <div className="metric-tile">
            <small>Portfolio gain</small>
            <div className="metric-emphasis">{formatSignedEurForCard(summary.portfolioGainEur)}</div>
          </div>
          <div className="metric-tile market-close-tile">
            <small>Market close</small>
            <div className="metric-emphasis">{closeDateLabel}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
