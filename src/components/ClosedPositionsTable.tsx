import { format } from "date-fns";

export type ClosedPositionRow = {
  instrumentId: string;
  name: string;
  isin: string;
  buyCostEur: number | null;
  sellProceedsEur: number | null;
  pnl: number | null;
  pnlPct: number | null;
  closedAt: Date;
  priceAvailabilityMessage: string | null;
};

type Props = {
  rows: ClosedPositionRow[];
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

function formatPct(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "\u2014";
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
}

// Renders read-only closed position history computed from imported transactions.
export function ClosedPositionsTable({ rows }: Props) {
  if (!rows.length) {
    return <small>No closed positions found yet.</small>;
  }

  return (
    <>
      <div className="positions-mobile closed-positions-mobile">
        <div className="position-mobile-list">
          {rows.map((row) => {
            const pnlClass = row.pnl === null ? "" : row.pnl >= 0 ? "tone-positive" : "tone-negative";
            return (
              <div key={row.instrumentId} className="closed-position-mobile-row">
                <div className="position-mobile-main">
                  <span className="position-mobile-name" title={row.name}>
                    {row.name}
                  </span>
                  <span className="position-mobile-meta">
                    {row.isin} {"\u00b7"} Closed {format(row.closedAt, "yyyy-MM-dd")}
                  </span>
                  {row.priceAvailabilityMessage ? <span className="tone-muted">{row.priceAvailabilityMessage}</span> : null}
                </div>
                <div className={`closed-position-values ${pnlClass}`}>
                  <strong>{formatSignedEur(row.pnl)}</strong>
                  <span>{formatPct(row.pnlPct)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="table-scroll positions-desktop">
        <table className="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>ISIN</th>
              <th className="text-right">P&L (EUR)</th>
              <th className="text-right">% P&L</th>
              <th>Closed On</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const pnlValue = row.pnl;
              const pnlClass = pnlValue === null ? undefined : pnlValue >= 0 ? "tone-positive" : "tone-negative";

              return (
                <tr key={row.instrumentId}>
                  <td>
                    <div>{row.name}</div>
                    {row.priceAvailabilityMessage ? <div className="tone-muted">{row.priceAvailabilityMessage}</div> : null}
                  </td>
                  <td>{row.isin}</td>
                  <td className={`text-right ${pnlClass || ""}`}>{formatEur(pnlValue)}</td>
                  <td className={`text-right ${pnlClass || ""}`}>{formatPct(row.pnlPct)}</td>
                  <td>{format(row.closedAt, "yyyy-MM-dd")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
