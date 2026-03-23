"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
  Cell
} from "recharts";
import { ResponsiveChart } from "@/components/ResponsiveChart";

export type PortfolioReturnBarPoint = {
  date: string;
  dateMs?: number;
  Return: number;
  GainEur?: number | null;
};

export type ReturnPeriodGranularity = "year" | "month" | "day";

type PortfolioReturnBarChartProps = {
  data: PortfolioReturnBarPoint[];
  xAxisTickFormatter?: (value: number) => string;
  xAxisTicks?: number[];
  xAxisDomain?: [number, number];
  yAxisDomain?: [number, number];
  yAxisTicks?: number[];
  granularity: ReturnPeriodGranularity;
  xAxisDataKey?: string;
  xAxisType?: "number" | "category";
  showLegend?: boolean;
};

type HoveredPeriod = {
  index: number;
  x: number;
  y: number;
};

function formatTooltipPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

const eurFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function formatTooltipEurAbs(value: number) {
  if (!Number.isFinite(value)) return "-";
  return eurFormatter.format(Math.abs(value));
}

function formatPeriodLabel(value: string, granularity: ReturnPeriodGranularity) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;

  const year = date.getUTCFullYear();
  if (granularity === "year") return String(year);

  const shortYear = String(year).slice(-2);
  const monthLong = date.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  if (granularity === "month") return `${monthLong} '${shortYear}`;

  const day = date.getUTCDate();
  const monthShort = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${day} ${monthShort} '${shortYear}`;
}

export function PortfolioReturnBarChart({
  data,
  xAxisTickFormatter,
  xAxisTicks,
  xAxisDomain,
  yAxisDomain,
  yAxisTicks,
  granularity,
  xAxisDataKey = "date",
  xAxisType = "category",
  showLegend = true
}: PortfolioReturnBarChartProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [hovered, setHovered] = useState<HoveredPeriod | null>(null);

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
  const barSize = useMemo(() => {
    if (!data.length) return 10;
    if (data.length <= 12) return 12;
    if (data.length <= 24) return 8;
    return 5;
  }, [data.length]);

  const activeDate =
    hovered !== null && hovered.index >= 0 && hovered.index < data.length ? data[hovered.index].date : null;
  const hoveredPoint =
    hovered !== null && hovered.index >= 0 && hovered.index < data.length ? data[hovered.index] : null;
  const activeXValue =
    hoveredPoint && xAxisDataKey in hoveredPoint
      ? (hoveredPoint[xAxisDataKey as keyof PortfolioReturnBarPoint] as string | number | null | undefined)
      : activeDate;
  const xTickFormatter = (value: string | number) => {
    if (!xAxisTickFormatter) return String(value);
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric)) return String(value);
    return xAxisTickFormatter(numeric);
  };

  return (
    <ResponsiveChart>
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <ResponsiveContainer>
          <BarChart
            data={data}
            margin={{ top: 10, right: 24, bottom: 10, left: 0 }}
            onMouseMove={(
              state: { activeTooltipIndex?: number | null; activeCoordinate?: { x?: number; y?: number } }
            ) => {
              const nextIndex =
                typeof state?.activeTooltipIndex === "number" && Number.isFinite(state.activeTooltipIndex)
                  ? state.activeTooltipIndex
                  : null;
              if (nextIndex === null) {
                setHovered((prev) => (prev === null ? prev : null));
                return;
              }

              const x = typeof state?.activeCoordinate?.x === "number" ? state.activeCoordinate.x : 0;
              const y = typeof state?.activeCoordinate?.y === "number" ? state.activeCoordinate.y : 0;
              setHovered((prev) =>
                prev && prev.index === nextIndex ? prev : { index: nextIndex, x, y }
              );
            }}
            onMouseLeave={() => setHovered((prev) => (prev === null ? prev : null))}
          >
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey={xAxisDataKey}
              type={xAxisType}
              domain={xAxisType === "number" ? (xAxisDomain ?? ["dataMin", "dataMax"]) : undefined}
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
              tickFormatter={(value) => `${Math.round(Number(value))}%`}
            />
            {activeXValue != null ? (
              <ReferenceLine x={activeXValue} stroke="var(--text)" strokeDasharray="2 2" strokeOpacity={0.6} />
            ) : null}
            <ReferenceLine y={0} stroke="var(--chart-grid)" strokeDasharray="3 3" />
            <Tooltip shared cursor={false} content={() => null} />
            {showLegend ? (
              <Legend
                verticalAlign={isMobile ? "bottom" : "top"}
                align="center"
                iconSize={isMobile ? 10 : 12}
                wrapperStyle={isMobile ? { paddingTop: 8, fontSize: 11 } : undefined}
              />
            ) : null}
            <Bar
              dataKey="Return"
              name="Return (%)"
              barSize={barSize}
              radius={[6, 6, 6, 6]}
              activeBar={false}
              isAnimationActive={false}
            >
              {data.map((row, idx) => (
                <Cell
                  key={`${row.date}-${idx}`}
                  fill={row.Return >= 0 ? "var(--brand-accent)" : "var(--danger)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {hoveredPoint ? (
          <div
            className="top-movers-tooltip"
            style={{
              position: "absolute",
              left: `${hovered?.x ?? 0}px`,
              top: `${Math.max(8, (hovered?.y ?? 0) - 56)}px`,
              transform: "translateX(12px)",
              pointerEvents: "none",
              zIndex: 20
            }}
          >
            <div className="top-movers-tooltip-title">{formatPeriodLabel(hoveredPoint.date, granularity)}</div>
            <div style={{ color: hoveredPoint.Return >= 0 ? "var(--brand-accent)" : "var(--danger)" }}>
              Return: {formatTooltipPercent(hoveredPoint.Return)}
            </div>
            <div style={{ color: (hoveredPoint.GainEur ?? 0) >= 0 ? "var(--brand-accent)" : "var(--danger)" }}>
              {(hoveredPoint.GainEur ?? 0) < 0 ? "Value lost: " : "Value gained: "}
              {typeof hoveredPoint.GainEur === "number" && Number.isFinite(hoveredPoint.GainEur)
                ? formatTooltipEurAbs(hoveredPoint.GainEur)
                : "-"}
            </div>
          </div>
        ) : null}
      </div>
    </ResponsiveChart>
  );
}
