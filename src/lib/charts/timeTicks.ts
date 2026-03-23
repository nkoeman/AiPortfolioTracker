import { formatDateTick, type TickLabelMode } from "@/lib/charts/formatDateTick";

export type TimeWindow = "MAX" | "YTD" | "1Y" | "1M";
export type Tick = { value: number; label: string };

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addDaysUtc(value: Date, days: number) {
  return new Date(value.getTime() + days * ONE_DAY_MS);
}

function addMonthsUtc(value: Date, months: number) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1));
}

function addYearsUtc(value: Date, years: number) {
  return new Date(Date.UTC(value.getUTCFullYear() + years, 0, 1));
}

export function alignToMonthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function alignToMidMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 15));
}

export function alignToWeekStartMonday(date: Date) {
  const utc = startOfUtcDay(date);
  const day = utc.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  return addDaysUtc(utc, -diffToMonday);
}

export function alignToQuarterStart(date: Date) {
  const quarterMonth = Math.floor(date.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(date.getUTCFullYear(), quarterMonth, 1));
}

export function alignToYearStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
}

function normalizeRange(startDate: Date, endDate: Date) {
  const start = startOfUtcDay(startDate);
  const end = startOfUtcDay(endDate);
  if (start.getTime() <= end.getTime()) return { start, end };
  return { start: end, end: start };
}

function dedupeSorted(values: number[]) {
  const unique = Array.from(new Set(values));
  unique.sort((a, b) => a - b);
  return unique;
}

function ensureRangeTicks(ticks: number[], startMs: number, endMs: number) {
  const bounded = ticks.filter((tick) => tick >= startMs && tick <= endMs);
  const unique = dedupeSorted(bounded);
  if (unique.length >= 2) return unique;
  if (startMs === endMs) return [startMs];
  if (!unique.length) return [startMs, endMs];
  if (unique[0] !== startMs) unique.unshift(startMs);
  if (unique[unique.length - 1] !== endMs) unique.push(endMs);
  return dedupeSorted(unique);
}

function strideCompress(ticks: number[], maxTicks: number) {
  if (ticks.length <= maxTicks) return ticks;
  const stride = Math.max(2, Math.ceil(ticks.length / maxTicks));
  const result = ticks.filter((_, idx) => idx % stride === 0);
  const last = ticks[ticks.length - 1];
  if (result[result.length - 1] !== last && result.length < maxTicks) {
    result.push(last);
  }
  return result;
}

function generateDailyTicks(start: Date, end: Date) {
  const ticks: number[] = [];
  for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = addDaysUtc(cursor, 1)) {
    ticks.push(cursor.getTime());
  }
  return ticks;
}

function generateWeeklyMondayTicks(start: Date, end: Date) {
  const ticks: number[] = [];
  let cursor = alignToWeekStartMonday(start);
  if (cursor.getTime() < start.getTime()) cursor = addDaysUtc(cursor, 7);
  while (cursor.getTime() <= end.getTime()) {
    ticks.push(cursor.getTime());
    cursor = addDaysUtc(cursor, 7);
  }
  return ticks;
}

function generateSemiMonthlyTicks(start: Date, end: Date) {
  const ticks: number[] = [];
  let monthCursor = alignToMonthStart(start);
  while (monthCursor.getTime() <= end.getTime()) {
    const monthStart = alignToMonthStart(monthCursor);
    const midMonth = alignToMidMonth(monthCursor);
    if (monthStart.getTime() >= start.getTime() && monthStart.getTime() <= end.getTime()) {
      ticks.push(monthStart.getTime());
    }
    if (midMonth.getTime() >= start.getTime() && midMonth.getTime() <= end.getTime()) {
      ticks.push(midMonth.getTime());
    }
    monthCursor = addMonthsUtc(monthCursor, 1);
  }
  return ticks;
}

