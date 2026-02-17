"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from "recharts";

export type PortfolioChartPoint = {
  date: string;
  [currency: string]: string | number;
};

type PortfolioChartProps = {
  data: PortfolioChartPoint[];
  currencies: string[];
  valueFormatter?: (value: number, name: string) => string | [string, string];
  yAxisTickFormatter?: (value: number) => string;
  yAxisDomain?: [number, number];
  xAxisTickFormatter?: (value: string) => string;
};

const COLORS = ["var(--chart-primary)", "var(--chart-secondary)", "var(--chart-tertiary)"];

// Plots portfolio value over time with separate lines per currency bucket.
export function PortfolioChart({
  data,
  currencies,
  valueFormatter,
  yAxisTickFormatter,
  yAxisDomain,
  xAxisTickFormatter
}: PortfolioChartProps) {
  return (
    <div className="chart-shell">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 24, bottom: 10, left: 0 }}>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={xAxisTickFormatter} />
          <YAxis domain={yAxisDomain} tick={{ fontSize: 12 }} tickFormatter={yAxisTickFormatter} />
          <Tooltip formatter={valueFormatter} />
          <Legend />
          {currencies.map((currency, idx) => (
            <Line
              key={currency}
              type="monotone"
              dataKey={currency}
              name={currency === "Invested" ? "Invested" : `Value (${currency})`}
              stroke={COLORS[idx % COLORS.length]}
              strokeWidth={2}
              strokeDasharray={currency === "Invested" ? "4 4" : undefined}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
