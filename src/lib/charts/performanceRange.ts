import type { TimeWindow } from "@/lib/charts/timeTicks";

export type PerformanceRangeOption = "max" | "ytd" | "1y" | "1m";
export type ExtendedPerformanceRangeOption = PerformanceRangeOption | "3m";

export const PERFORMANCE_RANGE_LABELS: Record<ExtendedPerformanceRangeOption, string> = {
  max: "Max",
  ytd: "YTD",
  "1y": "1Y",
  "1m": "1M",
  "3m": "3M"
};

export function getPerformanceTimeWindow(range: ExtendedPerformanceRangeOption): TimeWindow {
  if (range === "max") return "MAX";
  if (range === "ytd") return "YTD";
  if (range === "1y") return "1Y";
  if (range === "3m") return "1Y";
  return "1M";
}

export function getPerformanceRangeCutoff(latestDate: Date, range: ExtendedPerformanceRangeOption): Date {
  if (range === "1m") {
    const cutoff = new Date(latestDate.getTime());
    cutoff.setUTCMonth(cutoff.getUTCMonth() - 1);
    return cutoff;
  }
  if (range === "3m") {
    const cutoff = new Date(latestDate.getTime());
    cutoff.setUTCMonth(cutoff.getUTCMonth() - 3);
    return cutoff;
  }
  if (range === "1y") {
    const cutoff = new Date(latestDate.getTime());
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
    return cutoff;
  }
  return new Date(Date.UTC(latestDate.getUTCFullYear(), 0, 1));
}

export function usesWeeklyGranularity(range: ExtendedPerformanceRangeOption) {
  return range === "max" || range === "ytd" || range === "1y";
}