function generateMonthlyTicks(start: Date, end: Date, monthStep = 1) {
  const ticks: number[] = [];
  let cursor = alignToMonthStart(start);
  while (cursor.getTime() < start.getTime()) {
    cursor = addMonthsUtc(cursor, 1);
  }

  if (monthStep > 1) {
    let monthIndex = cursor.getUTCFullYear() * 12 + cursor.getUTCMonth();
    while (monthIndex % monthStep !== 0) {
      cursor = addMonthsUtc(cursor, 1);
      monthIndex = cursor.getUTCFullYear() * 12 + cursor.getUTCMonth();
    }
  }

  while (cursor.getTime() <= end.getTime()) {
    ticks.push(cursor.getTime());
    cursor = addMonthsUtc(cursor, monthStep);
  }
  return ticks;
}

function generateQuarterlyTicks(start: Date, end: Date) {
  const ticks: number[] = [];
  let cursor = alignToQuarterStart(start);
  while (cursor.getTime() < start.getTime()) {
    cursor = addMonthsUtc(cursor, 3);
  }
  while (cursor.getTime() <= end.getTime()) {
    ticks.push(cursor.getTime());
    cursor = addMonthsUtc(cursor, 3);
  }
  return ticks;
}

function generateYearlyTicks(start: Date, end: Date) {
  const ticks: number[] = [];
  let cursor = alignToYearStart(start);
  while (cursor.getTime() < start.getTime()) {
    cursor = addYearsUtc(cursor, 1);
  }
  while (cursor.getTime() <= end.getTime()) {
    ticks.push(cursor.getTime());
    cursor = addYearsUtc(cursor, 1);
  }
  return ticks;
}

function getMaxTickCount(chartWidthPx: number) {
  if (chartWidthPx < 420) return 6;
  if (chartWidthPx < 760) return 8;
  return 12;
}

export function computeTimeTicks(params: {
  startDate: Date;
  endDate: Date;
  window: TimeWindow;
  chartWidthPx: number;
  locale?: string;
  timeZone?: string;
}): Tick[] {
  const {
    startDate,
    endDate,
    window,
    chartWidthPx,
    locale = "en-GB",
    timeZone = "UTC"
  } = params;

  const { start, end } = normalizeRange(startDate, endDate);
  const startMs = start.getTime();
  const endMs = end.getTime();
  const spanDays = Math.max(1, Math.floor((endMs - startMs) / ONE_DAY_MS) + 1);
  const isMobile = chartWidthPx < 420;
  const widthBasedMaxTicks = getMaxTickCount(chartWidthPx);

  let mode: TickLabelMode = "month";
  let rawTicks: number[] = [];
  let maxTicks = widthBasedMaxTicks;

  if (spanDays <= 7) {
    mode = "day";
    rawTicks = generateDailyTicks(start, end);
    maxTicks = Math.min(widthBasedMaxTicks, 5);
  } else if (window === "1M") {
    if (isMobile && chartWidthPx < 360) {
      mode = "semi-month";
      rawTicks = generateSemiMonthlyTicks(start, end);
    } else {
      mode = "week";
      rawTicks = generateWeeklyMondayTicks(start, end);
    }
  } else if (window === "1Y" || window === "YTD") {
    mode = "month";
    rawTicks = generateMonthlyTicks(start, end, isMobile ? 2 : 1);
  } else {
    if (spanDays <= 365) {
      mode = "month";
      rawTicks = generateMonthlyTicks(start, end, 1);
    } else if (spanDays <= 365 * 3 + 1) {
      mode = "quarter";
      rawTicks = generateQuarterlyTicks(start, end);
    } else {
      mode = "year";
      rawTicks = generateYearlyTicks(start, end);
    }
  }

  const bounded = ensureRangeTicks(rawTicks, startMs, endMs);
  const compressed = strideCompress(bounded, maxTicks);
  const ticks = ensureRangeTicks(compressed, startMs, endMs);
  const rangeCrossesYear = start.getUTCFullYear() !== end.getUTCFullYear();
  const compactYearLabels = isMobile && mode === "year";

  return ticks.map((value) => ({
    value,
    label: formatDateTick({
      value,
      mode,
      locale,
      timeZone,
      rangeCrossesYear,
      compactYear: compactYearLabels
    })
  }));
}
