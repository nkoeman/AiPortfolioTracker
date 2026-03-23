"use client";

import { useEffect, useId, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine
} from "recharts";
import { ResponsiveChart } from "@/components/ResponsiveChart";

export type PortfolioChartPoint = {
  date: string;
  [currency: string]: string | number | null | undefined;
};

type PortfolioChartProps = {
  data: PortfolioChartPoint[];
  currencies: string[];
  valueFormatter?: (value: number, name: string) => string | [string, string];
  yAxisTickFormatter?: (value: number) => string;
  yAxisDomain?: [number, number];
  yAxisTicks?: number[];
  xAxisTickFormatter?: (value: number) => string;
  xAxisTicks?: number[];
  xAxisDataKey?: string;
  xAxisType?: "number" | "category";
  showLegend?: boolean;
};

function computeZeroOffset(min: number, max: number) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return 1;
  if (max <= 0) return 0;
  if (min >= 0) return 1;
  return max / (max - min);
}

function computeRedStartOffset(zeroOffset: number) {
  if (zeroOffset <= 0 || zeroOffset >= 1) return zeroOffset;
  // Keep zero and a narrow band below it green so the transition does not bleed into zero.
  return Math.min(1, Math.max(0, zeroOffset + 0.015));
}

function formatTooltipDate(value: unknown) {
  let date: Date | null = null;

  if (typeof value === "number" && Number.isFinite(value)) {
    date = new Date(value);
  } else if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      date = new Date(`${value}T00:00:00.000Z`);
    } else {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        date = new Date(numeric);
      }
    }
  }

  if (!date || Number.isNaN(date.getTime())) return String(value ?? "");

  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    timeZone: "UTC"
  }).formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  return `${day} ${month} '${year}`;
}

