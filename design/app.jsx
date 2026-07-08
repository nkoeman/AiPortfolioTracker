// Main app — composes shell + page into an artboard

const Screen = ({ active, label }) => (
  <div className="shell" data-screen-label={label}>
    <Sidebar active={active} onNav={() => {}} />
    <div className="app-main">
      <Topbar crumb={
        active === "performance" ? "Performance" :
        active === "portfolio" ? "Portfolio" : "Transactions"
      } />
      {active === "performance" ? <PerfPage /> :
       active === "portfolio" ? <PortfolioPage /> :
       <TxPage />}
    </div>
  </div>
);

const App = () => {
  const root = (
    <DesignCanvas title="ETFMinded — mobile-first redesign" subtitle="iPhone screens first · then desktop · light theme">
      <DCSection id="mobile" title="Mobile (primary)">
        <DCArtboard id="m-perf" label="01 — Performance (mobile)" width={402} height={874}>
          <IOSDevice><MPerf /></IOSDevice>
        </DCArtboard>
        <DCArtboard id="m-port" label="02 — Portfolio (mobile)" width={402} height={874}>
          <IOSDevice><MPortfolio /></IOSDevice>
        </DCArtboard>
        <DCArtboard id="m-tx" label="03 — Activity (mobile)" width={402} height={874}>
          <IOSDevice><MTx /></IOSDevice>
        </DCArtboard>
      </DCSection>
      <DCSection id="desktop" title="Desktop">
        <DCArtboard id="perf" label="01 — Performance (desktop)" width={1440} height={1100}>
          <Screen active="performance" label="01 Performance" />
        </DCArtboard>
        <DCArtboard id="portfolio" label="02 — Portfolio (desktop)" width={1440} height={1300}>
          <Screen active="portfolio" label="02 Portfolio" />
        </DCArtboard>
        <DCArtboard id="tx" label="03 — Transactions (desktop)" width={1440} height={1250}>
          <Screen active="transactions" label="03 Transactions" />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
  return root;
};

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
