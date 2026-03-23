"use client";

import React, { useMemo, useState } from "react";
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
  moversByRange: Record<PerformanceRangeOption, TopMoversRangeResult>;
};

export function RecentPerformanceCard({ moversByRange }: RecentPerformanceCardProps) {
  const [range, setRange] = useState<PerformanceRangeOption>("max");
  const data = moversByRange[range];
  const hasHistory = Boolean(data?.window.startDate && data?.window.endDate);
  const options = useMemo(
    () =>
      (Object.keys(PERFORMANCE_RANGE_LABELS) as PerformanceRangeOption[]).map((value) => ({
        value,
        label: PERFORMANCE_RANGE_LABELS[value]
      })),
    []
  );

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

      {!hasHistory ? (
        <div>
          <p>Not enough history yet. Import transactions and sync prices to build history.</p>
        </div>
      ) : null}

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
    </div>
  );
}
