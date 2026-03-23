import Link from "next/link";

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

function formatMaybe(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return "-";
  return value.toFixed(digits);
}

export function OpenPositionsTable({ rows, columns, sortKey, sortDir, basePath, totals }: Props) {
  return (
    <div className="table-scroll">
      <table className="table table-mobile-stack">
        <thead>
          <tr>
            {columns.map((column) => {
              const active = sortKey === column.key;
              const nextDir: SortDir = active && sortDir === "asc" ? "desc" : "asc";
              const arrow = active ? (sortDir === "asc" ? "^" : "v") : "<>";
              return (
                <th key={column.key}>
                  <Link
                    href={{
                      pathname: basePath,
                      query: { sort: column.key, dir: nextDir }
                    }}
                    scroll={false}
                    className="table-link"
                  >
                    {column.label} {arrow}
                  </Link>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.isin}>
              <td data-label="Product">
                <div>{row.name}</div>
                {row.profileTags.length ? (
                  <div className="profile-tags">{row.profileTags.join(" | ")}</div>
                ) : null}
              </td>
              <td data-label="ISIN">{row.isin}</td>
              <td data-label="Qty">{row.quantity.toFixed(4)}</td>
              <td data-label="Latest adj close (EUR)">
                {row.latestAdjCloseEur === null ? "-" : row.latestAdjCloseEur.toFixed(4)}
              </td>
              <td data-label="Market value (EUR)">
                {row.marketValueEur === null ? "-" : row.marketValueEur.toFixed(2)}
              </td>
              <td data-label="P&L (EUR)" className={(row.totalPnlEur || 0) >= 0 ? "tone-positive" : "tone-negative"}>
                {row.totalPnlEur === null ? "-" : row.totalPnlEur.toFixed(2)}
              </td>
              <td data-label="YTD P&L (EUR)" className={(row.ytdPnlEur || 0) >= 0 ? "tone-positive" : "tone-negative"}>
                {row.ytdPnlEur === null ? "-" : row.ytdPnlEur.toFixed(2)}
              </td>
              <td data-label="% YTD" className={(row.ytdPct || 0) >= 0 ? "tone-positive" : "tone-negative"}>
                {row.ytdPct === null ? "-" : `${(row.ytdPct * 100).toFixed(2)}%`}
              </td>
            </tr>
          ))}
          <tr className="table-total-row">
            <td data-label="Product">
              <strong>Total ({totals.positionCount})</strong>
            </td>
            <td data-label="ISIN">-</td>
            <td data-label="Qty">-</td>
            <td data-label="Latest adj close (EUR)">-</td>
            <td data-label="Market value (EUR)">{formatMaybe(totals.marketValueEur)}</td>
            <td
              data-label="P&L (EUR)"
              className={(totals.totalPnlEur || 0) >= 0 ? "tone-positive" : "tone-negative"}
            >
              {formatMaybe(totals.totalPnlEur)}
            </td>
            <td
              data-label="YTD P&L (EUR)"
              className={(totals.ytdPnlEur || 0) >= 0 ? "tone-positive" : "tone-negative"}
            >
              {formatMaybe(totals.ytdPnlEur)}
            </td>
            <td data-label="% YTD" className={(totals.ytdPct || 0) >= 0 ? "tone-positive" : "tone-negative"}>
              {totals.ytdPct === null ? "-" : `${(totals.ytdPct * 100).toFixed(2)}%`}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
