// ETFMinded redesign components — shared bits

const Icon = {
  Performance: () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M2 12L6 7L9 10L14 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 4H10M14 4V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  Portfolio: () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2 6H14" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M6 1.5V4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M10 1.5V4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  Transactions: () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M3 5H12M12 5L9.5 2.5M12 5L9.5 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M13 11H4M4 11L6.5 8.5M4 11L6.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Settings: () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M13 8a5 5 0 0 0-.1-1l1.3-1-1.3-2.2-1.6.5a5 5 0 0 0-1.7-1L9.3 1.5h-2.6L6.4 3.3a5 5 0 0 0-1.7 1l-1.6-.5L1.8 6l1.3 1A5 5 0 0 0 3 8a5 5 0 0 0 .1 1l-1.3 1 1.3 2.2 1.6-.5a5 5 0 0 0 1.7 1l.3 1.8h2.6l.3-1.8a5 5 0 0 0 1.7-1l1.6.5L14.2 10l-1.3-1A5 5 0 0 0 13 8Z" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  ),
  Plus: () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1V11M1 6H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  Refresh: () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M10.5 6a4.5 4.5 0 1 1-1.3-3.2M10.5 1v2.5h-2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Up: () => <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 2L5 8M5 2L2 5M5 2L8 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Down: () => <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 8L5 2M5 8L2 5M5 8L8 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Search: () => <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/><path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  Upload: () => <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 9V2M7 2L4 5M7 2L10 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 11h10v1.5H2z" fill="currentColor"/></svg>,
  Empty: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M3 10h18M8 4v4M16 4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
};

// EUR/number formatting
const fmtEur = (n, signed = false) => {
  if (n == null || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const s = abs >= 1000
    ? '€' + abs.toLocaleString('en-GB', { maximumFractionDigits: 0 })
    : '€' + abs.toFixed(2);
  if (signed) return (n < 0 ? '−' : '+') + s;
  return (n < 0 ? '−' : '') + s;
};
const fmtPct = (n, signed = true) => {
  if (n == null || !Number.isFinite(n)) return '—';
  const v = n.toFixed(2) + '%';
  if (!signed) return v;
  if (n > 0) return '+' + v;
  if (n < 0) return '−' + Math.abs(n).toFixed(2) + '%';
  return v;
};
const fmtNum = (n, digits = 2) => {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toFixed(digits);
};

// Mock portfolio data
const PORTFOLIO = {
  totalValue: 142_385.42,
  todayDelta: 412.18,
  todayPct: 0.29,
  totalReturnPct: 14.82,
  totalReturnEur: 18_362.55,
  ytdPct: 7.24,
  netInvested: 124_022.87,
};

const POSITIONS = [
  { name: 'iShares Core MSCI World UCITS ETF', isin: 'IE00B4L5Y983', tags: ['ETF', 'World', 'MSCI World'], qty: 142.34, price: 92.18, value: 13123.34, pnl: 2418.72, ytdPnl: 712.40, ytdPct: 6.41, weight: 18.4 },
  { name: 'iShares Core S&P 500 UCITS ETF', isin: 'IE00B5BMR087', tags: ['ETF', 'NA', 'S&P 500'], qty: 88.12, price: 502.74, value: 44_301.40, pnl: 7218.30, ytdPnl: 3120.10, ytdPct: 9.12, weight: 31.1 },
  { name: 'Vanguard FTSE All-World UCITS ETF', isin: 'IE00BK5BQT80', tags: ['ETF', 'World', 'FTSE'], qty: 64.50, price: 124.18, value: 8_009.61, pnl: 980.42, ytdPnl: 412.09, ytdPct: 5.42, weight: 5.6 },
  { name: 'iShares MSCI EM IMI UCITS ETF', isin: 'IE00BD45KH83', tags: ['ETF', 'EM', 'MSCI'], qty: 412.00, price: 28.42, value: 11_709.04, pnl: -342.10, ytdPnl: -212.40, ytdPct: -1.78, weight: 8.2 },
  { name: 'Vanguard S&P 500 UCITS ETF', isin: 'IE00B3XXRP09', tags: ['ETF', 'NA', 'S&P 500'], qty: 38.10, price: 96.42, value: 3_673.60, pnl: 542.30, ytdPnl: 218.04, ytdPct: 6.31, weight: 2.6 },
  { name: 'Xtrackers MSCI Europe UCITS ETF', isin: 'LU0274209237', tags: ['ETF', 'EU', 'MSCI'], qty: 220.00, price: 78.18, value: 17_199.60, pnl: 1842.50, ytdPnl: 821.30, ytdPct: 5.02, weight: 12.1 },
  { name: 'iShares NASDAQ 100 UCITS ETF', isin: 'IE00B53SZB19', tags: ['ETF', 'NA', 'NDX'], qty: 22.40, price: 1124.50, value: 25_188.80, pnl: 4218.40, ytdPnl: 2104.50, ytdPct: 9.12, weight: 17.7 },
  { name: 'VanEck Semiconductor UCITS ETF', isin: 'IE00BMC38736', tags: ['ETF', 'World', 'Semi'], qty: 88.00, price: 56.34, value: 4_958.00, pnl: 1218.20, ytdPnl: 612.40, ytdPct: 14.10, weight: 3.5 },
];

// Simple sparkline
function Spark({ data, color = 'currentColor', width = 60, height = 18 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
      <polyline points={pts} stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

// Generate fake performance data
const sparkData = (n, base, vol) => {
  let v = base;
  const arr = [v];
  for (let i = 1; i < n; i++) {
    v += (Math.random() - 0.45) * vol;
    arr.push(v);
  }
  return arr;
};

window.Icon = Icon;
window.fmtEur = fmtEur;
window.fmtPct = fmtPct;
window.fmtNum = fmtNum;
window.Spark = Spark;
window.PORTFOLIO = PORTFOLIO;
window.POSITIONS = POSITIONS;
window.sparkData = sparkData;
