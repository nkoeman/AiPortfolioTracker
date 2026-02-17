"use client";

import { useMemo, useState } from "react";
import { PortfolioChart, type PortfolioChartPoint } from "@/components/PortfolioChart";

type PortfolioValueCardProps = {
  weeklyValueData: PortfolioChartPoint[];
  dailyValueData: PortfolioChartPoint[];
  weeklyReturnData: PortfolioChartPoint[];
  dailyReturnData: PortfolioChartPoint[];
};

type RangeOption = "max" | "1y" | "1m" | "ytd";
type MetricOption = "value" | "return";

const RANGE_LABELS: Record<RangeOption, string> = {
  max: "Max",
  "1y": "1Y",
  "1m": "1M",
  ytd: "YTD"
};
const METRIC_LABELS: Record<MetricOption, string> = {
  value: "Value (EUR)",
  return: "Return (%)"
};

function formatPercent(value: number, name: string) {
  const label = name === "Return" ? "Organic return (excl. deposits/withdrawals)" : name;
  return [`${value.toFixed(2)}%`, label] as [string, string];
}

function formatDateTick(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  const day = date.getUTCDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[date.getUTCMonth()];
  const year = String(date.getUTCFullYear()).slice(-2);
  return `${day} ${month} '${year}`;
}

function formatThousandsTick(value: number) {
  if (!Number.isFinite(value)) return "";
  return `${Math.round(value / 1000)}K`;
}

function toDate(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function shiftMonths(value: Date, months: number) {
  const shifted = new Date(value.getTime());
  shifted.setUTCMonth(shifted.getUTCMonth() + months);
  return shifted;
}

function shiftYears(value: Date, years: number) {
  const shifted = new Date(value.getTime());
  shifted.setUTCFullYear(shifted.getUTCFullYear() + years);
  return shifted;
}

function computeValueDomain(data: PortfolioChartPoint[], keys: string[]) {
  const values: number[] = [];
  for (const point of data) {
    for (const key of keys) {
      const raw = point[key];
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

export function PortfolioValueCard({
  weeklyValueData,
  dailyValueData,
  weeklyReturnData,
  dailyReturnData
}: PortfolioValueCardProps) {
  const [range, setRange] = useState<RangeOption>("max");
  const [metric, setMetric] = useState<MetricOption>("value");

  const chartData = useMemo(() => {
    const source = range === "1m"
      ? metric === "value"
        ? dailyValueData
        : dailyReturnData
      : metric === "value"
        ? weeklyValueData
        : weeklyReturnData;

    if (!source.length || range === "max") {
      return source;
    }

    const latestDate = toDate(source[source.length - 1].date);
    if (!latestDate) return source;

    let cutoff: Date;
    if (range === "1m") {
      cutoff = shiftMonths(latestDate, -1);
    } else if (range === "1y") {
      cutoff = shiftYears(latestDate, -1);
    } else {
      cutoff = new Date(Date.UTC(latestDate.getUTCFullYear(), 0, 1));
    }

    return source.filter((point) => {
      const pointDate = toDate(point.date);
      return pointDate ? pointDate.getTime() >= cutoff.getTime() : false;
    });
  }, [range, metric, weeklyValueData, weeklyReturnData, dailyValueData, dailyReturnData]);

  const valueDomain = useMemo(
    () => (metric === "value" ? computeValueDomain(chartData, ["EUR", "Invested"]) : undefined),
    [metric, chartData]
  );

  const hasSeries = chartData.length >= 2;

  return (
    <div className="card stack">
      <div className="row">
        <div>
          <div className="section-title">Value Overview</div>
          <h2>Portfolio performance</h2>
        </div>
        <div className="row row-tight">
          <div className="minw-160">
            <label className="section-title" htmlFor="portfolio-range">
              Range
            </label>
            <select
              id="portfolio-range"
              value={range}
              onChange={(event) => setRange(event.target.value as RangeOption)}
            >
              {Object.entries(RANGE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="minw-160">
            <label className="section-title" htmlFor="portfolio-metric">
              Metric
            </label>
            <select
              id="portfolio-metric"
              value={metric}
              onChange={(event) => setMetric(event.target.value as MetricOption)}
            >
              {Object.entries(METRIC_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      {hasSeries ? (
        metric === "value" ? (
          <PortfolioChart
            data={chartData}
            currencies={["EUR", "Invested"]}
            yAxisDomain={valueDomain}
            yAxisTickFormatter={formatThousandsTick}
            xAxisTickFormatter={formatDateTick}
          />
        ) : (
          <PortfolioChart
            data={chartData}
            currencies={["Return"]}
            valueFormatter={formatPercent}
            yAxisTickFormatter={(value) => `${value}%`}
            xAxisTickFormatter={formatDateTick}
          />
        )
      ) : (
        <small>Not enough data yet to render the portfolio value series.</small>
      )}
      <small>
        Value shown in green, invested capital in dotted line. Return excludes external cash flows.
      </small>
    </div>
  );
}
