"use client";

import React, { useEffect, useMemo, useState } from "react";
import { SelectMenu } from "@/components/SelectMenu";
import {
  PERFORMANCE_RANGE_LABELS,
  type PerformanceRangeOption
} from "@/lib/charts/performanceRange";
import type { TopMoversRangeResult } from "@/lib/dashboard/topMoversByRange";
import type { TopMoversRangeContributor } from "@/lib/dashboard/topMoversByRange";

function formatDate(value: Date | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

const percentFormatter = new Intl.NumberFormat("en-GB", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function formatSignedPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "\u2014";
  const formatted = percentFormatter.format(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

const COMMON_ETF_TICKERS_BY_ISIN: Record<string, string> = {
  IE00BK5BQT80: "VWCE",
  IE00B4L5Y983: "IWDA",
  IE00B5BMR087: "SXR8",
  IE00B3XXRP09: "VUSA",
  IE00BD45KH83: "EIMI",
  IE00B53SZB19: "CNDX",
  IE00B1XNHC34: "IQQH",
  IE00BKM4GZ66: "IEMA",
  IE00B0M62Q58: "IS3N",
  IE00BFY0GT14: "VWRL"
};

const COMMON_TICKER_PATTERNS = [
  "VWCE",
  "VWRL",
  "IWDA",
  "SWRD",
  "SXR8",
  "CSPX",
  "VUSA",
  "EIMI",
  "IEMA",
  "IS3N",
  "CNDX",
  "SMH",
  "QDVE",
  "EXSA"
];

function tickerFromName(name: string, isin: string) {
  const knownTicker = COMMON_ETF_TICKERS_BY_ISIN[isin.toUpperCase()];
  if (knownTicker) return knownTicker;

  const upperName = name.toUpperCase();
  const matchedTicker = COMMON_TICKER_PATTERNS.find((ticker) => {
    const escaped = ticker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^A-Z0-9])${escaped}([^A-Z0-9]|$)`).test(upperName);
  });
  if (matchedTicker) return matchedTicker;

  const normalized = name.toLowerCase();
  if (normalized.includes("ishares")) return "ISHARES";
  if (normalized.includes("vanguard")) return "VANGUARD";
  if (normalized.includes("xtrackers")) return "XTRACK";
  if (normalized.includes("vaneck")) return "VANECK";
  if (normalized.includes("spdr")) return "SPDR";

  const firstWord = name.trim().split(/\s+/)[0] || "";
  const cleaned = firstWord.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return cleaned.slice(0, 8) || isin.slice(0, 4).toUpperCase();
}

type RecentPerformanceCardProps = {
  initialRange: PerformanceRangeOption;
  initialData: TopMoversRangeResult;
};

type TopMoversRangeApiResult = Omit<TopMoversRangeResult, "window" | "lastUpdatedAt"> & {
  window: {
    startDate: Date | string | null;
    endDate: Date | string | null;
  };
  lastUpdatedAt: Date | string | null;
};

function toDateOrNull(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeTopMoversResult(raw: TopMoversRangeApiResult): TopMoversRangeResult {
  return {
    ...raw,
    window: {
      startDate: toDateOrNull(raw.window.startDate),
      endDate: toDateOrNull(raw.window.endDate)
    },
    lastUpdatedAt: toDateOrNull(raw.lastUpdatedAt)
  };
}

function createInitialCache(
  initialRange: PerformanceRangeOption,
  initialData: TopMoversRangeResult
): Record<PerformanceRangeOption, TopMoversRangeResult | null> {
  return {
    max: initialRange === "max" ? initialData : null,
    ytd: initialRange === "ytd" ? initialData : null,
    "1y": initialRange === "1y" ? initialData : null,
    "1m": initialRange === "1m" ? initialData : null
  };
}

export function RecentPerformanceCard({ initialRange, initialData }: RecentPerformanceCardProps) {
  const normalizedInitialData = useMemo(
    () => normalizeTopMoversResult(initialData as TopMoversRangeApiResult),
    [initialData]
  );
  const [range, setRange] = useState<PerformanceRangeOption>(initialRange);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheByRange, setCacheByRange] = useState<Record<PerformanceRangeOption, TopMoversRangeResult | null>>(
    () => createInitialCache(initialRange, normalizedInitialData)
  );
  const data = cacheByRange[range];
  const hasLoadedData = Boolean(data);
  const hasHistory = Boolean(data?.window.startDate && data?.window.endDate);
  const gainerRows = data?.contributors.topGainers.slice(0, 5) ?? [];
  const loserRows = data?.contributors.topLosers.slice(0, 5).slice().reverse() ?? [];
  const topMoverRows = [...gainerRows, ...loserRows];
  const maxAbsReturn = Math.max(0.0001, ...topMoverRows.map((row) => Math.abs(row.localReturnPct ?? 0)));
  const options = useMemo(
    () =>
      (["max", "ytd", "1y", "1m"] as PerformanceRangeOption[]).map((value) => ({
        value,
        label: PERFORMANCE_RANGE_LABELS[value]
      })),
    []
  );

  useEffect(() => {
    setRange(initialRange);
    setCacheByRange(createInitialCache(initialRange, normalizedInitialData));
  }, [initialRange, normalizedInitialData]);

  useEffect(() => {
    let cancelled = false;
    if (cacheByRange[range]) return;

    const loadRange = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/dashboard/top-movers?range=${encodeURIComponent(range)}`);
        const body = (await response.json()) as TopMoversRangeApiResult | { error?: string };
        if (!response.ok) {
          throw new Error(
            typeof body === "object" && body && "error" in body
              ? body.error || "Unable to load gainers and losers."
              : "Unable to load gainers and losers."
          );
        }
        if (cancelled) return;
        const normalized = normalizeTopMoversResult(body as TopMoversRangeApiResult);
        setCacheByRange((current) => ({ ...current, [range]: normalized }));
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load gainers and losers.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadRange();
    return () => {
      cancelled = true;
    };
  }, [cacheByRange, range]);

  return (
    <div className="card stack recent-performance-card">
      <div className="card-head">
        <div>
          <h2 className="card-title">Top movers</h2>
        </div>
        <div className="minw-160 portfolio-control">
          <SelectMenu
            id="gainers-losers-range"
            ariaLabel="Gainers and losers range"
            value={range}
            options={options}
            onChange={(nextValue) => setRange(nextValue as PerformanceRangeOption)}
          />
        </div>
      </div>

      {loading && !data ? (
        <div>
          <p>Loading gainers and losers...</p>
        </div>
      ) : null}
      {error ? (
        <div>
          <small className="warning-text">{error}</small>
        </div>
      ) : null}

      {hasLoadedData && !hasHistory ? (
        <div>
          <p>Not enough history yet. Import transactions and sync prices to build history.</p>
        </div>
      ) : null}

      {data ? (
        <div className="stack">
          <div className="movers-list">
            {topMoverRows.length ? (
              <>
                {gainerRows.length ? (
                  <TopMoverGroup
                    title="Biggest gainers"
                    rows={gainerRows}
                    startIndex={0}
                    maxAbsReturn={maxAbsReturn}
                  />
                ) : null}
                {loserRows.length ? (
                  <TopMoverGroup
                    title="Biggest losers"
                    rows={loserRows}
                    startIndex={gainerRows.length}
                    maxAbsReturn={maxAbsReturn}
                  />
                ) : null}
              </>
            ) : (
              <small>No top movers in this period.</small>
            )}
          </div>
          <div className="top-movers-meta">
            <small>
              Window: {formatDate(data.window.startDate)} to {formatDate(data.window.endDate)} ({data.granularity})
            </small>
            {data.lastUpdatedAt ? (
              <small className="tone-muted">Last updated: {formatDate(data.lastUpdatedAt)}</small>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TopMoverGroup({
  title,
  rows,
  startIndex,
  maxAbsReturn
}: {
  title: string;
  rows: TopMoversRangeContributor[];
  startIndex: number;
  maxAbsReturn: number;
}) {
  return (
    <div className="mover-group">
      <div className="mover-group-title">{title}</div>
      <div className="mover-group-list">
        {rows.map((row, index) => (
          <TopMoverListRow
            key={`${title}-${row.instrumentId}`}
            row={row}
            rank={startIndex + index + 1}
            maxAbsReturn={maxAbsReturn}
          />
        ))}
      </div>
    </div>
  );
}

function TopMoverListRow({
  row,
  rank,
  maxAbsReturn
}: {
  row: TopMoversRangeContributor;
  rank: number;
  maxAbsReturn: number;
}) {
  const returnPct = row.localReturnPct ?? 0;
  const tone = returnPct >= 0 ? "pos" : "neg";
  const width = `${Math.max(6, (Math.abs(returnPct) / maxAbsReturn) * 100)}%`;

  return (
    <div className="mover-row">
      <div className="mover-main">
        <div className="mover-rank">{String(rank).padStart(2, "0")}</div>
        <span className="ticker-chip">{tickerFromName(row.instrumentName, row.isin)}</span>
        <div className="mover-identity">
          <div className="mover-name" title={row.instrumentName}>
            {row.instrumentName}
          </div>
          <div className="mover-isin">{row.isin}</div>
        </div>
        <div className={`mover-pct ${tone}`}>{formatSignedPercent(returnPct)}</div>
      </div>
      <div className="mover-bar-wrap" aria-hidden="true">
        <div className={`mover-bar ${tone}`} style={{ width }} />
      </div>
    </div>
  );
}
