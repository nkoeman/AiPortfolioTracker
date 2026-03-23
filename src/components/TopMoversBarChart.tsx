"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
  Cell,
  LabelList
} from "recharts";
import type { RecentPerformanceContributor } from "@/lib/dashboard/recentPerformance";

export type TopMoverRow = {
  name: string;
  isin: string;
  contributionEur: number;
  side: "GAIN" | "LOSS";
  contributionPctOfMove: number | null;
};

const eurFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function buildTopMoversData(
  topGainers: RecentPerformanceContributor[],
  topLosers: RecentPerformanceContributor[]
): TopMoverRow[] {
  const gainers = [...topGainers]
    .filter((row) => Number.isFinite(row.contributionEur) && row.contributionEur > 0)
    .sort((a, b) => b.contributionEur - a.contributionEur)
    .map((row) => ({
      name: row.instrumentName,
      isin: row.isin,
      contributionEur: row.contributionEur,
      side: "GAIN" as const,
      contributionPctOfMove: row.contributionPctOfMove
    }));

  const losers = [...topLosers]
    .filter((row) => Number.isFinite(row.contributionEur) && row.contributionEur < 0)
    .sort((a, b) => b.contributionEur - a.contributionEur)
    .map((row) => ({
      name: row.instrumentName,
      isin: row.isin,
      contributionEur: row.contributionEur,
      side: "LOSS" as const,
      contributionPctOfMove: row.contributionPctOfMove
    }));

  return [...gainers, ...losers];
}

export function computeTopMoversDomain(rows: TopMoverRow[]): [number, number] {
  if (!rows.length) return [-1, 1];
  const maxAbs = Math.max(...rows.map((row) => Math.abs(row.contributionEur)));
  const safe = Number.isFinite(maxAbs) && maxAbs > 0 ? maxAbs : 1;
  return [-safe, safe];
}

function computeNiceStep(rawStep: number) {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;
  const exponent = Math.floor(Math.log10(rawStep));
  const magnitude = 10 ** exponent;
  const normalized = rawStep / magnitude;
  if (normalized <= 1) return 1 * magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 6) return 5 * magnitude;
  return 10 * magnitude;
}

export function computeTopMoversTicks(domain: [number, number]): number[] {
  const maxAbs = Math.max(Math.abs(domain[0]), Math.abs(domain[1]));
  if (!Number.isFinite(maxAbs) || maxAbs <= 0) return [0];
  const step = computeNiceStep(maxAbs / 4);
  const multiples = Math.max(1, Math.floor(maxAbs / step));
  const ticks: number[] = [];
  for (let i = -multiples; i <= multiples; i += 1) {
    ticks.push(Number((i * step).toFixed(8)));
  }
  if (!ticks.includes(0)) ticks.push(0);
  return Array.from(new Set(ticks)).sort((a, b) => a - b);
}

function formatAxisEur(value: number) {
  if (!Number.isFinite(value)) return "-";
  const rounded = Math.round(Math.abs(value));
  const amount = `€${rounded.toLocaleString("en-GB")}`;
  return value < 0 ? `-${amount}` : amount;
}

function formatSignedEur(value: number) {
  if (!Number.isFinite(value)) return "-";
  if (value > 0) return `+${eurFormatter.format(value)}`;
  return eurFormatter.format(value);
}

function splitLabelToTwoLines(value: string, maxChars = 24): [string, string?] {
  const clean = String(value || "").trim();
  if (!clean) return [""];
  if (clean.length <= maxChars) return [clean];

  const words = clean.split(/\s+/);
  let lineOne = "";
  let lineTwo = "";
  for (const word of words) {
    const candidate = lineOne ? `${lineOne} ${word}` : word;
    if (candidate.length <= maxChars) {
      lineOne = candidate;
      continue;
    }
    lineTwo = lineTwo ? `${lineTwo} ${word}` : word;
  }

  if (!lineTwo) {
    return [clean.slice(0, maxChars), `${clean.slice(maxChars, maxChars * 2)}${clean.length > maxChars * 2 ? "..." : ""}`];
  }

  if (lineTwo.length > maxChars) {
    lineTwo = `${lineTwo.slice(0, Math.max(0, maxChars - 3))}...`;
  }

  return [lineOne, lineTwo];
}

