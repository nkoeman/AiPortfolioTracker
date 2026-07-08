// Transactions page

const TxPage = () => {
  const d = ETFM_DATA;
  const [filter, setFilter] = React.useState("all");

  const rows = filter === "all" ? d.transactions :
    filter === "buy" ? d.transactions.filter(t => t.type === "Buy") :
    d.transactions.filter(t => t.type === "Sell");

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-sub">214 transactions · last import 06 May 2026 · idempotent CSV import</p>
        </div>
        <div className="row">
          <button className="btn"><Icon name="plus" size={14} /> Manual entry</button>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Import DeGiro CSV</h2>
              <p className="card-sub">Drop your transactions export — duplicates are skipped automatically</p>
            </div>
          </div>
          <div className="dropzone">
            <div className="dropzone-icon"><Icon name="upload" size={22} /></div>
            <div>
              <h3>Drop CSV here, or click to browse</h3>
              <p>Supported columns: Datum, Tijd, Product, ISIN, Aantal, Koers, Waarde EUR, Totaal EUR</p>
            </div>
            <button className="btn btn-primary"><Icon name="upload" size={13} /> Choose file</button>
          </div>
          <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
            <div className="row-between" style={{ fontSize: 12.5 }}>
              <span className="muted">Last import</span>
              <span><strong>06 May 2026</strong> · 1 row added · 5 skipped</span>
            </div>
            <div className="row-between" style={{ fontSize: 12.5 }}>
              <span className="muted">Mapped instruments</span>
              <span><strong>8/8</strong> · <span className="pos">100% mapped</span></span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Sync status</h2>
              <p className="card-sub">Pipeline: prices → FX → daily valuation</p>
            </div>
            <button className="btn btn-primary btn-sm"><Icon name="refresh" size={12} /> Sync now</button>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {[
              { label: "EODHD prices (last 4 weeks)", time: "2m ago", state: "ok", note: "All 8 listings up to date" },
              { label: "ECB FX rates", time: "today", state: "ok", note: "5 currencies, weekly granularity" },
              { label: "Daily portfolio valuation", time: "2m ago", state: "ok", note: "365 daily points cached" },
              { label: "iShares enrichment", time: "2 days ago", state: "warn", note: "1 instrument awaiting normalization" },
            ].map((s, i) => (
              <div key={i} className="row-between" style={{
                padding: "10px 12px", background: "var(--surface-2)",
                border: "1px solid var(--border)", borderRadius: 10
              }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: s.state === "ok" ? "var(--pos)" : "var(--warn)",
                    boxShadow: `0 0 0 3px ${s.state === "ok" ? "var(--pos-soft)" : "var(--warn-soft)"}`
                  }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{s.label}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{s.note}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{s.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">All transactions</h2>
            <p className="card-sub">Sorted by date · most recent first</p>
          </div>
          <div className="row">
            <div className="range-pills">
              {[["all", "All"], ["buy", "Buys"], ["sell", "Sells"]].map(([k, l]) => (
                <button key={k} className={`range-pill${filter === k ? " active" : ""}`} onClick={() => setFilter(k)}>{l}</button>
              ))}
            </div>
            <button className="btn btn-sm"><Icon name="download" size={12} /> Export</button>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Instrument</th>
                <th className="right">Qty</th>
                <th className="right">Price</th>
                <th>Currency</th>
                <th>Venue</th>
                <th className="right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t, i) => (
                <tr key={i}>
                  <td className="mono" style={{ fontSize: 12.5 }}>{t.date}</td>
                  <td><span className={`pill ${t.type === "Buy" ? "buy" : "sell"}`}>{t.type}</span></td>
                  <td>{t.name}</td>
                  <td className="right">{fmtNum(Math.abs(t.qty), 0)}</td>
                  <td className="right">{fmtNum(t.price, 2)}</td>
                  <td>{t.ccy}</td>
                  <td className="mono" style={{ fontSize: 12.5 }}>{t.venue}</td>
                  <td className="right" style={{ fontWeight: 500 }}>{fmtEur(t.amt, { digits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

window.TxPage = TxPage;
