"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
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
  Return: number | null;
  CumulativeReturn?: number | null;
  GainEur?: number | null;
  [key: string]: string | number | null | undefined;
};

export type ReturnPeriodGranularity = "year" | "month" | "day";

type PortfolioReturnBarChartProps = {
  data: PortfolioReturnBarPoint[];
  benchmarkLines?: Array<{ key: string; label: string; color: string }>;
  xAxisTickFormatter?: (value: number) => string;
  xAxisTicks?: number[];
  xAxisDomain?: [number, number];
  yAxisDomain?: [number, number];
  yAxisTicks?: number[];
  granularity: ReturnPeriodGranularity;
  xAxisDataKey?: string;
  xAxisType?: "number" | "category";
  showLegend?: boolean;
  compact?: boolean;
};

type HoveredPeriod = {
  index: number;
  x: number;
  y: number;
};

const TOOLTIP_WIDTH = 236;
const TOOLTIP_OFFSET = 12;
const TOOLTIP_MARGIN = 8;

function formatTooltipPercent(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatAxisPercent(value: number) {
  const rounded = Math.round(value);
  if (rounded === 0) return "0%";
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function granularityLabel(granularity: ReturnPeriodGranularity) {
  if (granularity === "day") return "Daily";
  if (granularity === "year") return "Yearly";
  return "Monthly";
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
  benchmarkLines = [],
  xAxisTickFormatter,
  xAxisTicks,
  xAxisDomain,
  yAxisDomain,
  yAxisTicks,
  granularity,
  xAxisDataKey = "date",
  xAxisType = "category",
  showLegend = true,
  compact = false
}: PortfolioReturnBarChartProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [hovered, setHovered] = useState<HoveredPeriod | null>(null);
  const tooltipBoundsRef = useRef<HTMLDivElement | null>(null);

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
  const compactMode = compact || isMobile;
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
  const renderCompactXAxisTick = (props: any) => {
    const { x, y, payload } = props;
    const value = typeof payload?.value === "number" ? payload.value : Number(payload?.value);
    const label = Number.isFinite(value) ? xTickFormatter(value) : "";
    if (!label) return <g />;

    const firstTick = xAxisTicks?.[0];
    const lastTick = xAxisTicks?.[xAxisTicks.length - 1];
    const anchor =
      value === firstTick
        ? "start"
        : value === lastTick
          ? "end"
          : "middle";

    return (
      <text x={x} y={y + 12} textAnchor={anchor} fill="var(--muted-text)" fontSize={9.5}>
        {label}
      </text>
    );
  };
  const tooltipStyle = useMemo(() => {
    if (!hovered) return null;
    const bounds = tooltipBoundsRef.current?.getBoundingClientRect();
    const containerWidth = bounds?.width && bounds.width > 0 ? bounds.width : 0;
    const containerHeight = bounds?.height && bounds.height > 0 ? bounds.height : 0;
    const shouldFlipLeft = containerWidth > 0 && hovered.x + TOOLTIP_OFFSET + TOOLTIP_WIDTH + TOOLTIP_MARGIN > containerWidth;
    const preferredLeft = shouldFlipLeft
      ? hovered.x - TOOLTIP_WIDTH - TOOLTIP_OFFSET
      : hovered.x + TOOLTIP_OFFSET;
    const maxLeft = containerWidth > 0 ? containerWidth - TOOLTIP_WIDTH - TOOLTIP_MARGIN : preferredLeft;
    const left = containerWidth > 0
      ? Math.max(TOOLTIP_MARGIN, Math.min(preferredLeft, maxLeft))
      : preferredLeft;
    const preferredTop = hovered.y - 56;
    const maxTop = containerHeight > 0 ? containerHeight - 132 - TOOLTIP_MARGIN : preferredTop;
    const top = containerHeight > 0
      ? Math.max(TOOLTIP_MARGIN, Math.min(preferredTop, maxTop))
      : Math.max(TOOLTIP_MARGIN, preferredTop);

    return {
      position: "absolute" as const,
      left,
      top,
      width: TOOLTIP_WIDTH,
      minWidth: TOOLTIP_WIDTH,
      pointerEvents: "none" as const,
      zIndex: 20
    };
  }, [hovered]);

  return (
    <ResponsiveChart>
      <div ref={tooltipBoundsRef} style={{ position: "relative", width: "100%", height: "100%" }}>
        <ResponsiveContainer>
          <ComposedChart
            data={data}
            margin={{ top: 10, right: compactMode ? 8 : 24, bottom: 10, left: 0 }}
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
              tick={compactMode ? renderCompactXAxisTick : { fontSize: isMobile ? 11 : 12 }}
              tickFormatter={xTickFormatter}
              ticks={xAxisTicks}
              interval={hasCustomTicks ? 0 : tickInterval}
              minTickGap={compactMode ? 72 : isMobile ? 42 : 56}
              tickMargin={8}
              height={40}
              allowDuplicatedCategory={false}
            />
            <YAxis
              domain={yAxisDomain}
              ticks={yAxisTicks}
              width={compactMode ? 30 : undefined}
              tick={{ fontSize: compactMode ? 9.5 : 12 }}
              tickMargin={compactMode ? 5 : undefined}
              tickFormatter={(value) => formatAxisPercent(Number(value))}
            />
            {activeXValue != null ? (
              <ReferenceLine x={activeXValue} stroke="var(--text)" strokeDasharray="2 2" strokeOpacity={0.6} />
            ) : null}
            <ReferenceLine y={0} stroke="var(--border-2)" strokeWidth={1} />
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
              name={`${granularityLabel(granularity)} return`}
              barSize={barSize}
              radius={[6, 6, 6, 6]}
              activeBar={false}
              isAnimationActive={false}
              opacity={0.28}
            >
              {data.map((row, idx) => (
                <Cell
                  key={`${row.date}-${idx}`}
                  fill={(row.Return ?? 0) >= 0 ? "var(--brand-accent)" : "var(--danger)"}
                />
              ))}
            </Bar>
            {benchmarkLines.map((benchmark) => (
              <Line
                key={benchmark.key}
                type="monotone"
                dataKey={benchmark.key}
                name={benchmark.label}
                stroke={benchmark.color}
                strokeWidth={1.8}
                strokeDasharray="5 4"
                dot={false}
                activeDot={{ r: 3, fill: benchmark.color, stroke: "var(--surface)", strokeWidth: 2 }}
                isAnimationActive={false}
                connectNulls
              />
            ))}
            <Line
              type="monotone"
              dataKey="CumulativeReturn"
              name="Cumulative return"
              stroke="var(--text)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "var(--text)", stroke: "var(--surface)", strokeWidth: 2 }}
              isAnimationActive={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
        {hoveredPoint && tooltipStyle ? (
          <div
            className="top-movers-tooltip portfolio-return-tooltip"
            style={tooltipStyle}
          >
            <div className="top-movers-tooltip-title">{formatPeriodLabel(hoveredPoint.date, granularity)}</div>
            {typeof hoveredPoint.Return === "number" && Number.isFinite(hoveredPoint.Return) ? (
              <div style={{ color: hoveredPoint.Return >= 0 ? "var(--brand-accent)" : "var(--danger)" }}>
                {granularityLabel(granularity)} return: {formatTooltipPercent(hoveredPoint.Return)}
              </div>
            ) : null}
            {typeof hoveredPoint.CumulativeReturn === "number" && Number.isFinite(hoveredPoint.CumulativeReturn) ? (
              <div style={{ color: "var(--text)" }}>
                Cumulative return: {formatTooltipPercent(hoveredPoint.CumulativeReturn)}
              </div>
            ) : null}
            {benchmarkLines.map((benchmark) => {
              const value = hoveredPoint[benchmark.key];
              return typeof value === "number" && Number.isFinite(value) ? (
                <div key={benchmark.key} style={{ color: benchmark.color }}>
                  {benchmark.label}: {formatTooltipPercent(value)}
                </div>
              ) : null;
            })}
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
