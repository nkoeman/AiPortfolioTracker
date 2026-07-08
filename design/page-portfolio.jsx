// Portfolio page

const PortfolioPage = () => {
  const d = ETFM_DATA;
  const [view, setView] = React.useState("region");
  const [active, setActive] = React.useState(null);
  const [sortKey, setSortKey] = React.useState("mv");
  const [sortDir, setSortDir] = React.useState("desc");

  const exposure = d.exposure[view];

  const sortedRows = [...d.positions].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === "asc" ? av - bv : bv - av;
  });

  const totals = sortedRows.reduce((acc, r) => ({
    mv: acc.mv + r.mv, pnl: acc.pnl + r.pnl
  }), { mv: 0, pnl: 0 });

  const onSort = (k) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  const arr = (k) => sortKey === k ? (sortDir === "asc" ? "▲" : "▼") : "";

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Portfolio</h1>
          <p className="page-sub">8 open positions · {fmtEur(d.totalValue, { digits: 0 })} market value · 96.4% exposure coverage</p>
        </div>
        <div className="row">
          <button className="btn"><Icon name="filter" size={14} /> Filter</button>
          <button className="btn btn-primary"><Icon name="plus" size={14} /> Add position</button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Portfolio exposure</h2>
            <p className="card-sub">Normalized exposure across {sortedRows.length} holdings</p>
          </div>
          <div className="range-pills">
            {[["region", "Region"], ["sector", "Sector"]].map(([k, l]) => (
              <button key={k} className={`range-pill${view === k ? " active" : ""}`} onClick={() => setView(k)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="exposure-row">
          <div style={{ display: "grid", placeItems: "center" }}>
            <Donut data={exposure} active={active} onHover={setActive} />
          </div>
          <div className="exposure-legend">
            {exposure.map((e, i) => (
              <div key={e.name} className={`exposure-leg-row${active === i ? " active" : ""}`}
                onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}>
                <span className="exposure-dot" style={{ background: e.color }} />
                <span>{e.name}</span>
                <span className="exposure-pct">{e.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Open positions</h2>
            <p className="card-sub">Click a column header to sort · click a row for full detail</p>
          </div>
          <div className="row">
            <button className="btn btn-sm"><Icon name="download" size={12} /> CSV</button>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th className="sortable" onClick={() => onSort("name")}>Product <span className="sort-arrow">{arr("name") || "⇅"}</span></th>
                <th>Tags</th>
                <th className="right sortable" onClick={() => onSort("qty")}>Qty <span className="sort-arrow">{arr("qty") || "⇅"}</span></th>
                <th className="right sortable" onClick={() => onSort("price")}>Price <span className="sort-arrow">{arr("price") || "⇅"}</span></th>
                <th>30d</th>
                <th className={`right sortable${sortKey === "mv" ? " active" : ""}`} onClick={() => onSort("mv")}>Market value <span className="sort-arrow">{arr("mv") || "⇅"}</span></th>
                <th className="right sortable" onClick={() => onSort("pnl")}>Total P&L <span className="sort-arrow">{arr("pnl") || "⇅"}</span></th>
                <th className="right sortable" onClick={() => onSort("ytdPct")}>YTD <span className="sort-arrow">{arr("ytdPct") || "⇅"}</span></th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r, i) => {
                const trend = r.pnlPct > 0 ? 0.4 : -0.4;
                const sp = makeSpark(i + 1, 24, trend);
                return (
                  <tr key={r.isin}>
                    <td>
                      <div className="cell-product">
                        <div className="ticker">{r.ticker}</div>
                        <div className="cell-product-meta">
                          <div className="cell-product-name">{r.name}</div>
                          <div className="cell-product-isin">{r.isin}</div>
                        </div>
                      </div>
                    </td>
                    <td><div className="tags"><span className="tag">{r.region}</span><span className="tag">{r.type}</span></div></td>
                    <td className="right">{fmtNum(r.qty, 0)}</td>
                    <td className="right">{fmtEur(r.price, { digits: 2 })}</td>
                    <td><Sparkline values={sp} neg={r.pnl < 0} /></td>
                    <td className="right" style={{ fontWeight: 500 }}>{fmtEur(r.mv, { digits: 0 })}</td>
                    <td className={`right ${r.pnl >= 0 ? "pos" : "neg"}`}>
                      {fmtEur(r.pnl, { digits: 0 })} <span style={{ opacity: 0.7, fontSize: 11 }}>({fmtPct(r.pnlPct, 1)})</span>
                    </td>
                    <td className={`right ${r.ytdPct >= 0 ? "pos" : "neg"}`}>{fmtPct(r.ytdPct, 1)}</td>
                  </tr>
                );
              })}
              <tr className="totals">
                <td colSpan={5}><strong>Total · {sortedRows.length} positions</strong></td>
                <td className="right">{fmtEur(totals.mv, { digits: 0 })}</td>
                <td className={`right ${totals.pnl >= 0 ? "pos" : "neg"}`}>{fmtEur(totals.pnl, { digits: 0 })}</td>
                <td className="right pos">+5.4%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

window.PortfolioPage = PortfolioPage;
