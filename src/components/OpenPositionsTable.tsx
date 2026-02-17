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

type SortDir = "asc" | "desc";

type Props = {
  rows: OpenPositionRow[];
  columns: OpenPositionColumn[];
  sortKey: string;
  sortDir: SortDir;
  basePath: string;
};

export function OpenPositionsTable({ rows, columns, sortKey, sortDir, basePath }: Props) {
  return (
    <table className="table">
      <thead>
        <tr>
          {columns.map((column) => {
            const active = sortKey === column.key;
            const nextDir: SortDir = active && sortDir === "asc" ? "desc" : "asc";
            const arrow = active ? (sortDir === "asc" ? "▲" : "▼") : "↕";
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
            <td>
              <div>{row.name}</div>
              {row.profileTags.length ? (
                <div className="profile-tags">{row.profileTags.join(" | ")}</div>
              ) : null}
            </td>
            <td>{row.isin}</td>
            <td>{row.quantity.toFixed(4)}</td>
            <td>{row.latestAdjCloseEur === null ? "-" : row.latestAdjCloseEur.toFixed(4)}</td>
            <td>{row.marketValueEur === null ? "-" : row.marketValueEur.toFixed(2)}</td>
            <td className={(row.totalPnlEur || 0) >= 0 ? "tone-positive" : "tone-negative"}>
              {row.totalPnlEur === null ? "-" : row.totalPnlEur.toFixed(2)}
            </td>
            <td className={(row.ytdPnlEur || 0) >= 0 ? "tone-positive" : "tone-negative"}>
              {row.ytdPnlEur === null ? "-" : row.ytdPnlEur.toFixed(2)}
            </td>
            <td className={(row.ytdPct || 0) >= 0 ? "tone-positive" : "tone-negative"}>
              {row.ytdPct === null ? "-" : `${(row.ytdPct * 100).toFixed(2)}%`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
