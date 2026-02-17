"use client";

import React from "react";
import type { RecentPerformanceResult } from "@/lib/dashboard/recentPerformance";
import type { DailyPortfolioSeries } from "@/lib/portfolio/getOrCreateDailyPortfolioSeries";

const eurFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const pctFormatter = new Intl.NumberFormat("en-GB", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function formatEur(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  return eurFormatter.format(value);
}

function formatPct(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  return pctFormatter.format(value);
}

function formatDate(value: Date | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

type RecentPerformanceCardProps = {
  data: RecentPerformanceResult;
  dailySeries: DailyPortfolioSeries;
};

export function RecentPerformanceCard({ data, dailySeries }: RecentPerformanceCardProps) {
  const changeTone =
    data.portfolio.valueGainedEur === null
      ? "tone-muted"
      : data.portfolio.valueGainedEur < 0
        ? "tone-negative"
        : "tone-positive";
  const hasHistory = data.window.weeksCount > 0;
  const investedEur = data.portfolio.netFlowEur;

  return (
    <div className="card stack">
      <div className="row">
        <div>
          <div className="section-title">Portfolio Drivers</div>
          <h2>Last 4 Weeks</h2>
          <small>Daily values (EUR) and organic return</small>
          {data.notes.length ? (
            <div className="note-list">
              {data.notes.map((note) => (
                <small key={note}>
                  {note}
                </small>
              ))}
            </div>
          ) : null}
        </div>
        <div className="text-right">
          <div className={`${changeTone} metric-emphasis`}>
            {data.portfolio.valueGainedEur === null
              ? "Value gained: -"
              : `Value gained: ${formatEur(data.portfolio.valueGainedEur)} (${formatPct(
                  data.portfolio.valueGainedPct
                )})`}
          </div>
          <small>
            Start: {formatEur(data.portfolio.startValueEur)} | End: {formatEur(data.portfolio.endValueEur)}
          </small>
          <br />
          <small>Invested in period: {formatEur(investedEur)}</small>
        </div>
      </div>

      {!hasHistory ? (
        <div>
          <p>Not enough history yet. Import transactions and sync prices to build history.</p>
        </div>
      ) : (
        <div className="stack">
          <small>
            Window: {formatDate(data.window.startWeekEndDate)} to {formatDate(data.window.endWeekEndDate)}
          </small>
          {dailySeries.lastUpdatedAt ? (
            <small className="tone-muted">Last updated: {formatDate(dailySeries.lastUpdatedAt)}</small>
          ) : null}
        </div>
      )}

      <div className="stack">
        <div className="row">
          <h3>Top contributors</h3>
          {data.approximationNote ? (
            <small title={data.approximationNote}>Approximate</small>
          ) : null}
        </div>
        {data.contributors.topGainers.length === 0 && data.contributors.topLosers.length === 0 ? (
          <small>No contribution data available yet.</small>
        ) : (
          <div className="contributors-grid">
            <div>
              <small className="section-title">Top gainers</small>
              <div className="contributors-stack">
                {data.contributors.topGainers.length ? (
                  data.contributors.topGainers.map((row) => (
                    <div key={row.instrumentId} className="row row-tight">
                      <div>
                        <div>{row.instrumentName}</div>
                        <small>{row.isin}</small>
                      </div>
                      <div className="tone-positive text-right">
                        <div>{formatEur(row.contributionEur)}</div>
                        {row.contributionPctOfMove !== null ? (
                          <small>{formatPct(row.contributionPctOfMove)} of move</small>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <small>No positive contributors.</small>
                )}
              </div>
            </div>
            <div>
              <small className="section-title">Top losers</small>
              <div className="contributors-stack">
                {data.contributors.topLosers.length ? (
                  data.contributors.topLosers.map((row) => (
                    <div key={row.instrumentId} className="row row-tight">
                      <div>
                        <div>{row.instrumentName}</div>
                        <small>{row.isin}</small>
                      </div>
                      <div className="tone-negative text-right">
                        <div>{formatEur(row.contributionEur)}</div>
                        {row.contributionPctOfMove !== null ? (
                          <small>{formatPct(row.contributionPctOfMove)} of move</small>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <small>No negative contributors.</small>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
