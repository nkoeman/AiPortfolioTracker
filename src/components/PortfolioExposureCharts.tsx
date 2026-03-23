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
import { SelectMenu } from "@/components/SelectMenu";

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
  { value: "development", label: "Development" },
  { value: "country", label: "Country" },
  { value: "sector", label: "Sector" }
];

const SLICE_COLORS = [
  "#0f766e",
  "#16a34a",
  "#0891b2",
  "#7c3aed",
  "#ea580c",
  "#e11d48",
  "#4f46e5",
  "#65a30d",
  "#475569"
];

const regionDisplay = new Intl.DisplayNames(["en"], { type: "region" });

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function sliceColor(key: string, index: number) {
  if (key === "NO_DATA") return "#cbd5e1";
  if (key === "OTHER") return "#94a3b8";
  return SLICE_COLORS[index % SLICE_COLORS.length];
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
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" className="portfolio-exposure-center">
        {payload?.label}
      </text>
    </g>
  );
}

export function PortfolioExposureCharts({ asOf }: PortfolioExposureChartsProps) {
  const [view, setView] = useState<PortfolioExposureChartKey>("region");
  const [activeIndex, setActiveIndex] = useState(0);
  const [payload, setPayload] = useState<PortfolioExposureResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

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

  const rawSlices = payload?.charts[view] || [];
  const slices = rawSlices.map((slice) => {
    if (view !== "country") return slice;
    if (slice.key === "OTHER" || slice.key === "CASH" || slice.key === "NO_DATA") return slice;
    const label = regionDisplay.of(slice.key);
    return {
      ...slice,
      label: label && label.toUpperCase() !== slice.key ? label : slice.label
    };
  });
  const chartMeta = payload?.chartMeta[view] || { coverage: 0, noData: 0 };
  const legendRows = isMobile ? slices.slice(0, 4) : slices;

  return (
    <div className="stack portfolio-exposure-panel">
      <div className="portfolio-exposure-header">
        <div>
          <div className="section-title">Exposure Analytics</div>
          <h2>Portfolio exposure</h2>
          {payload ? (
            <div className="portfolio-exposure-meta">
              <span>Exposure coverage: {Math.round(chartMeta.coverage * 100)}%</span>
              <span>No data: {Math.round(chartMeta.noData * 100)}%</span>
              <span>As of {payload.asOfDate}</span>
            </div>
          ) : null}
        </div>
        <div className="portfolio-control portfolio-exposure-control">
          <SelectMenu
            id="portfolio-exposure-view"
            ariaLabel="Exposure view"
            value={view}
            options={CHART_OPTIONS.map((entry) => ({ value: entry.value, label: entry.label }))}
            onChange={(nextValue) => setView(nextValue as PortfolioExposureChartKey)}
          />
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
                  paddingAngle={2}
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
