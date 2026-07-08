import React from "react";

export type WeeklyPortfolioSummary = {
  weekEndDate: string;
  portfolioValueEur: number;
  weeklyReturnPct: number;
  weeklyPnLEur: number;
  netFlowEur?: number;
  fxPnLEur?: number;
};

export type ContributionRow = {
  instrumentId: string;
  instrumentName: string;
  assetType?: string;
  region?: string;
  weekEndDate: string;
  contributionEur: number;
  contributionPctOfPortfolio: number;
};

export type PortfolioImpactPayload = {
  asOfWeekEndDate: string;
  currency: "EUR";
  weekly: WeeklyPortfolioSummary[];
  topContributors: ContributionRow[];
  contributorWindow: "LATEST_WEEK" | "LAST_4_WEEKS_CUMULATIVE";
  notes?: string[];
};

type Props = {
  payload: PortfolioImpactPayload;
};

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

function formatEur(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "N/A";
  return eurFormatter.format(value);
}

function formatPct(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "N/A";
  return pctFormatter.format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

function truncateLabel(value: string, maxLength = 28) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function splitContributors(rows: ContributionRow[]) {
  const positives = rows
    .filter((row) => row.contributionEur > 0)
    .sort((a, b) => b.contributionEur - a.contributionEur)
    .slice(0, 5);
  const negatives = rows
    .filter((row) => row.contributionEur < 0)
    .sort((a, b) => a.contributionEur - b.contributionEur)
    .slice(0, 5);
  return { positives, negatives };
}

function computeCumulativeReturn(weekly: WeeklyPortfolioSummary[]) {
  if (weekly.length < 2) return null;
  const first = weekly[0]?.portfolioValueEur;
  const last = weekly[weekly.length - 1]?.portfolioValueEur;
  if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) return null;
  return (last - first) / first;
}

export function PortfolioImpactCard({ payload }: Props) {
  const weekly = Array.isArray(payload.weekly) ? payload.weekly : [];
  const latest = weekly[weekly.length - 1];
  const cumulativeReturn = computeCumulativeReturn(weekly);
  const { positives, negatives } = splitContributors(Array.isArray(payload.topContributors) ? payload.topContributors : []);
  const hasWeekly = weekly.length > 0;

  return (
    <section className="card stack">
      <div className="row">
        <div>
          <h2 className="card-title">Portfolio impact (last 4 weeks)</h2>
          <p className="card-sub">As of {formatDate(payload.asOfWeekEndDate)}</p>
        </div>
        <span className="section-title">{payload.currency}</span>
      </div>

      {hasWeekly ? (
        <>
          <p className="tone-muted">
            From {formatDate(weekly[0].weekEndDate)} to {formatDate(weekly[weekly.length - 1].weekEndDate)}, the
            portfolio moved from {formatEur(weekly[0].portfolioValueEur)} to {formatEur(weekly[weekly.length - 1].portfolioValueEur)}.
            {cumulativeReturn !== null ? ` Cumulative return: ${formatPct(cumulativeReturn)}.` : ""}
            {latest
              ? ` Week ending ${formatDate(latest.weekEndDate)} returned ${formatPct(latest.weeklyReturnPct)} with ${formatEur(latest.weeklyPnLEur)} P&L.`
              : ""}
          </p>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Week</th>
                  <th>Return</th>
                  <th>P&amp;L</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {weekly.map((row) => (
                  <tr key={row.weekEndDate}>
                    <td>{formatDate(row.weekEndDate)}</td>
                    <td>{formatPct(row.weeklyReturnPct)}</td>
                    <td>{formatEur(row.weeklyPnLEur)}</td>
                    <td>{formatEur(row.portfolioValueEur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <small className="warning-text">No weekly portfolio data available for the last 4 weeks yet.</small>
      )}

      {payload.notes?.length ? (
        <ul className="stack-sm">
          {payload.notes.map((note, idx) => (
            <li key={`${note}-${idx}`} className="warning-text">
              {note}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="stack">
        <div className="row">
          <h3 className="card-title">Largest contributors</h3>
          <span className="card-sub">
            {payload.contributorWindow === "LATEST_WEEK" ? "Latest week" : "Last 4 weeks cumulative"}
          </span>
        </div>

        {positives.length === 0 && negatives.length === 0 ? (
          <small className="warning-text">No contribution data available yet.</small>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="stack-sm">
              <p className="section-title tone-positive">Largest positive contributors</p>
              {positives.map((row) => (
                <div key={row.instrumentId} className="card">
                  <div className="row">
                    <div>
                      <p>{truncateLabel(row.instrumentName)}</p>
                      <small>{[row.assetType, row.region].filter(Boolean).join(" · ")}</small>
                    </div>
                    <div className="text-right tone-positive">
                      <div>{formatEur(row.contributionEur)}</div>
                      <small>{formatPct(row.contributionPctOfPortfolio)}</small>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="stack-sm">
              <p className="section-title tone-negative">Largest negative contributors</p>
              {negatives.map((row) => (
                <div key={row.instrumentId} className="card">
                  <div className="row">
                    <div>
                      <p>{truncateLabel(row.instrumentName)}</p>
                      <small>{[row.assetType, row.region].filter(Boolean).join(" · ")}</small>
                    </div>
                    <div className="text-right tone-negative">
                      <div>{formatEur(row.contributionEur)}</div>
                      <small>{formatPct(row.contributionPctOfPortfolio)}</small>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
