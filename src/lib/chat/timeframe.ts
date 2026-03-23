import { startOfDay } from "date-fns";
import {
  getPerformanceRangeCutoff,
  PERFORMANCE_RANGE_LABELS,
  type PerformanceRangeOption,
  usesWeeklyGranularity
} from "@/lib/charts/performanceRange";
import { getWeeklySeriesFromDaily } from "@/lib/valuation/portfolioSeries";

export type ChatTimeframe = PerformanceRangeOption;

export type PortfolioValueRow = {
  date: Date;
  valueEur: number;
  partialValuation?: boolean | null;
};

export type TimeframeSeriesPoint = {
  date: Date;
  valueEur: number;
  partialValuation: boolean;
};

export type TimeframeSeriesResult = {
  timeframe: ChatTimeframe;
  label: string;
  granularity: "DAILY" | "WEEKLY";
  startDate: Date | null;
  endDate: Date | null;
  points: TimeframeSeriesPoint[];
};

const CHAT_TIMEFRAMES: ChatTimeframe[] = ["max", "ytd", "1y", "1m"];

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object" && "toString" in value) {
    return Number(String(value));
  }
  return Number.NaN;
}

function normalizeRows(rows: PortfolioValueRow[]) {
  return rows
    .map((row) => ({
      date: startOfDay(row.date),
      valueEur: toNumber(row.valueEur),
      partialValuation: Boolean(row.partialValuation)
    }))
    .filter((row) => Number.isFinite(row.valueEur))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function parseChatTimeframe(value: unknown, fallback: ChatTimeframe = "max"): ChatTimeframe {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (CHAT_TIMEFRAMES.includes(normalized as ChatTimeframe)) {
    return normalized as ChatTimeframe;
  }
  return fallback;
}

export function getSeriesForTimeframe(rows: PortfolioValueRow[], timeframe: ChatTimeframe): TimeframeSeriesResult {
  const normalizedRows = normalizeRows(rows);
  if (!normalizedRows.length) {
    return {
      timeframe,
      label: PERFORMANCE_RANGE_LABELS[timeframe],
      granularity: usesWeeklyGranularity(timeframe) ? "WEEKLY" : "DAILY",
      startDate: null,
      endDate: null,
      points: []
    };
  }

  const latestDate = normalizedRows[normalizedRows.length - 1].date;
  const cutoff = timeframe === "max" ? null : startOfDay(getPerformanceRangeCutoff(latestDate, timeframe));
  const filteredRows = cutoff
    ? normalizedRows.filter((row) => row.date.getTime() >= cutoff.getTime())
    : normalizedRows;

  const points = usesWeeklyGranularity(timeframe)
    ? getWeeklySeriesFromDaily(filteredRows).map((row) => ({
        date: row.weekEndDate,
        valueEur: row.valueEur,
        partialValuation: row.partialValuation
      }))
    : filteredRows;

  return {
    timeframe,
    label: PERFORMANCE_RANGE_LABELS[timeframe],
    granularity: usesWeeklyGranularity(timeframe) ? "WEEKLY" : "DAILY",
    startDate: points[0]?.date ?? null,
    endDate: points.length ? points[points.length - 1].date : null,
    points
  };
}
