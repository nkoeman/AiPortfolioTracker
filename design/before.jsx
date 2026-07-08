// ETFMinded — current/before snapshot, faithful to the existing app

function BeforeShell({ activePage, setActivePage }) {
  return (
    <div className="before" style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 0, minHeight: '100%' }}>
      <aside style={{ background: 'white', borderRight: '1px solid #e5e7eb', padding: '24px 18px', display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ background: '#f3f4f6', height: 56, borderRadius: 8, display: 'grid', placeItems: 'center', fontWeight: 700, color: '#16a34a', fontSize: 16, letterSpacing: '0.04em' }}>
            ETFMinded
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[['performance', 'Performance'], ['portfolio', 'Portfolio'], ['transactions', 'Transactions']].map(([k, l]) => (
            <button key={k} onClick={() => setActivePage(k)} style={{
              padding: '8px 12px', borderRadius: 12, fontSize: 14, textAlign: 'left', cursor: 'pointer',
              border: '1px solid ' + (activePage === k ? '#86efac' : 'transparent'),
              background: activePage === k ? '#f0fdf4' : 'transparent',
              color: activePage === k ? '#16a34a' : '#111827',
              fontWeight: activePage === k ? 600 : 400,
            }}>{l}</button>
          ))}
        </div>
        <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
          <div style={{ background: '#f3f4f6', borderRadius: 999, height: 32, marginBottom: 8 }} />
          <button style={{
            width: '100%', padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 12,
            background: 'white', cursor: 'pointer', fontSize: 14
          }}>Sign out</button>
        </div>
      </aside>
      <main style={{ padding: '16px', overflowY: 'auto' }}>
        {activePage === 'performance' && <BeforePerformance />}
        {activePage === 'portfolio' && <BeforePortfolio />}
        {activePage === 'transactions' && <BeforeTransactions />}
      </main>
    </div>
  );
}

