// App shell — sidebar + topbar shared across all pages

const Sidebar = ({ active, onNav }) => (
  <aside className="sidebar">
    <div className="brand-row">
      <div className="brand-mark">E</div>
      <div className="brand-name">ETF<em>Minded</em></div>
    </div>

    <div className="nav-section">
      <div className="nav-label">Overview</div>
      <div className={`nav-link${active === "performance" ? " active" : ""}`} onClick={() => onNav("performance")}>
        <Icon name="performance" /> <span>Performance</span> <span className="nav-hint">+5.4%</span>
      </div>
      <div className={`nav-link${active === "portfolio" ? " active" : ""}`} onClick={() => onNav("portfolio")}>
        <Icon name="portfolio" /> <span>Portfolio</span> <span className="nav-hint">8</span>
      </div>
      <div className={`nav-link${active === "transactions" ? " active" : ""}`} onClick={() => onNav("transactions")}>
        <Icon name="transactions" /> <span>Transactions</span> <span className="nav-hint">214</span>
      </div>
    </div>

    <div className="nav-section">
      <div className="nav-label">Intelligence</div>
      <div className="nav-link">
        <Icon name="insights" /> <span>AI insights</span>
        <span className="pill" style={{ fontSize: 9, padding: "1px 5px" }}>NEW</span>
      </div>
      <div className="nav-link">
        <Icon name="settings" /> <span>Settings</span>
      </div>
    </div>

    <div className="sidebar-foot">
      <div className="sync-card">
        <div className="sync-row">
          <span><span className="sync-dot"></span> Prices synced</span>
          <span className="sync-time">2m ago</span>
        </div>
        <div className="sync-row">
          <span>FX (ECB)</span>
          <span className="sync-time">today</span>
        </div>
        <div className="sync-row">
          <button className="btn btn-sm" style={{ width: "100%", justifyContent: "center" }}>
            <Icon name="refresh" size={12} /> Sync now
          </button>
        </div>
      </div>
      <div className="user-row">
        <div className="avatar">NK</div>
        <div style={{ minWidth: 0 }}>
          <div className="user-name">Niels Koeman</div>
          <div className="user-email">niels@etfminded.com</div>
        </div>
      </div>
    </div>
  </aside>
);

const Topbar = ({ crumb, onTheme }) => (
  <header className="topbar">
    <div className="topbar-left">
      <div className="crumbs">
        <span>ETFMinded</span>
        <span className="sep">/</span>
        <span className="now">{crumb}</span>
      </div>
    </div>
    <div className="topbar-right">
      <div className="search">
        <Icon name="search" size={14} />
        <span>Search positions, ISIN…</span>
        <kbd>⌘K</kbd>
      </div>
      <button className="icon-btn" title="Notifications"><Icon name="bell" size={15} /></button>
      <button className="icon-btn" title="Theme" onClick={onTheme}><Icon name="moon" size={15} /></button>
    </div>
  </header>
);

window.Sidebar = Sidebar;
window.Topbar = Topbar;
