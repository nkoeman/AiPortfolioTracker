// Performance page

const KPIStrip = ({ d }) => (
  <div className="kpi-strip">
    <div className="kpi kpi-hero">
      <div className="kpi-label">Portfolio value</div>
      <div className="kpi-value">{fmtEur(d.totalValue, { digits: 2 })}</div>
      <div className="kpi-meta">
        <span className={`delta ${d.todayDeltaEur >= 0 ? "pos" : "neg"}`}>
          {d.todayDeltaEur >= 0 ? "▲" : "▼"} {fmtEur(Math.abs(d.todayDeltaEur), { digits: 2 })} · {fmtPct(d.todayDeltaPct)}
        </span>
        <span>today</span>
      </div>
    </div>
    <div className="kpi">
      <div className="kpi-label">Total return</div>
      <div className="kpi-value pos">{fmtEur(d.totalReturnEur, { digits: 0 })}</div>
      <div className="kpi-meta">
        <span className="delta pos">{fmtPct(d.totalReturnPct)}</span>
        <span>since inception</span>
      </div>
    </div>
    <div className="kpi">
      <div className="kpi-label">Year to date</div>
      <div className="kpi-value pos">{fmtEur(d.ytdEur, { digits: 0 })}</div>
      <div className="kpi-meta">
        <span className="delta pos">{fmtPct(d.ytdPct)}</span>
        <span>YTD</span>
      </div>
    </div>
    <div className="kpi">
      <div className="kpi-label">Net invested</div>
      <div className="kpi-value">{fmtEur(d.totalInvested, { digits: 0 })}</div>
      <div className="kpi-meta">
        <span>8 positions · 214 trades</span>
      </div>
    </div>
  </div>
);

const PerfPage = () => {
  const d = ETFM_DATA;
  const [range, setRange] = React.useState("1Y");
  const [metric, setMetric] = React.useState("value");
  const [moverTab, setMoverTab] = React.useState("gain");

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Performance</h1>
          <p className="page-sub">As of {d.asOf} · prices via EODHD, FX via ECB</p>
        </div>
        <div className="row">
          <button className="btn"><Icon name="download" size={14} /> Export</button>
          <button className="btn btn-primary"><Icon name="refresh" size={14} /> Sync</button>
        </div>
      </div>

      <KPIStrip d={d} />

      <div className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Portfolio value</h2>
            <p className="card-sub">Value vs. invested capital · all amounts in EUR</p>
          </div>
          <div className="row">
            <div className="range-pills">
              {["value", "return"].map(m => (
                <button key={m} className={`range-pill${metric === m ? " active" : ""}`} onClick={() => setMetric(m)}>
                  {m === "value" ? "Value" : "Return %"}
                </button>
              ))}
            </div>
            <div className="range-pills">
              {["1M", "3M", "YTD", "1Y", "MAX"].map(r => (
                <button key={r} className={`range-pill${range === r ? " active" : ""}`} onClick={() => setRange(r)}>{r}</button>
              ))}
            </div>
          </div>
        </div>
        <PerformanceChart series={d.series} range={range} />
        <div className="chart-legend" style={{ marginTop: 10 }}>
          <span><span className="legend-swatch" style={{ background: "var(--brand)" }} /> Portfolio value</span>
          <span><span className="legend-swatch" style={{ background: "var(--muted)", height: 2, marginTop: 4 }} /> Invested</span>
          <span style={{ marginLeft: "auto" }}>Sharpe 0.92 · Vol 11.4% · Max DD −7.8%</span>
        </div>
      </div>

      <div className="grid-2">
        <div className="card ai-card">
          <div className="card-head">
            <div>
              <span className="ai-badge"><Icon name="sparkles" size={11} /> AI INSIGHT</span>
              <h2 className="card-title" style={{ marginTop: 8 }}>What happened in your portfolio</h2>
            </div>
            <button className="btn-ghost btn btn-sm"><Icon name="refresh" size={12} /> Regenerate</button>
          </div>
          <p className="ai-quote">
            Steady gains across global equity, with US large-caps doing the heavy lifting while real estate held you back.
          </p>
          <ul className="ai-bullets">
            <li>SXR8 added <strong className="pos">€2.4k</strong> over 4 weeks (+8.4%) — largest contributor.</li>
            <li>VWCE quietly compounded <strong className="pos">€4.8k</strong>, now your biggest weight at 26.4%.</li>
            <li>REIT exposure dragged <strong className="neg">−€640</strong>, third consecutive negative week.</li>
            <li>Fresh capital of €2.1k deployed across VWCE and EIMI on 06 May.</li>
          </ul>
          <div className="ai-meta">
            <span>4-week window · last refresh 12 min ago</span>
            <span style={{ marginLeft: "auto" }}>Model: gpt-4o-mini</span>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Top movers</h2>
              <p className="card-sub">Contribution to total return · last 30 days</p>
            </div>
            <div className="range-pills">
              {[["gain", "Gainers"], ["loss", "Losers"]].map(([k, l]) => (
                <button key={k} className={`range-pill${moverTab === k ? " active" : ""}`} onClick={() => setMoverTab(k)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="movers-list">
            {(moverTab === "gain" ? d.movers : d.losers).map((m, i) => {
              const max = Math.max(...d.movers.map(x => Math.abs(x.pct)));
              const w = (Math.abs(m.pct) / max) * 100;
              return (
                <div className="mover-row" key={m.ticker}>
                  <div className="mover-rank">{String(i + 1).padStart(2, "0")}</div>
                  <div>
                    <div className="mover-name">{m.ticker} · <span className="muted" style={{ fontWeight: 400 }}>{m.name}</span></div>
                    <div className="mover-isin">{m.isin}</div>
                  </div>
                  <div className="mover-bar-wrap">
                    <div className={`mover-bar ${m.pct >= 0 ? "pos" : "neg"}`} style={{ width: `${w}%` }} />
                  </div>
                  <div className={`mover-pct ${m.pct >= 0 ? "pos" : "neg"}`}>{fmtPct(m.pct)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

window.PerfPage = PerfPage;
