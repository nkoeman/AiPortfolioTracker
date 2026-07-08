"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";

type TransactionRow = {
  id: string;
  date: string;
  type: "Buy" | "Sell";
  name: string;
  quantity: string;
  price: string;
  currency: string;
  exchangeCode: string;
  amount: string;
};

type TransactionsTableClientProps = {
  rows: TransactionRow[];
  actions?: ReactNode;
};

type Filter = "all" | "buy" | "sell";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "buy", label: "Buys" },
  { key: "sell", label: "Sells" }
];

export function TransactionsTableClient({ rows, actions }: TransactionsTableClientProps) {
  const [filter, setFilter] = useState<Filter>("all");

  const filteredRows = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "buy") return rows.filter((row) => row.type === "Buy");
    return rows.filter((row) => row.type === "Sell");
  }, [filter, rows]);

  return (
    <div className="card transactions-card">
      <div className="card-head transactions-head">
        <div>
          <h2 className="card-title">All transactions</h2>
          <p className="card-sub">Sorted by date - most recent first</p>
        </div>
        <div className="transactions-controls">
          <div className="range-pills" aria-label="Filter transactions">
            {FILTERS.map((entry) => (
              <button
                key={entry.key}
                type="button"
                className={`range-pill${filter === entry.key ? " active" : ""}`}
                onClick={() => setFilter(entry.key)}
              >
                {entry.label}
              </button>
            ))}
          </div>
          {actions}
        </div>
      </div>

      {!rows.length ? (
        <div className="empty-transactions">
          <div className="dropzone-icon" aria-hidden="true">
            CSV
          </div>
          <h3>No transactions yet</h3>
          <p>Import your DeGiro transactions export to build performance, exposure, and activity history.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => document.querySelector<HTMLElement>(".dropzone")?.click()}
          >
            Import your DeGiro CSV
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table transactions-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Instrument</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Price</th>
                <th>Currency</th>
                <th>Venue</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td className="mono">{row.date}</td>
                  <td>
                    <span className={`pill ${row.type === "Buy" ? "buy" : "sell"}`}>{row.type}</span>
                  </td>
                  <td className="transaction-name" title={row.name}>
                    {row.name}
                  </td>
                  <td className="text-right mono">{row.quantity}</td>
                  <td className="text-right mono">{row.price}</td>
                  <td className="mono">{row.currency}</td>
                  <td className="mono">{row.exchangeCode}</td>
                  <td className="text-right mono amount-cell">{row.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
