// Shared chart/sparkline primitives

const fmtEur = (v, opts = {}) => new Intl.NumberFormat("nl-NL", {
  style: "currency", currency: "EUR", maximumFractionDigits: opts.digits ?? 0,
  minimumFractionDigits: opts.digits ?? 0
}).format(v);
const fmtPct = (v, digits = 2) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(digits)}%`;
const fmtNum = (v, digits = 2) => new Intl.NumberFormat("nl-NL", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v);

window.fmtEur = fmtEur;
window.fmtPct = fmtPct;
window.fmtNum = fmtNum;

// Mini sparkline
const Sparkline = ({ values, w = 80, h = 24, color = "var(--brand)", neg }) => {
  if (!values?.length) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const stepX = w / (values.length - 1);
  const pts = values.map((v, i) => `${(i * stepX).toFixed(2)},${(h - ((v - min) / range) * h).toFixed(2)}`).join(" ");
  const area = `M0,${h} L ${pts.split(" ").join(" L ")} L${w},${h} Z`;
  const stroke = neg ? "var(--neg)" : color;
  const fill = neg ? "var(--neg-soft)" : "var(--brand-soft-2)";
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={area} fill={fill} stroke="none" />
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" />
    </svg>
  );
};

// Big performance chart
const PerformanceChart = ({ series, range }) => {
  const w = 800, h = 260, padL = 50, padR = 12, padT = 12, padB = 28;
  const slice = (() => {
    if (range === "1M") return series.slice(-30);
    if (range === "3M") return series.slice(-90);
    if (range === "YTD") return series.slice(-127);
    if (range === "1Y") return series.slice(-365);
    return series;
  })();

  const vals = slice.map(p => p.v);
  const inv = slice.map(p => p.inv);
  const allMin = Math.min(...vals, ...inv);
  const allMax = Math.max(...vals, ...inv);
  const min = allMin - (allMax - allMin) * 0.05;
  const max = allMax + (allMax - allMin) * 0.05;
  const range_ = max - min || 1;
  const stepX = (w - padL - padR) / (slice.length - 1);

  const yToPx = (v) => h - padB - ((v - min) / range_) * (h - padT - padB);
  const xToPx = (i) => padL + i * stepX;

  const valuePts = slice.map((p, i) => `${xToPx(i).toFixed(1)},${yToPx(p.v).toFixed(1)}`).join(" ");
  const investedPts = slice.map((p, i) => `${xToPx(i).toFixed(1)},${yToPx(p.inv).toFixed(1)}`).join(" ");
  const areaPts = `M ${padL},${h - padB} L ${valuePts.split(" ").join(" L ")} L ${(w - padR)},${h - padB} Z`;

  // Y axis ticks
  const yTicks = 5;
  const ticks = Array.from({ length: yTicks }, (_, i) => min + ((max - min) / (yTicks - 1)) * i);

  // X axis labels
  const xTickCount = 6;
  const xTickStep = Math.floor(slice.length / (xTickCount - 1));
  const xTicks = Array.from({ length: xTickCount }, (_, i) => Math.min(i * xTickStep, slice.length - 1));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: 280 }}>
      <defs>
        <linearGradient id="valGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={w - padR} y1={yToPx(t)} y2={yToPx(t)} stroke="var(--border)" strokeDasharray="2 4" />
          <text x={padL - 8} y={yToPx(t) + 3} textAnchor="end" fontSize="10" fill="var(--muted)">
            €{Math.round(t / 1000)}k
          </text>
        </g>
      ))}

      {xTicks.map((idx, i) => {
        const p = slice[idx];
        const d = new Date(p.t);
        const label = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
        return (
          <text key={i} x={xToPx(idx)} y={h - 8} textAnchor="middle" fontSize="10.5" fill="var(--muted)">
            {label}
          </text>
        );
      })}

      <path d={areaPts} fill="url(#valGrad)" />
      <polyline points={investedPts} fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="3 4" />
      <polyline points={valuePts} fill="none" stroke="var(--brand)" strokeWidth="2" />
      {/* Last point dot */}
      <circle cx={xToPx(slice.length - 1)} cy={yToPx(vals[vals.length - 1])} r="4" fill="var(--brand)" stroke="var(--surface)" strokeWidth="2" />
    </svg>
  );
};

// Donut for exposure
const Donut = ({ data, active, onHover }) => {
  const size = 220, r = 78, cx = size / 2, cy = size / 2, stroke = 22;
  const total = data.reduce((s, d) => s + d.pct, 0) || 100;
  let acc = 0;
  const C = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
      {data.map((d, i) => {
        const len = (d.pct / total) * C;
        const dasharray = `${len} ${C - len}`;
        const offset = -acc;
        acc += len;
        const isActive = active === i;
        return (
          <circle key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={d.color}
            strokeWidth={isActive ? stroke + 2 : stroke}
            strokeDasharray={dasharray}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            onMouseEnter={() => onHover && onHover(i)}
            onMouseLeave={() => onHover && onHover(null)}
            style={{ transition: "stroke-width 120ms" }}
          />
        );
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="11"
        fill="var(--muted)" letterSpacing="0.05em" style={{ textTransform: "uppercase" }}>
        Coverage
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" fontSize="22"
        fontFamily="var(--font-display)" fontWeight="600" fill="var(--text)">
        96.4%
      </text>
    </svg>
  );
};

window.Sparkline = Sparkline;
window.PerformanceChart = PerformanceChart;
window.Donut = Donut;
