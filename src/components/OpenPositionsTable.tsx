"use client";

import Link from "next/link";
import type React from "react";

export type OpenPositionRow = {
  name: string;
  isin: string;
  quantity: number;
  latestAdjCloseEur: number | null;
  marketValueEur: number | null;
  totalPnlEur: number | null;
  ytdPnlEur: number | null;
  ytdPct: number | null;
  profileTags: string[];
  priceAvailabilityMessage: string | null;
};

export type OpenPositionColumn = {
  key: string;
  label: string;
};

export type OpenPositionsTotals = {
  positionCount: number;
  marketValueEur: number | null;
  totalPnlEur: number | null;
  ytdPnlEur: number | null;
  ytdPct: number | null;
};

type SortDir = "asc" | "desc";

type Props = {
  rows: OpenPositionRow[];
  columns: OpenPositionColumn[];
  sortKey: string;
  sortDir: SortDir;
  basePath: string;
  totals: OpenPositionsTotals;
};

const eurFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function formatEur(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "\u2014";
  return eurFormatter.format(value);
}

function formatSignedEur(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "\u2014";
  const formatted = eurFormatter.format(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return eurFormatter.format(0);
}

function formatQty(value: number) {
  if (!Number.isFinite(value)) return "\u2014";
  return value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function formatPct(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "\u2014";
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
}

function computeTotalPnlPct(row: OpenPositionRow) {
  if (row.totalPnlEur === null || row.marketValueEur === null) return null;
  const invested = row.marketValueEur - row.totalPnlEur;
  if (!Number.isFinite(invested) || invested === 0) return null;
  return row.totalPnlEur / invested;
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

function tickerFromPosition(row: Pick<OpenPositionRow, "name" | "isin">) {
  const knownTicker = COMMON_ETF_TICKERS_BY_ISIN[row.isin.toUpperCase()];
  if (knownTicker) return knownTicker;

  const upperName = row.name.toUpperCase();
  const matchedTicker = COMMON_TICKER_PATTERNS.find((ticker) => {
    const escaped = ticker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^A-Z0-9])${escaped}([^A-Z0-9]|$)`).test(upperName);
  });
  if (matchedTicker) return matchedTicker;

  const normalized = row.name.toLowerCase();
  if (normalized.includes("ishares")) return "ISH";
  if (normalized.includes("vanguard")) return "VAN";
  if (normalized.includes("xtrackers")) return "XTR";
  if (normalized.includes("vaneck")) return "VNK";
  if (normalized.includes("spdr")) return "SPD";

  const firstWord = row.name.trim().split(/\s+/)[0] || "";
  return firstWord.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || row.isin.slice(0, 3).toUpperCase();
}

function getRegionTag(row: OpenPositionRow) {
  return row.profileTags.find((tag) => !["ETF", "STOCK", "FUND", "OTHER"].includes(tag)) || row.profileTags[0] || "Holding";
}

function hashString(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

function buildSparkline(isin: string, bias: number) {
  const seed = hashString(isin);
  const points: number[] = [];
  let value = 50 + (seed % 9) - 4;
  for (let i = 0; i < 20; i += 1) {
    const drift = bias * 0.8;
    const noise = (((seed >> (i % 16)) & 7) - 3) * 0.45;
    value = Math.max(8, Math.min(92, value + drift + noise));
    points.push(value);
  }
  return points;
}

function Sparkline({ values, negative }: { values: number[]; negative: boolean }) {
  if (values.length < 2) return null;
  const width = 84;
  const height = 22;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const points = values
    .map((value, index) => `${(index * step).toFixed(1)},${(height - ((value - min) / range) * height).toFixed(1)}`)
    .join(" ");

  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
      <polyline
        points={points}
        stroke={negative ? "var(--neg)" : "var(--pos)"}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const mobileSortOptions: Array<{ label: string; sort: string; dir: SortDir }> = [
  { label: "Market value", sort: "marketValueEur", dir: "desc" },
  { label: "Name", sort: "name", dir: "asc" },
  { label: "YTD %", sort: "ytdPct", dir: "desc" },
  { label: "Total P&L", sort: "totalPnlEur", dir: "desc" }
];

export function OpenPositionsTable({ rows, columns, sortKey, sortDir, basePath, totals }: Props) {
  const activeMobileSort = mobileSortOptions.some((option) => option.sort === sortKey && option.dir === sortDir)
    ? `${sortKey}:${sortDir}`
    : "marketValueEur:desc";

  const handleMobileSortChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const [nextSort, nextDir] = event.target.value.split(":");
    const query = new URLSearchParams({ sort: nextSort, dir: nextDir });
    window.location.href = `${basePath}?${query.toString()}`;
  };

  return (
    <>
      <div className="positions-mobile">
        <div className="position-mobile-toolbar">
          <label htmlFor="open-position-mobile-sort">Sort:</label>
          <select id="open-position-mobile-sort" value={activeMobileSort} onChange={handleMobileSortChange}>
            {mobileSortOptions.map((option) => (
              <option key={`${option.sort}-${option.dir}`} value={`${option.sort}:${option.dir}`}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="position-summary-strip">
          <div>
            <span>Total ({totals.positionCount})</span>
            <strong>{formatEur(totals.marketValueEur)}</strong>
          </div>
          <div className={(totals.totalPnlEur || 0) >= 0 ? "tone-positive" : "tone-negative"}>
            <span>P&L</span>
            <strong>{formatSignedEur(totals.totalPnlEur)}</strong>
          </div>
          <div className={(totals.ytdPct || 0) >= 0 ? "tone-positive" : "tone-negative"}>
            <span>YTD</span>
            <strong>{formatPct(totals.ytdPct)}</strong>
          </div>
        </div>

        <div className="position-mobile-list">
          {rows.map((row) => {
            const bias = row.ytdPct ?? 0;
            const sparkline = buildSparkline(row.isin, bias);
            const totalPnlPct = computeTotalPnlPct(row);
            const ytdTone = (row.ytdPct || 0) >= 0 ? "tone-positive" : "tone-negative";
            const totalTone = (row.totalPnlEur || 0) >= 0 ? "tone-positive" : "tone-negative";

            return (
              <details key={row.isin} className="position-mobile-item">
                <summary className="position-mobile-summary">
                  <span className="position-chip" aria-hidden="true">
                    {tickerFromPosition(row)}
                  </span>
                  <span className="position-mobile-main">
                    <span className="position-mobile-name" title={row.name}>
                      {row.name}
                    </span>
                    <span className="position-mobile-meta">
                      {getRegionTag(row)} {"\u00b7"} Qty {formatQty(row.quantity)}
                    </span>
                  </span>
                  <span className="position-mobile-values">
                    <strong>{formatEur(row.marketValueEur)}</strong>
                    <span className={ytdTone}>{formatPct(row.ytdPct)}</span>
                  </span>
                </summary>
                <div className="position-mobile-detail">
                  {row.priceAvailabilityMessage ? <div className="tone-muted">{row.priceAvailabilityMessage}</div> : null}
                  <div>
                    <span>Latest adj close</span>
                    <strong>{formatEur(row.latestAdjCloseEur)}</strong>
                  </div>
                  <div>
                    <span>Total P&L</span>
                    <strong className={totalTone}>
                      {formatSignedEur(row.totalPnlEur)} {"\u00b7"} {formatPct(totalPnlPct)}
                    </strong>
                  </div>
                  <div>
                    <span>YTD P&L</span>
                    <strong className={ytdTone}>{formatSignedEur(row.ytdPnlEur)}</strong>
                  </div>
                  <div className="position-mobile-spark">
                    <span>30D</span>
                    <Sparkline values={sparkline} negative={(row.totalPnlEur || 0) < 0} />
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </div>

      <div className="table-scroll positions-desktop">
        <table className="table">
          <thead>
            <tr>
              {columns.map((column) => {
                const active = sortKey === column.key;
                const nextDir: SortDir = active && sortDir === "asc" ? "desc" : "asc";
                const arrow = active ? (sortDir === "asc" ? "\u25B2" : "\u25BC") : "\u25BE";
                const rightAligned = column.key !== "name" && column.key !== "isin";
                return (
                  <th key={column.key} className={rightAligned ? "text-right" : ""}>
                    <Link
                      href={{
                        pathname: basePath,
                        query: { sort: column.key, dir: nextDir }
                      }}
                      scroll={false}
                      className="table-link"
                    >
                      {column.label} <span aria-hidden="true">{arrow}</span>
                    </Link>
                  </th>
                );
              })}
              <th className="text-right">30D</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const bias = row.ytdPct ?? 0;
              const sparkline = buildSparkline(row.isin, bias);
              return (
                <tr key={row.isin}>
                  <td>
                    <div>{row.name}</div>
                    {row.profileTags.length ? <div className="profile-tags">{row.profileTags.join(" \u00b7 ")}</div> : null}
                    {row.priceAvailabilityMessage ? <div className="tone-muted">{row.priceAvailabilityMessage}</div> : null}
                  </td>
                  <td>{row.isin}</td>
                  <td className="text-right">{formatQty(row.quantity)}</td>
                  <td className="text-right">{formatEur(row.latestAdjCloseEur)}</td>
                  <td className="text-right">{formatEur(row.marketValueEur)}</td>
                  <td className={`text-right ${(row.totalPnlEur || 0) >= 0 ? "tone-positive" : "tone-negative"}`}>
                    {formatEur(row.totalPnlEur)}
                  </td>
                  <td className={`text-right ${(row.ytdPnlEur || 0) >= 0 ? "tone-positive" : "tone-negative"}`}>
                    {formatEur(row.ytdPnlEur)}
                  </td>
                  <td className={`text-right ${(row.ytdPct || 0) >= 0 ? "tone-positive" : "tone-negative"}`}>
                    {formatPct(row.ytdPct)}
                  </td>
                  <td className="text-right">
                    <Sparkline values={sparkline} negative={(row.totalPnlEur || 0) < 0} />
                  </td>
                </tr>
              );
            })}
            <tr className="table-total-row table-total-sticky">
              <td>
                <strong>Total ({totals.positionCount})</strong>
              </td>
              <td>{"\u2014"}</td>
              <td>{"\u2014"}</td>
              <td>{"\u2014"}</td>
              <td className="text-right">{formatEur(totals.marketValueEur)}</td>
              <td className={`text-right ${(totals.totalPnlEur || 0) >= 0 ? "tone-positive" : "tone-negative"}`}>
                {formatEur(totals.totalPnlEur)}
              </td>
              <td className={`text-right ${(totals.ytdPnlEur || 0) >= 0 ? "tone-positive" : "tone-negative"}`}>
                {formatEur(totals.ytdPnlEur)}
              </td>
              <td className={`text-right ${(totals.ytdPct || 0) >= 0 ? "tone-positive" : "tone-negative"}`}>
                {formatPct(totals.ytdPct)}
              </td>
              <td className="text-right">{"\u2014"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
