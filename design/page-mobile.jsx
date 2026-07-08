// Mobile screens for ETFMinded

const MTabs = ({ active, onTab }) => (
  <div className="m-tabs">
    {[
      ["performance", "performance", "Home"],
      ["portfolio", "portfolio", "Portfolio"],
      ["transactions", "transactions", "Activity"],
      ["insights", "insights", "Insights"],
    ].map(([k, ic, l]) => (
      <div key={k} className={`m-tab${active === k ? " active" : ""}`} onClick={() => onTab && onTab(k)}>
        <Icon name={ic} size={20} />
        <span>{l}</span>
      </div>
    ))}
  </div>
);

const MTop = ({ title }) => (
  <div className="m-top">
    <div className="m-top-brand">
      <div className="brand-mark">E</div>
      <div className="brand-name">{title}</div>
    </div>
    <div className="m-top-actions">
      <button className="m-iconbtn"><Icon name="search" size={15} /></button>
      <button className="m-iconbtn"><Icon name="bell" size={15} /></button>
    </div>
  </div>
);

const MPerf = () => {
  const d = ETFM_DATA;
  const [range, setRange] = React.useState("1Y");
  return (
    <div className="m-app">
      <MTop title="ETFMinded" />
      <div className="m-scroll">
        <div className="m-hero">
          <div className="m-hero-label">Portfolio value</div>
          <div className="m-hero-value">{fmtEur(d.totalValue, { digits: 2 })}</div>
          <div className="m-hero-row">
            <span className="delta pos">▲ {fmtEur(d.todayDeltaEur, { digits: 0 })} · {fmtPct(d.todayDeltaPct)}</span>
            <span>today</span>
          </div>
        </div>

        <div className="m-stats">
          <div className="m-stat">
            <div className="m-stat-label">Total return</div>
            <div className="m-stat-value pos">{fmtEur(d.totalReturnEur, { digits: 0 })}</div>
            <div className="m-stat-meta">{fmtPct(d.totalReturnPct)} all-time</div>
          </div>
          <div className="m-stat">
            <div className="m-stat-label">Year to date</div>
            <div className="m-stat-value pos">{fmtEur(d.ytdEur, { digits: 0 })}</div>
            <div className="m-stat-meta">{fmtPct(d.ytdPct)} YTD</div>
          </div>
        </div>

        <div className="m-card">
          <div className="m-card-head">
            <div>
              <h3 className="m-card-title">Value over time</h3>
              <p className="m-card-sub">vs invested capital</p>
            </div>
          </div>
          <div className="m-pills" style={{ marginBottom: 10 }}>
            {["1M", "3M", "YTD", "1Y", "MAX"].map(r => (
              <button key={r} className={`m-pill${range === r ? " active" : ""}`} onClick={() => setRange(r)}>{r}</button>
            ))}
          </div>
          <PerformanceChart series={d.series} range={range} />
        </div>

        <div className="m-card" style={{
          background: "linear-gradient(145deg, var(--brand-soft-2) 0%, var(--surface) 70%)"
        }}>
          <div className="m-card-head">
            <span className="ai-badge"><Icon name="sparkles" size={11} /> AI INSIGHT</span>
            <span className="m-card-sub">12m ago</span>
          </div>
          <p className="m-ai-quote">
            US large-caps led your gains; real estate dragged.
          </p>
          <ul className="m-ai-bullets">
            <li>SXR8 added <strong className="pos">€2.4k</strong> over 4 weeks (+8.4%).</li>
            <li>VWCE compounded <strong className="pos">€4.8k</strong>, now 26.4% of book.</li>
            <li>REIT exposure −<strong className="neg">€640</strong>, third negative week.</li>
          </ul>
        </div>

        <div className="m-card">
          <div className="m-card-head">
            <div>
              <h3 className="m-card-title">Top movers</h3>
              <p className="m-card-sub">Last 30 days</p>
            </div>
            <button className="btn btn-sm btn-ghost"><Icon name="external" size={11} /></button>
          </div>
          {d.movers.slice(0, 4).map((m) => (
            <div className="m-mover" key={m.ticker}>
              <div className="m-mover-tick">{m.ticker}</div>
              <div>
                <div className="m-mover-name">{m.name}</div>
                <div className="m-mover-isin">{m.isin}</div>
              </div>
              <div className={`m-mover-pct ${m.pct >= 0 ? "pos" : "neg"}`}>{fmtPct(m.pct, 1)}</div>
            </div>
          ))}
        </div>
      </div>
      <MTabs active="performance" />
    </div>
  );
};

