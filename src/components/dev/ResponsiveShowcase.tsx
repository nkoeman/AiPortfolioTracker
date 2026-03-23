import { Card } from "@/components/layout/Card";
import { PortfolioChart } from "@/components/PortfolioChart";

const DEMO_CHART = [
  { date: "2026-01-02", EUR: 32000, Invested: 30000 },
  { date: "2026-01-09", EUR: 32600, Invested: 30300 },
  { date: "2026-01-16", EUR: 32350, Invested: 30500 },
  { date: "2026-01-23", EUR: 33100, Invested: 30700 },
  { date: "2026-01-30", EUR: 33550, Invested: 30950 }
];

// Development-only responsive preview block for quick visual checks.
export function ResponsiveShowcase() {
  return (
    <Card>
      <div className="section-title">Development</div>
      <h3>Responsive Showcase</h3>
      <small>Use this block to quickly verify card spacing and chart behavior on narrow screens.</small>
      <PortfolioChart data={DEMO_CHART} currencies={["EUR", "Invested"]} />
    </Card>
  );
}

