"use client";

import React, { useEffect, useMemo, useState } from "react";
import { SelectMenu } from "@/components/SelectMenu";
import { TopMoversBarChart } from "@/components/TopMoversBarChart";
import {
  PERFORMANCE_RANGE_LABELS,
  type PerformanceRangeOption
} from "@/lib/charts/performanceRange";
import type { TopMoversRangeResult } from "@/lib/dashboard/topMoversByRange";

function formatDate(value: Date | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
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
  const options = useMemo(
    () =>
      (Object.keys(PERFORMANCE_RANGE_LABELS) as PerformanceRangeOption[]).map((value) => ({
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
      <div className="row">
        <div>
          <h2>Gainers &amp; losers</h2>
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
          <TopMoversBarChart
            topGainers={data.contributors.topGainers}
            topLosers={data.contributors.topLosers}
          />
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