// Plots portfolio value over time with separate lines per currency bucket.
export function PortfolioChart({
  data,
  currencies,
  valueFormatter,
  yAxisTickFormatter,
  yAxisDomain,
  yAxisTicks,
  xAxisTickFormatter,
  xAxisTicks,
  xAxisDataKey = "date",
  xAxisType = "category",
  showLegend = true
}: PortfolioChartProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const targetTickCount = isMobile ? 4 : 8;
  const tickInterval = Math.max(0, Math.ceil(data.length / targetTickCount) - 1);
  const hasCustomTicks = Boolean(xAxisTicks?.length);
  const gradientBaseId = useId().replace(/:/g, "");
  const xTickFormatter = (value: string | number) => {
    if (!xAxisTickFormatter) return String(value);
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric)) return String(value);
    return xAxisTickFormatter(numeric);
  };
  const tooltipLabelFormatter = (label: unknown, payload: Array<{ payload?: { date?: unknown } }> = []) => {
    const pointDate = payload[0]?.payload?.date;
    if (pointDate !== undefined) {
      return formatTooltipDate(pointDate);
    }
    return formatTooltipDate(label);
  };

  const zeroOffset = useMemo(() => {
    const explicitMin = yAxisDomain?.[0];
    const explicitMax = yAxisDomain?.[1];
    if (explicitMin !== undefined && explicitMax !== undefined) {
      return computeZeroOffset(explicitMin, explicitMax);
    }

    const values: number[] = [];
    for (const row of data) {
      for (const currency of currencies) {
        if (currency === "Invested") continue;
        const value = row[currency];
        if (typeof value === "number" && Number.isFinite(value)) {
          values.push(value);
        }
      }
    }
    if (!values.length) return 1;
    return computeZeroOffset(Math.min(...values), Math.max(...values));
  }, [currencies, data, yAxisDomain]);
  const redStartOffset = useMemo(() => computeRedStartOffset(zeroOffset), [zeroOffset]);
  const nonNegativeSeries = useMemo(() => {
    const next = new Map<string, boolean>();
    for (const currency of currencies) {
      if (currency === "Invested") continue;
      let hasValue = false;
      let hasNegative = false;
      for (const row of data) {
        const value = row[currency];
        if (typeof value !== "number" || !Number.isFinite(value)) continue;
        hasValue = true;
        if (value < 0) {
          hasNegative = true;
          break;
        }
      }
      next.set(currency, hasValue && !hasNegative);
    }
    return next;
  }, [currencies, data]);

  const seriesLabel = (currency: string) =>
    currency === "Invested"
      ? "Invested"
      : currency === "Index"
        ? "Index"
        : currency === "ReturnEur"
          ? "Return (\u20AC)"
          : `Value (${currency})`;

  return (
    <ResponsiveChart>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 24, bottom: 10, left: 0 }}>
          <defs>
            <linearGradient id={`${gradientBaseId}-positive-negative`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand-accent)" />
              <stop offset={`${zeroOffset * 100}%`} stopColor="var(--brand-accent)" />
              <stop offset={`${redStartOffset * 100}%`} stopColor="var(--danger)" />
              <stop offset="100%" stopColor="var(--danger)" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey={xAxisDataKey}
            type={xAxisType}
            domain={xAxisType === "number" ? ["dataMin", "dataMax"] : undefined}
            scale={xAxisType === "number" ? "time" : "auto"}
            tick={{ fontSize: isMobile ? 11 : 12 }}
            tickFormatter={xTickFormatter}
            ticks={xAxisTicks}
            interval={hasCustomTicks ? 0 : tickInterval}
            minTickGap={isMobile ? 42 : 56}
            tickMargin={8}
            height={40}
            allowDuplicatedCategory={false}
          />
          <YAxis
            domain={yAxisDomain}
            ticks={yAxisTicks}
            tick={{ fontSize: 12 }}
            tickFormatter={yAxisTickFormatter}
          />
          <ReferenceLine y={0} stroke="var(--chart-grid)" strokeDasharray="3 3" />
          <Tooltip
            content={(props: any) => {
              const { active, label, payload } = props as {
                active?: boolean;
                label?: unknown;
                payload?: Array<{
                  value?: number | string;
                  name?: string;
                  color?: string;
                  dataKey?: string | number;
                  payload?: { date?: unknown };
                }>;
              };
              if (!active || !payload?.length) return null;

              const title = tooltipLabelFormatter(
                label,
                payload.map((entry) => ({ payload: entry.payload }))
              );

              return (
                <div className="top-movers-tooltip">
                  <div className="top-movers-tooltip-title">{title}</div>
                  {payload.map((entry, idx) => {
                    const rawName = entry.name ?? "";
                    const numericValue =
                      typeof entry.value === "number" ? entry.value : Number(entry.value);
                    const formatted =
                      Number.isFinite(numericValue) && valueFormatter
                        ? valueFormatter(numericValue, rawName)
                        : Number.isFinite(numericValue)
                          ? `${numericValue.toFixed(2)}`
                          : String(entry.value ?? "-");

                    const [displayValue, displayName] = Array.isArray(formatted)
                      ? formatted
                      : [formatted, rawName];
                    const isInvested = entry.dataKey === "Invested" || rawName === "Invested";
                    const fallbackColor =
                      Number.isFinite(numericValue) && numericValue < 0 ? "var(--danger)" : "var(--brand-accent)";
                    const entryColor =
                      typeof entry.color === "string" && !entry.color.startsWith("url(")
                        ? entry.color
                        : fallbackColor;

                    return (
                      <div
                        key={`${rawName}-${idx}`}
                        style={{ color: isInvested ? "var(--text)" : entryColor }}
                      >
                        {displayName}: {displayValue}
                      </div>
                    );
                  })}
                </div>
              );
            }}
          />
          {showLegend ? (
            <Legend
              verticalAlign={isMobile ? "bottom" : "top"}
              align="center"
              iconSize={isMobile ? 10 : 12}
              wrapperStyle={isMobile ? { paddingTop: 8, fontSize: 11 } : undefined}
            />
          ) : null}
          {currencies.map((currency) => (
            <Line
              key={currency}
              type="monotone"
              dataKey={currency}
              name={seriesLabel(currency)}
              stroke={
                currency === "Invested"
                  ? "var(--muted-text)"
                  : nonNegativeSeries.get(currency)
                    ? "var(--brand-accent)"
                    : `url(#${gradientBaseId}-positive-negative)`
              }
              strokeWidth={2}
              strokeDasharray={currency === "Invested" ? "4 4" : undefined}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ResponsiveChart>
  );
}
