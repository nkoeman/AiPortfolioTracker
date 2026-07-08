// Mock data for ETFMinded redesign

window.ETFM_DATA = {
  user: { name: "Niels Koeman", email: "niels@etfminded.com", initials: "NK" },
  lastSync: "2m ago",
  asOf: "07 May 2026, 17:35 CET",

  // KPIs
  totalValue: 184230.42,
  totalInvested: 142800.00,
  totalReturnEur: 41430.42,
  totalReturnPct: 0.2901,
  todayDeltaEur: 612.18,
  todayDeltaPct: 0.0033,
  ytdEur: 9420.55,
  ytdPct: 0.054,

  // Performance series — 365 daily points
  series: (function () {
    const out = [];
    let v = 142800;
    let invested = 100000;
    const start = new Date(2025, 4, 7).getTime();
    for (let i = 0; i < 365; i++) {
      const noise = (Math.sin(i * 0.21) + Math.cos(i * 0.07) * 0.6) * 600;
      const drift = i * 110;
      v = 142800 + drift + noise + (i > 200 ? (i - 200) * 80 : 0);
      if (i === 30) invested = 110000;
      if (i === 90) invested = 122000;
      if (i === 180) invested = 132000;
      if (i === 270) invested = 140000;
      if (i === 340) invested = 142800;
      out.push({
        t: start + i * 86400000,
        v: Math.round(v * 100) / 100,
        inv: invested
      });
    }
    return out;
  })(),

  // Top movers
  movers: [
    { ticker: "VWCE", name: "Vanguard FTSE All-World", isin: "IE00BK5BQT80", pct: 0.124, eur: 4820 },
    { ticker: "IWDA", name: "iShares Core MSCI World", isin: "IE00B4L5Y983", pct: 0.097, eur: 3120 },
    { ticker: "SXR8", name: "iShares Core S&P 500", isin: "IE00B5BMR087", pct: 0.084, eur: 2410 },
    { ticker: "EIMI", name: "iShares Core MSCI EM IMI", isin: "IE00BKM4GZ66", pct: 0.061, eur: 1180 },
    { ticker: "AGGH", name: "iShares Core Global Aggregate", isin: "IE00BDBRDM35", pct: -0.018, eur: -210 },
  ],
  losers: [
    { ticker: "REIT", name: "VanEck Global Real Estate", isin: "NL0009690239", pct: -0.072, eur: -640 },
    { ticker: "HYDR", name: "VanEck Hydrogen Economy", isin: "IE00BMDH1538", pct: -0.058, eur: -310 },
    { ticker: "WCLD", name: "WisdomTree Cloud Computing", isin: "IE00BJGWQN72", pct: -0.041, eur: -240 },
  ],

  // Open positions
  positions: [
    { ticker: "VWCE", name: "Vanguard FTSE All-World UCITS ETF", isin: "IE00BK5BQT80", region: "Global", type: "Equity", qty: 412, price: 117.84, mv: 48553.28, pnl: 11820.40, pnlPct: 0.322, ytdPct: 0.082 },
    { ticker: "IWDA", name: "iShares Core MSCI World UCITS ETF", isin: "IE00B4L5Y983", region: "Developed", type: "Equity", qty: 318, price: 96.12, mv: 30566.16, pnl: 7240.10, pnlPct: 0.310, ytdPct: 0.071 },
    { ticker: "SXR8", name: "iShares Core S&P 500 UCITS ETF", isin: "IE00B5BMR087", region: "US", type: "Equity", qty: 64, price: 542.88, mv: 34744.32, pnl: 9810.55, pnlPct: 0.395, ytdPct: 0.094 },
    { ticker: "EIMI", name: "iShares Core MSCI EM IMI UCITS", isin: "IE00BKM4GZ66", region: "EM", type: "Equity", qty: 540, price: 32.18, mv: 17377.20, pnl: 1820.80, pnlPct: 0.117, ytdPct: 0.041 },
    { ticker: "AGGH", name: "iShares Global Aggregate Bond UCITS", isin: "IE00BDBRDM35", region: "Global", type: "Bond", qty: 380, price: 48.92, mv: 18589.60, pnl: -420.20, pnlPct: -0.022, ytdPct: -0.012 },
    { ticker: "EUNK", name: "iShares Core MSCI Europe UCITS", isin: "IE00B4K48X80", region: "Europe", type: "Equity", qty: 220, price: 71.40, mv: 15708.00, pnl: 2240.10, pnlPct: 0.166, ytdPct: 0.033 },
    { ticker: "REIT", name: "VanEck Global Real Estate UCITS", isin: "NL0009690239", region: "Global", type: "REIT", qty: 410, price: 42.18, mv: 17293.80, pnl: -640.20, pnlPct: -0.036, ytdPct: -0.072 },
    { ticker: "GOLD", name: "Invesco Physical Gold ETC", isin: "IE00B579F325", region: "Global", type: "Commodity", qty: 14, price: 100.32, mv: 1404.48, pnl: 280.40, pnlPct: 0.249, ytdPct: 0.063 },
  ],

  // Transactions
  transactions: [
    { date: "2026-05-06", type: "Buy", name: "Vanguard FTSE All-World", qty: 8, price: 117.20, ccy: "EUR", venue: "XAMS", amt: 937.60 },
    { date: "2026-05-02", type: "Buy", name: "iShares Core S&P 500", qty: 2, price: 540.50, ccy: "EUR", venue: "XETR", amt: 1081.00 },
    { date: "2026-04-22", type: "Sell", name: "VanEck Hydrogen Economy", qty: -32, price: 4.18, ccy: "EUR", venue: "XAMS", amt: 133.76 },
    { date: "2026-04-15", type: "Buy", name: "iShares Core MSCI World", qty: 12, price: 95.40, ccy: "EUR", venue: "XAMS", amt: 1144.80 },
    { date: "2026-04-04", type: "Buy", name: "iShares Core MSCI EM IMI", qty: 40, price: 31.92, ccy: "EUR", venue: "XAMS", amt: 1276.80 },
    { date: "2026-03-28", type: "Buy", name: "iShares Global Aggregate Bond", qty: 18, price: 48.40, ccy: "EUR", venue: "XAMS", amt: 871.20 },
    { date: "2026-03-12", type: "Sell", name: "WisdomTree Cloud Computing", qty: -20, price: 38.10, ccy: "EUR", venue: "XAMS", amt: 762.00 },
    { date: "2026-03-01", type: "Buy", name: "Invesco Physical Gold ETC", qty: 4, price: 99.10, ccy: "EUR", venue: "XAMS", amt: 396.40 },
  ],

  // Exposure
  exposure: {
    region: [
      { name: "North America", pct: 48.2, color: "#0e6e3a" },
      { name: "Europe", pct: 22.1, color: "#138a48" },
      { name: "Asia Pacific", pct: 14.6, color: "#2a5d6e" },
      { name: "Emerging Markets", pct: 9.4, color: "#4a8a99" },
      { name: "Other", pct: 5.7, color: "#aab8b3" },
    ],
    sector: [
      { name: "Information Tech", pct: 26.4, color: "#0e6e3a" },
      { name: "Financials", pct: 14.8, color: "#138a48" },
      { name: "Healthcare", pct: 12.6, color: "#2a5d6e" },
      { name: "Consumer Disc.", pct: 11.2, color: "#4a8a99" },
      { name: "Industrials", pct: 9.4, color: "#7aa6a4" },
      { name: "Other", pct: 25.6, color: "#aab8b3" },
    ],
  }
};

// Sparkline generator
window.makeSpark = function(seed, len = 24, trend = 0) {
  const out = [];
  let v = 50;
  for (let i = 0; i < len; i++) {
    v += Math.sin((i + seed) * 0.6) * 4 + Math.cos((i + seed) * 0.3) * 2 + trend;
    out.push(v);
  }
  return out;
};