function renderNameTick(
  props: { x?: number | string; y?: number | string; payload?: { value?: string } },
  maxChars: number
) {
  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const raw = props.payload?.value ?? "";
  if (!Number.isFinite(x) || !Number.isFinite(y)) return <g />;
  const [lineOne, lineTwo] = splitLabelToTwoLines(String(raw), maxChars);

  return (
    <text x={x - 8} y={y} textAnchor="end" fill="var(--text)" fontSize={12}>
      <tspan x={x - 8} dy={lineTwo ? -2 : 4}>
        {lineOne}
      </tspan>
      {lineTwo ? (
        <tspan x={x - 8} dy={14}>
          {lineTwo}
        </tspan>
      ) : null}
    </text>
  );
}

function renderValueLabel(props: {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  value?: number | string;
}) {
  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const width = Number(props.width ?? 0);
  const height = Number(props.height ?? 0);
  const value = Number(props.value);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }
  if (!Number.isFinite(value)) return null;

  const isGain = value >= 0;
  const posX = isGain ? x + width + 8 : x - 8;

  return (
    <text
      x={posX}
      y={y + height / 2}
      dy={4}
      textAnchor={isGain ? "start" : "end"}
      fill="var(--muted-text)"
      fontSize={12}
    >
      {formatSignedEur(value)}
    </text>
  );
}

function MoversTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: Array<{ payload: TopMoverRow; value: number }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="top-movers-tooltip">
      <div className="top-movers-tooltip-title">{row.name}</div>
      <small>{row.isin}</small>
      <div>{formatSignedEur(row.contributionEur)}</div>
      {row.contributionPctOfMove !== null ? (
        <small>{(row.contributionPctOfMove * 100).toFixed(2)}% of move</small>
      ) : null}
    </div>
  );
}

type TopMoversBarChartProps = {
  topGainers: RecentPerformanceContributor[];
  topLosers: RecentPerformanceContributor[];
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

export function TopMoversBarChart({ topGainers, topLosers }: TopMoversBarChartProps) {
  const [chartRef, chartWidth] = useObservedWidth<HTMLDivElement>();
  const rows = buildTopMoversData(topGainers, topLosers);
  if (!rows.length) {
    return <small>No significant contributors in this period.</small>;
  }

  const effectiveWidth = chartWidth > 0 ? chartWidth : 900;
  const margin = useMemo(
    () => ({
      top: 8,
      right: Math.max(36, Math.min(80, Math.round(effectiveWidth * 0.08))),
      bottom: 8,
      left: 12
    }),
    [effectiveWidth]
  );
  const drawableWidth = Math.max(240, effectiveWidth - margin.left - margin.right);
  const yAxisWidth = useMemo(
    () => Math.max(120, Math.min(420, Math.round(drawableWidth / 3))),
    [drawableWidth]
  );
  const labelMaxChars = useMemo(
    () => Math.max(14, Math.min(40, Math.floor((yAxisWidth - 20) / 8))),
    [yAxisWidth]
  );

  const domain = computeTopMoversDomain(rows);
  const ticks = computeTopMoversTicks(domain);

  return (
    <div className="top-movers-chart-shell" ref={chartRef}>
      <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 44)}>
        <BarChart
          data={rows}
          layout="vertical"
          margin={margin}
          barCategoryGap={10}
        >
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            type="number"
            domain={domain}
            ticks={ticks}
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => formatAxisEur(Number(value))}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={yAxisWidth}
            tick={(props) => renderNameTick(props, labelMaxChars)}
          />
          <ReferenceLine x={0} stroke="var(--chart-grid)" strokeDasharray="3 3" />
          <Tooltip content={<MoversTooltip />} />
          <Bar dataKey="contributionEur" radius={[6, 6, 6, 6]} maxBarSize={24}>
            <LabelList dataKey="contributionEur" content={renderValueLabel} />
            {rows.map((row) => (
              <Cell
                key={`${row.isin}-${row.name}`}
                fill={row.contributionEur >= 0 ? "var(--brand-accent)" : "var(--danger)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

