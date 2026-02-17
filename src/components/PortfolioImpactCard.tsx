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
  const { positives, negatives } = splitContributors(
    Array.isArray(payload.topContributors) ? payload.topContributors : []
  );
  const hasWeekly = weekly.length > 0;

  return (
    <section className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Portfolio impact (last 4 weeks)</h2>
          <p className="text-sm text-slate-500">As of {formatDate(payload.asOfWeekEndDate)}</p>
        </div>
        <span className="text-xs uppercase tracking-wide text-slate-400">{payload.currency}</span>
      </div>

      {hasWeekly ? (
        <>
          <p className="mt-4 text-sm text-slate-700">
            From {formatDate(weekly[0].weekEndDate)} to {formatDate(weekly[weekly.length - 1].weekEndDate)}, the
            portfolio moved from {formatEur(weekly[0].portfolioValueEur)} to {" "}
            {formatEur(weekly[weekly.length - 1].portfolioValueEur)}.
            {cumulativeReturn !== null ? ` Cumulative return over the period: ${formatPct(cumulativeReturn)}.` : ""}
            {latest
              ? ` In the week ending ${formatDate(latest.weekEndDate)}, the return was ${formatPct(
                  latest.weeklyReturnPct
                )} with ${formatEur(latest.weeklyPnLEur)} in weekly P&L.`
              : ""}
            {latest?.netFlowEur !== undefined ? ` Net flows for that week were ${formatEur(latest.netFlowEur)}.` : ""}
            {latest?.fxPnLEur !== undefined ? ` FX impact for that week was ${formatEur(latest.fxPnLEur)}.` : ""}
          </p>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <div className="grid grid-cols-4 gap-2 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase text-slate-500">
              <span>Week</span>
              <span>Return</span>
              <span>P&amp;L</span>
              <span>Value</span>
            </div>
            <div className="divide-y divide-slate-200">
              {weekly.map((row) => (
                <div key={row.weekEndDate} className="grid grid-cols-4 gap-2 px-3 py-2 text-xs sm:text-sm">
                  <span className="text-slate-700">{formatDate(row.weekEndDate)}</span>
                  <span className="text-slate-700">{formatPct(row.weeklyReturnPct)}</span>
                  <span className="text-slate-700">{formatEur(row.weeklyPnLEur)}</span>
                  <span className="text-slate-700">{formatEur(row.portfolioValueEur)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          No weekly portfolio data available for the last 4 weeks yet.
        </div>
      )}

      {payload.notes?.length ? (
        <ul className="mt-3 space-y-1 text-xs text-amber-700">
          {payload.notes.map((note, idx) => (
            <li key={`${note}-${idx}`} className="rounded-md bg-amber-50 px-2 py-1">
              {note}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h3 className="text-base font-semibold text-slate-900">Largest contributors</h3>
          <span className="text-xs text-slate-500">
            {payload.contributorWindow === "LATEST_WEEK" ? "Latest week" : "Last 4 weeks cumulative"}
          </span>
        </div>

        {positives.length === 0 && negatives.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No contribution data available yet.
          </div>
        ) : (
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-emerald-600">Largest positive contributors</p>
              {positives.length ? (
                <div className="space-y-2">
                  {positives.map((row) => (
                    <div
                      key={row.instrumentId}
                      className="flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900" title={row.instrumentName}>
                          {truncateLabel(row.instrumentName)}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {row.assetType ? (
                            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-600">
                              {row.assetType}
                            </span>
                          ) : null}
                          {row.region ? (
                            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-600">
                              {row.region}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="text-right text-sm font-semibold text-emerald-700">
                        <div>{formatEur(row.contributionEur)}</div>
                        <div className="text-xs font-normal text-emerald-700">
                          {formatPct(row.contributionPctOfPortfolio)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No positive contributors reported.</p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-rose-600">Largest negative contributors</p>
              {negatives.length ? (
                <div className="space-y-2">
                  {negatives.map((row) => (
                    <div
                      key={row.instrumentId}
                      className="flex items-center justify-between rounded-lg border border-rose-100 bg-rose-50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900" title={row.instrumentName}>
                          {truncateLabel(row.instrumentName)}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {row.assetType ? (
                            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-600">
                              {row.assetType}
                            </span>
                          ) : null}
                          {row.region ? (
                            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-600">
                              {row.region}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="text-right text-sm font-semibold text-rose-700">
                        <div>{formatEur(row.contributionEur)}</div>
                        <div className="text-xs font-normal text-rose-700">
                          {formatPct(row.contributionPctOfPortfolio)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No negative contributors reported.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
