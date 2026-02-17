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
    <table className="table">
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
              <td>{row.name}</td>
              <td>{row.isin}</td>
              <td className={pnlClass}>{pnlValue === null ? "-" : `EUR ${pnlValue.toFixed(2)}`}</td>
              <td className={pnlClass}>
                {pnlPct === null ? "-" : `${(pnlPct * 100).toFixed(2)}%`}
              </td>
              <td>{format(row.closedAt, "yyyy-MM-dd")}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
