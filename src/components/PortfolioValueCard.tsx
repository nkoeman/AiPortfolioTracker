"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PortfolioChart, type PortfolioChartPoint } from "@/components/PortfolioChart";
import {
  PortfolioReturnBarChart,
  type PortfolioReturnBarPoint,
  type ReturnPeriodGranularity
} from "@/components/PortfolioReturnBarChart";
import { SelectMenu } from "@/components/SelectMenu";
import {
  getPerformanceRangeCutoff,
  getPerformanceTimeWindow,
  PERFORMANCE_RANGE_LABELS,
  type PerformanceRangeOption,
  usesWeeklyGranularity
} from "@/lib/charts/performanceRange";
import { computeTimeTicks, type TimeWindow } from "@/lib/charts/timeTicks";

type PortfolioValueCardProps = {
  dailyValueData: PortfolioChartPoint[];
};

type RangeOption = PerformanceRangeOption;
type MetricOption = "value" | "index" | "return" | "returnEur";

type TimeAxisConfig = {
  ticks: number[];
  tickFormatter: (value: number) => string;
};

const RANGE_LABELS = PERFORMANCE_RANGE_LABELS;

const METRIC_LABELS: Record<MetricOption, string> = {
  value: "Value (EUR)",
  index: "Index",
  return: "Return (%)",
  returnEur: "Return (\u20AC)"
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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

function formatIndexTick(value: number) {
  if (!Number.isFinite(value)) return "";
  return Math.round(value).toString();
}

function formatIndexPoints(value: number, name: string) {
  const label = name === "Index" ? "Index (points)" : name;
  return [`${value.toFixed(2)} pts`, label] as [string, string];
}

const eurFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function formatValueEurPoints(value: number, name: string) {
  const label = name === "EUR" ? "Value (EUR)" : name === "Invested" ? "Invested" : name;
  return [eurFormatter.format(value), label] as [string, string];
}

function formatSignedEur(value: number) {
  if (!Number.isFinite(value)) return "-";
  if (value > 0) return `+${eurFormatter.format(value)}`;
  return eurFormatter.format(value);
}

function formatReturnEurPoints(value: number, name: string) {
  const label = name === "ReturnEur" ? "Return (\u20AC)" : name;
  return [formatSignedEur(value), label] as [string, string];
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

function buildTimeAxisConfig(
  data: Array<{ date: string; dateMs?: number }>,
  window: TimeWindow,
  chartWidthPx: number,
  axisRangeSource?: Array<{ date: string; dateMs?: number }>
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
    const startMs = Date.UTC(year, 0, 1);
    const anchorMs = Date.UTC(year, 5, 30, 12, 0, 0, 0);
    return { key: String(year), startDate, startMs, anchorMs };
  }

  if (granularity === "month") {
    const monthIdx = Number(month) - 1;
    const startMs = Date.UTC(year, monthIdx, 1);
    const nextStartMs = Date.UTC(year, monthIdx + 1, 1);
    const anchorMs = startMs + Math.floor((nextStartMs - startMs) / 2);
    const startDate = `${year}-${month}-01`;
    return { key: `${year}-${month}`, startDate, startMs, anchorMs };
  }

  const startDate = `${year}-${month}-${day}`;
  const startMs = Date.UTC(year, Number(month) - 1, Number(day));
  return {
    key: `${year}-${month}-${day}`,
    startDate,
    startMs,
    anchorMs: startMs
  };
}

function getNumericField(point: PortfolioChartPoint, key: "EUR" | "Invested" | "PeriodReturnPct") {
  const raw = point[key];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

function buildReturnSeries(
  source: PortfolioChartPoint[],
  granularity: ReturnPeriodGranularity
): PortfolioReturnBarPoint[] {
  const sorted = sortByDateAsc(source);
  if (!sorted.length) return [];

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
    const dailyPoints: PortfolioReturnBarPoint[] = [];
    for (const { point, organicGainEur } of withDailyOrganic) {
      const raw = getNumericField(point, "PeriodReturnPct");
      if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
      const parsed = toDate(point.date);
      if (!parsed) continue;
      dailyPoints.push({
        date: point.date,
        dateMs: parsed.getTime(),
        Return: Number(raw.toFixed(6)),
        GainEur: organicGainEur
      });
    }
    return dailyPoints;
  }

  const points: PortfolioReturnBarPoint[] = [];
  let activeKey: string | null = null;
  let activeDate = "";
  let activeDateMs = 0;
  let compoundedGrowth = 1;
  let hasReturnData = false;
  let organicGainEurTotal = 0;
  let hasOrganicGain = false;

  const flush = () => {
    if (!activeKey || !hasReturnData) return;
    points.push({
      date: activeDate,
      dateMs: activeDateMs,
      Return: Number(((compoundedGrowth - 1) * 100).toFixed(6)),
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
    }

    const raw = getNumericField(point, "PeriodReturnPct");
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
    compoundedGrowth *= 1 + raw / 100;
    hasReturnData = true;

    if (typeof row.organicGainEur === "number" && Number.isFinite(row.organicGainEur)) {
      organicGainEurTotal += row.organicGainEur;
      hasOrganicGain = true;
    }
  }

  flush();
  return points;
}

function buildCumulativeReturnEurSeries(source: PortfolioChartPoint[]) {
  const sorted = sortByDateAsc(source);
  const points = sorted
    .map((point) => {
      const raw = point.ReturnEur;
      if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
      const parsed = toDate(point.date);
      if (!parsed) return null;
      return { date: point.date, dateMs: parsed.getTime(), ReturnEur: raw };
    })
    .filter((point): point is { date: string; dateMs: number; ReturnEur: number } => point !== null);

  if (!points.length) return [] as PortfolioChartPoint[];
  const baseline = points[0].ReturnEur;

  return points.map((point) => ({
    date: point.date,
    dateMs: point.dateMs,
    ReturnEur: Number((point.ReturnEur - baseline).toFixed(8))
  }));
}

export function PortfolioValueCard({ dailyValueData }: PortfolioValueCardProps) {
  const [range, setRange] = useState<RangeOption>("max");
  const [metric, setMetric] = useState<MetricOption>("value");
  const [chartRef, chartWidth] = useObservedWidth<HTMLDivElement>();
  const effectiveChartWidth = chartWidth > 0 ? chartWidth : 900;

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

  const chartWindow = useMemo(() => getPerformanceTimeWindow(range), [range]);
  const valueSeries = useMemo(
    () => (usesWeeklyGranularity(range) ? toWeeklySeries(rangeSeries) : rangeSeries),
    [range, rangeSeries]
  );
  const indexSeries = useMemo(
    () => (usesWeeklyGranularity(range) ? toWeeklySeries(rangeSeries) : rangeSeries),
    [range, rangeSeries]
  );

  const returnGranularity = useMemo(() => getReturnGranularityForRange(range), [range]);
  const returnSeries = useMemo(
    () => buildReturnSeries(rangeSeries, returnGranularity),
    [rangeSeries, returnGranularity]
  );
  const returnEurSeries = useMemo(
    () => buildCumulativeReturnEurSeries(rangeSeries),
    [rangeSeries]
  );
  const returnEurDisplaySeries = useMemo(
    () => (usesWeeklyGranularity(range) ? toWeeklySeries(returnEurSeries) : returnEurSeries),
    [range, returnEurSeries]
  );

  const valueAxis = useMemo(
    () => buildTimeAxisConfig(valueSeries, chartWindow, effectiveChartWidth),
    [valueSeries, chartWindow, effectiveChartWidth]
  );
  const indexAxis = useMemo(
    () => buildTimeAxisConfig(indexSeries, chartWindow, effectiveChartWidth),
    [indexSeries, chartWindow, effectiveChartWidth]
  );
  const returnAxis = useMemo(
    () => buildTimeAxisConfig(returnSeries, chartWindow, effectiveChartWidth, rangeSeries),
    [returnSeries, chartWindow, effectiveChartWidth, rangeSeries]
  );
  const returnXAxisDomain = useMemo(
    () => getSeriesBounds(rangeSeries),
    [rangeSeries]
  );
  const returnEurAxis = useMemo(
    () => buildTimeAxisConfig(returnEurDisplaySeries, chartWindow, effectiveChartWidth),
    [returnEurDisplaySeries, chartWindow, effectiveChartWidth]
  );

  const valueDomain = useMemo(
    () => (metric === "value" ? computeValueDomain(valueSeries, ["EUR", "Invested"]) : undefined),
    [metric, valueSeries]
  );
  const indexDomain = useMemo(
    () => (metric === "index" ? computeValueDomain(indexSeries, ["Index"]) : undefined),
    [metric, indexSeries]
  );
  const returnDomain = useMemo(
    () => (metric === "return" ? computeDomainIncludingZero(returnSeries, ["Return"]) : undefined),
    [metric, returnSeries]
  );
  const returnEurDomain = useMemo(
    () =>
      metric === "returnEur"
        ? computeDomainIncludingZero(returnEurDisplaySeries, ["ReturnEur"])
        : undefined,
    [metric, returnEurDisplaySeries]
  );

  const valueTicks = useMemo(
    () => (metric === "value" ? buildLinearTicks(valueDomain, { targetTicks: 6 }) : undefined),
    [metric, valueDomain]
  );
  const indexTicks = useMemo(
    () => (metric === "index" ? buildLinearTicks(indexDomain, { targetTicks: 6 }) : undefined),
    [metric, indexDomain]
  );
  const returnYAxisTicks = useMemo(
    () => (metric === "return" ? buildLinearTicks(returnDomain, { targetTicks: 6 }) : undefined),
    [metric, returnDomain]
  );
  const returnEurTicks = useMemo(
    () => (metric === "returnEur" ? buildLinearTicks(returnEurDomain, { targetTicks: 6 }) : undefined),
    [metric, returnEurDomain]
  );

  const hasSeries =
    metric === "return"
      ? returnSeries.length >= 1
      : metric === "value"
        ? valueSeries.length >= 2
        : metric === "index"
          ? indexSeries.length >= 2
          : returnEurDisplaySeries.length >= 2;

  return (
    <div className="card stack portfolio-performance-card">
      <div className="row">
        <div>
          <div className="section-title">Value Overview</div>
          <h2>Portfolio performance</h2>
        </div>
        <div className="row row-tight portfolio-performance-controls">
          <div className="minw-160 portfolio-control">
            <SelectMenu
              id="portfolio-range"
              ariaLabel="Range"
              value={range}
              options={Object.entries(RANGE_LABELS).map(([value, label]) => ({ value, label }))}
              onChange={(nextValue) => setRange(nextValue as RangeOption)}
            />
          </div>
          <div className="minw-160 portfolio-control">
            <SelectMenu
              id="portfolio-metric"
              ariaLabel="Metric"
              value={metric}
              options={Object.entries(METRIC_LABELS).map(([value, label]) => ({ value, label }))}
              onChange={(nextValue) => setMetric(nextValue as MetricOption)}
            />
          </div>
        </div>
      </div>
      {hasSeries ? (
        <div className="portfolio-performance-chart" ref={chartRef}>
          {metric === "value" ? (
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
            />
          ) : metric === "index" ? (
            <PortfolioChart
              data={indexSeries}
              currencies={["Index"]}
              showLegend={false}
              valueFormatter={formatIndexPoints}
              yAxisTickFormatter={formatIndexTick}
              yAxisDomain={indexDomain}
              yAxisTicks={indexTicks}
              xAxisType="number"
              xAxisDataKey="dateMs"
              xAxisTickFormatter={indexAxis?.tickFormatter}
              xAxisTicks={indexAxis?.ticks}
            />
          ) : metric === "returnEur" ? (
            <PortfolioChart
              data={returnEurDisplaySeries}
              currencies={["ReturnEur"]}
              showLegend={false}
              valueFormatter={formatReturnEurPoints}
              yAxisTickFormatter={formatEurThousandsTick}
              yAxisDomain={returnEurDomain}
              yAxisTicks={returnEurTicks}
              xAxisType="number"
              xAxisDataKey="dateMs"
              xAxisTickFormatter={returnEurAxis?.tickFormatter}
              xAxisTicks={returnEurAxis?.ticks}
            />
          ) : (
            <PortfolioReturnBarChart
              data={returnSeries}
              showLegend={false}
              xAxisType="number"
              xAxisDataKey="dateMs"
              xAxisTickFormatter={returnAxis?.tickFormatter}
              xAxisTicks={returnAxis?.ticks}
              xAxisDomain={returnXAxisDomain}
              yAxisDomain={returnDomain}
              yAxisTicks={returnYAxisTicks}
              granularity={returnGranularity}
            />
          )}
        </div>
      ) : (
        <small>Not enough data yet to render this portfolio metric.</small>
      )}
    </div>
  );
}
