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
};

type Props = {
  rows: ClosedPositionRow[];
};

// Renders read-only closed position history computed from imported transactions.
export function ClosedPositionsTable({ rows }: Props) {
  if (!rows.length) {
    return <small>No closed positions found yet.</small>;
  }

  return (
    <div className="table-scroll">
      <table className="table table-mobile-stack">
        <thead>
          <tr>
            <th>Product</th>
            <th>ISIN</th>
            <th>P&L (EUR)</th>
            <th>% P&L</th>
            <th>Closed On</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const pnlValue = row.pnl;
            const pnlPct = row.pnlPct;
            const pnlClass = pnlValue === null ? undefined : pnlValue >= 0 ? "tone-positive" : "tone-negative";

            return (
              <tr key={row.instrumentId}>
                <td data-label="Product">{row.name}</td>
                <td data-label="ISIN">{row.isin}</td>
                <td data-label="P&L (EUR)" className={pnlClass}>{pnlValue === null ? "-" : `EUR ${pnlValue.toFixed(2)}`}</td>
                <td data-label="% P&L" className={pnlClass}>
                  {pnlPct === null ? "-" : `${(pnlPct * 100).toFixed(2)}%`}
                </td>
                <td data-label="Closed On">{format(row.closedAt, "yyyy-MM-dd")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