const MPortfolio = () => {
  const d = ETFM_DATA;
  const [view, setView] = React.useState("region");
  const exposure = d.exposure[view];
  return (
    <div className="m-app">
      <MTop title="Portfolio" />
      <div className="m-scroll">
        <div className="m-card">
          <div className="m-card-head">
            <div>
              <h3 className="m-card-title">Exposure</h3>
              <p className="m-card-sub">{exposure.length} buckets · 96.4% coverage</p>
            </div>
            <div className="m-pills">
              {[["region", "Region"], ["sector", "Sector"]].map(([k, l]) => (
                <button key={k} className={`m-pill${view === k ? " active" : ""}`} onClick={() => setView(k)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="m-donut-wrap">
            <Donut data={exposure} />
          </div>
          <div className="m-legend">
            {exposure.map((e) => (
              <div key={e.name} className="m-legend-row">
                <span className="exposure-dot" style={{ background: e.color }} />
                <span>{e.name}</span>
                <span className="exposure-pct">{e.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="m-card">
          <div className="m-card-head">
            <div>
              <h3 className="m-card-title">Open positions</h3>
              <p className="m-card-sub">{d.positions.length} holdings · sorted by value</p>
            </div>
            <button className="btn btn-sm btn-ghost"><Icon name="filter" size={12} /></button>
          </div>
          {[...d.positions].sort((a, b) => b.mv - a.mv).map((r, i) => (
            <div className="m-position" key={r.isin}>
              <div className="m-position-tick">{r.ticker}</div>
              <div style={{ minWidth: 0 }}>
                <div className="m-position-name">{r.name}</div>
                <div className="m-position-meta">
                  <span className="m-position-tag">{r.region}</span>
                  <span>{fmtNum(r.qty, 0)} units</span>
                </div>
              </div>
              <div className="m-position-right">
                <div className="m-position-mv">{fmtEur(r.mv, { digits: 0 })}</div>
                <div className={`m-position-pct ${r.pnl >= 0 ? "pos" : "neg"}`}>{fmtPct(r.ytdPct, 1)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <MTabs active="portfolio" />
    </div>
  );
};

const MTx = () => {
  const d = ETFM_DATA;
  return (
    <div className="m-app">
      <MTop title="Activity" />
      <div className="m-scroll">
        <div className="m-card">
          <div className="m-card-head">
            <div>
              <h3 className="m-card-title">Sync status</h3>
              <p className="m-card-sub">Prices · 2m ago · all good</p>
            </div>
            <button className="btn btn-primary btn-sm"><Icon name="refresh" size={12} /></button>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {[
              ["Prices (EODHD)", "2m ago", "ok"],
              ["FX rates (ECB)", "today", "ok"],
              ["Portfolio valuation", "2m ago", "ok"],
              ["iShares enrichment", "2d ago", "warn"],
            ].map(([l, t, s], i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 10px", background: "var(--surface-2)",
                border: "1px solid var(--border)", borderRadius: 9, fontSize: 12
              }}>
                <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: s === "ok" ? "var(--pos)" : "var(--warn)"
                  }} />
                  {l}
                </span>
                <span className="muted">{t}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="m-card">
          <div className="m-card-head">
            <div>
              <h3 className="m-card-title">Import CSV</h3>
              <p className="m-card-sub">DeGiro export</p>
            </div>
          </div>
          <div className="m-dropzone">
            <div className="dropzone-icon"><Icon name="upload" size={20} /></div>
            <div>
              <h3 style={{ margin: 0, fontSize: 14, fontFamily: "var(--font-display)" }}>Tap to upload</h3>
              <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "var(--muted)" }}>Last: 06 May, 1 row added</p>
            </div>
          </div>
        </div>

        <div className="m-card">
          <div className="m-card-head">
            <div>
              <h3 className="m-card-title">Recent transactions</h3>
              <p className="m-card-sub">214 total</p>
            </div>
            <button className="btn btn-sm btn-ghost"><Icon name="filter" size={12} /></button>
          </div>
          {d.transactions.slice(0, 8).map((t, i) => (
            <div className="m-tx" key={i}>
              <div>
                <div className="m-tx-name">{t.name}</div>
                <div className="m-tx-meta">
                  <span className={`pill ${t.type === "Buy" ? "buy" : "sell"}`}>{t.type}</span>
                  <span>{Math.abs(t.qty)} @ {fmtNum(t.price, 2)}</span>
                </div>
              </div>
              <div>
                <div className={`m-tx-amt ${t.type === "Buy" ? "" : "pos"}`}>{fmtEur(t.amt, { digits: 0 })}</div>
                <div className="m-tx-date">{t.date}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <MTabs active="transactions" />
    </div>
  );
};

window.MPerf = MPerf;
window.MPortfolio = MPortfolio;
window.MTx = MTx;