function BeforePerformance() {
  return (
    <>
      <div className="old-card">
        <div className="old-row">
          <div>
            <h2>Portfolio performance</h2>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="old-select">Max ⌄</div>
            <div className="old-select">Value (€) ⌄</div>
          </div>
        </div>
        <div className="old-tile-row">
          <div className="old-tile">
            <small>Return</small>
            <div className="v" style={{ color: '#16a34a' }}>+14.82%</div>
          </div>
          <div className="old-tile">
            <small>Net invested</small>
            <div className="v">+€124,022.87</div>
          </div>
          <div className="old-tile">
            <small>Portfolio gain</small>
            <div className="v" style={{ color: '#16a34a' }}>+€18,362.55</div>
          </div>
        </div>
        <div style={{ height: 240, background: 'linear-gradient(180deg, rgba(34,197,94,0.12), transparent)', borderRadius: 8, position: 'relative' }}>
          <svg width="100%" height="100%" viewBox="0 0 800 240" preserveAspectRatio="none">
            <path d="M0,180 L80,160 L160,170 L240,140 L320,150 L400,120 L480,90 L560,100 L640,70 L720,60 L800,40" stroke="#22c55e" strokeWidth="2" fill="none" />
          </svg>
        </div>
      </div>

      <div className="old-card">
        <h2>Gainers &amp; losers</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, marginBottom: 8 }}>Gainers</div>
            {[['NASDAQ 100', 9.12], ['Core S&P 500', 9.12], ['Semi', 14.10]].map(([n, p], i) => (
              <div key={i} style={{ padding: '6px 0', display: 'flex', justifyContent: 'space-between', fontSize: 14, borderBottom: '1px solid #eef0ee' }}>
                <span>{n}</span><span className="pos-old">+{p}%</span>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, marginBottom: 8 }}>Losers</div>
            {[['MSCI EM IMI', -1.78]].map(([n, p], i) => (
              <div key={i} style={{ padding: '6px 0', display: 'flex', justifyContent: 'space-between', fontSize: 14, borderBottom: '1px solid #eef0ee' }}>
                <span>{n}</span><span className="neg-old">{p}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="old-card">
        <h2>What happend in your portfolio</h2>
        <p className="old-quote">Your portfolio is up 14.82% YTD, driven mainly by US large-cap tech exposure.</p>
        <ul style={{ paddingLeft: 18, color: '#374151', fontSize: 14, marginTop: 8 }}>
          <li>NASDAQ 100 contributed +€2,104 YTD.</li>
          <li>EM IMI dragged −€212.</li>
        </ul>
      </div>
    </>
  );
}

function BeforePortfolio() {
  return (
    <>
      <div className="old-card">
        <h2>Portfolio exposure</h2>
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Exposure coverage: 100% · No data: 0% · As of today</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 0.75fr', gap: 16, marginTop: 12, alignItems: 'center' }}>
          <div style={{ height: 220, display: 'grid', placeItems: 'center' }}>
            <svg width="180" height="180" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="#0f766e" />
              <path d="M50 10 A40 40 0 0 1 89 47 L50 50 Z" fill="#16a34a" />
              <path d="M89 47 A40 40 0 0 1 70 86 L50 50 Z" fill="#0891b2" />
              <path d="M70 86 A40 40 0 0 1 28 88 L50 50 Z" fill="#7c3aed" />
              <path d="M28 88 A40 40 0 0 1 12 60 L50 50 Z" fill="#ea580c" />
              <circle cx="50" cy="50" r="20" fill="white" />
            </svg>
          </div>
          <div>
            {[['North America', 51.4, '#0f766e'], ['Europe', 18.2, '#16a34a'], ['World', 16.7, '#0891b2'], ['EM', 8.2, '#7c3aed'], ['Other', 5.5, '#ea580c']].map(([l, p, c], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 12, marginBottom: 4, background: 'white' }}>
                <span style={{ width: 10, height: 10, background: c, borderRadius: 999 }} />
                <span style={{ flex: 1, fontSize: 13 }}>{l}</span>
                <span style={{ color: '#6b7280', fontSize: 13 }}>{p.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="old-card">
        <h2>Open Positions</h2>
        <table className="old-table" style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>Product &lt;&gt;</th><th>ISIN &lt;&gt;</th><th>Qty &lt;&gt;</th>
              <th>Latest adj close (EUR) &lt;&gt;</th><th>Market value (EUR) &lt;&gt;</th>
              <th>P&L (EUR) &lt;&gt;</th><th>YTD P&L (EUR) &lt;&gt;</th><th>% YTD &lt;&gt;</th>
            </tr>
          </thead>
          <tbody>
            {POSITIONS.slice(0, 5).map(p => (
              <tr key={p.isin}>
                <td>
                  <div>{p.name}</div>
                  <div className="old-tags">{p.tags.join(' | ')}</div>
                </td>
                <td>{p.isin}</td>
                <td>{p.qty.toFixed(4)}</td>
                <td>{p.price.toFixed(4)}</td>
                <td>{p.value.toFixed(2)}</td>
                <td className={p.pnl >= 0 ? 'pos-old' : 'neg-old'}>{p.pnl.toFixed(2)}</td>
                <td className={p.ytdPnl >= 0 ? 'pos-old' : 'neg-old'}>{p.ytdPnl.toFixed(2)}</td>
                <td className={p.ytdPct >= 0 ? 'pos-old' : 'neg-old'}>{p.ytdPct.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="old-card">
        <h2>Closed Positions</h2>
        <table className="old-table" style={{ marginTop: 8 }}>
          <thead>
            <tr><th>Product</th><th>ISIN</th><th>P&L (EUR)</th><th>% P&L</th><th>Closed On</th></tr>
          </thead>
          <tbody>
            <tr><td>iShares Core MSCI Pacific ex-Japan</td><td>IE00B52MJY50</td><td className="pos-old">EUR 1240.50</td><td className="pos-old">8.42%</td><td>2026-02-14</td></tr>
            <tr><td>WisdomTree Cloud Computing</td><td>IE00BJGWQN72</td><td className="pos-old">EUR 599.50</td><td className="pos-old">4.12%</td><td>2025-11-08</td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

function BeforeTransactions() {
  return (
    <>
      <div className="old-card">
        <div className="old-row">
          <div>
            <h2>Data update</h2>
            <small style={{ color: '#6b7280' }}>Run sync jobs to refresh prices and portfolio values.</small>
          </div>
          <button className="old-btn">Sync prices</button>
        </div>
      </div>

      <div className="old-card">
        <h2>Transactions</h2>
        <p style={{ color: '#374151', fontSize: 14 }}>
          Upload your DeGiro transactions export. Supported columns: Datum, Tijd, Product, ISIN, Aantal, Koers, Waarde EUR, Totaal EUR.
        </p>
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <input type="file" style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 8, background: 'white', flex: 1 }} />
          <button className="old-btn">Import</button>
        </div>
        <small style={{ color: '#6b7280' }}>Imports are idempotent: duplicate rows will be skipped.</small>
      </div>

      <div className="old-card">
        <div className="old-row">
          <h2>All Transactions</h2>
          <button className="old-btn">+ Add manually</button>
        </div>
        <table className="old-table" style={{ marginTop: 8 }}>
          <thead>
            <tr><th>Date</th><th>Type</th><th>Name</th><th>Quantity</th><th>Price</th><th>Currency</th><th>Exchange</th><th>Costs</th><th>Amount</th></tr>
          </thead>
          <tbody>
            {[
              ['2026-05-02', 'Buy', 'iShares Core S&P 500 UCITS ETF', '4.2000', '502.7400', 'USD', 'NSDQ', 'USD 1.20', 'EUR 2174.50'],
              ['2026-04-28', 'Buy', 'iShares Core MSCI World UCITS ETF', '12.0000', '92.1800', 'EUR', 'XETRA', 'EUR 1.20', 'EUR 1107.36'],
              ['2026-04-15', 'Sell', 'WisdomTree Cloud Computing', '80.0000', '18.4200', 'EUR', 'EAM', 'EUR 1.20', 'EUR 1473.60'],
              ['2026-04-04', 'Buy', 'Vanguard FTSE All-World UCITS ETF', '6.5000', '124.1800', 'EUR', 'EAM', 'EUR 1.20', 'EUR 808.17'],
            ].map((row, i) => (
              <tr key={i}>{row.map((c, j) => <td key={j}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

window.BeforeShell = BeforeShell;
