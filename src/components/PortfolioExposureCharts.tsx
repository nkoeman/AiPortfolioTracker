"use client";

import { useEffect, useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip
} from "recharts";

type PortfolioExposureChartKey = "region" | "development" | "country" | "sector";

type PortfolioExposureSlice = {
  key: string;
  label: string;
  value: number;
};

type PortfolioExposureResponse = {
  asOfDate: string;
  coverage: number;
  charts: Record<PortfolioExposureChartKey, PortfolioExposureSlice[]>;
  chartMeta: Record<PortfolioExposureChartKey, { coverage: number; noData: number }>;
};

type PortfolioExposureChartsProps = {
  asOf?: string | null;
};

const CHART_OPTIONS: Array<{ value: PortfolioExposureChartKey; label: string }> = [
  { value: "region", label: "Region" },
  { value: "sector", label: "Sector" }
];

const SLICE_COLORS = [
  "#2a5d6e",
  "#4b6f92",
  "#5f7f4f",
  "#7d5e9e",
  "#8b6e3a",
  "#9f5561",
  "#556e9f",
  "#6d7f7a",
  "#708090"
];

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function sliceColor(key: string, index: number) {
  if (key === "NO_DATA") return "#cbd5e1";
  if (key === "OTHER") return "#94a3b8";
  return SLICE_COLORS[index % SLICE_COLORS.length];
}

function centerNameClass(label: string | undefined) {
  const length = label?.length ?? 0;
  if (length > 24) return " compact";
  if (length > 17) return " medium";
  return "";
}

function renderActiveShape(props: any) {
  const {
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    payload
  } = props;
  const label = typeof payload?.label === "string" ? payload.label : "Exposure";
  const value = typeof payload?.value === "number" ? payload.value : 1;
  const usableWidth = Math.max(64, innerRadius * 1.7);
  const usableHeight = Math.max(54, innerRadius * 1.28);

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 5}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={outerRadius + 8}
        outerRadius={outerRadius + 11}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.22}
      />
      <foreignObject
        x={cx - usableWidth / 2}
        y={cy - usableHeight / 2}
        width={usableWidth}
        height={usableHeight}
        className="portfolio-exposure-center-object"
      >
        <div
          className="portfolio-exposure-center"
          title={`${label}: ${formatPercent(value)}`}
          aria-label={`${label}: ${formatPercent(value)}`}
        >
          <div className="portfolio-exposure-center-value">{formatPercent(value)}</div>
          <div className={`portfolio-exposure-center-label${centerNameClass(label)}`}>{label}</div>
        </div>
      </foreignObject>
    </g>
  );
}

export function PortfolioExposureCharts({ asOf }: PortfolioExposureChartsProps) {
  const [view, setView] = useState<PortfolioExposureChartKey>("region");
  const [activeIndex, setActiveIndex] = useState(0);
  const [payload, setPayload] = useState<PortfolioExposureResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);

      const search = asOf ? `?asOf=${encodeURIComponent(asOf)}` : "";

      try {
        const response = await fetch(`/api/portfolio/exposure${search}`, {
          method: "GET",
          signal: controller.signal,
          cache: "no-store"
        });

        const body = (await response.json()) as PortfolioExposureResponse | { error?: string };
        if (!response.ok) {
          throw new Error(typeof body === "object" && body && "error" in body ? body.error || "Unable to load exposure." : "Unable to load exposure.");
        }

        setPayload(body as PortfolioExposureResponse);
      } catch (fetchError) {
        if (controller.signal.aborted) return;
        setError(fetchError instanceof Error ? fetchError.message : "Unable to load exposure.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();

    return () => controller.abort();
  }, [asOf]);

  useEffect(() => {
    setActiveIndex(0);
  }, [view, payload]);

  const activeView = view === "sector" ? "sector" : "region";
  const rawSlices = payload?.charts[activeView] || [];
  const slices = rawSlices;
  const chartMeta = payload?.chartMeta[activeView] || { coverage: 0, noData: 0 };
  const legendRows = slices;

  return (
    <div className="stack portfolio-exposure-panel">
      <div className="portfolio-exposure-header">
        <div>
          <h2 className="card-title">Portfolio exposure</h2>
        </div>
        <div className="portfolio-exposure-controls">
          <div className="range-pills" role="tablist" aria-label="Exposure view">
            {CHART_OPTIONS.map((entry) => (
              <button
                key={entry.value}
                type="button"
                className={`range-pill${activeView === entry.value ? " active" : ""}`}
                onClick={() => setView(entry.value)}
              >
                {entry.label}
              </button>
            ))}
          </div>
          {payload ? (
            <div className="portfolio-exposure-meta">
              Exposure coverage {Math.round(chartMeta.coverage * 100)}% · No data {Math.round(chartMeta.noData * 100)}% · As of {payload.asOfDate}
            </div>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="spinner">
          <div className="spinner-dot" />
          <small>Loading exposure analytics...</small>
        </div>
      ) : error ? (
        <small className="warning-text">{error}</small>
      ) : slices.length ? (
        <div className="portfolio-exposure-layout">
          <div className="portfolio-exposure-chart h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="48%"
                  outerRadius="78%"
                  paddingAngle={0}
                  activeIndex={activeIndex}
                  activeShape={renderActiveShape}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onClick={(_, index) => setActiveIndex(index)}
                  stroke="var(--surface)"
                  strokeWidth={2}
                >
                  {slices.map((slice, index) => (
                    <Cell key={`${slice.key}-${index}`} fill={sliceColor(slice.key, index)} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload: tooltipPayload }) => {
                    const row = active ? tooltipPayload?.[0]?.payload as PortfolioExposureSlice | undefined : undefined;
                    if (!row) return null;
                    return (
                      <div className="top-movers-tooltip">
                        <div className="top-movers-tooltip-title">{row.label}</div>
                        <div>{formatPercent(row.value)}</div>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="portfolio-exposure-side">
            <div className="portfolio-exposure-legend">
              {legendRows.map((slice, index) => (
                <button
                  key={`${slice.key}-legend-${index}`}
                  type="button"
                  className={`portfolio-exposure-legend-row${index === activeIndex ? " active" : ""}`}
                  onClick={() => setActiveIndex(index)}
                >
                  <span
                    className="portfolio-exposure-dot"
                    style={{ background: sliceColor(slice.key, index) }}
                    aria-hidden="true"
                  />
                  <span className="portfolio-exposure-legend-label">{slice.label}</span>
                  <span className="portfolio-exposure-legend-value">{formatPercent(slice.value)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <small>No exposure data is available for the current portfolio yet.</small>
      )}
    </div>
  );
}
