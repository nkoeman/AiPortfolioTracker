import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { addDays, format, startOfDay, startOfWeek } from "date-fns";
import { type PortfolioChartPoint } from "@/components/PortfolioChart";
import { PortfolioAiSummaryCardClient } from "@/components/PortfolioAiSummaryCardClient";
import { RecentPerformanceCard } from "@/components/RecentPerformanceCard";
import { BrandMotif } from "@/components/BrandMotif";
import { PortfolioValueCard } from "@/components/PortfolioValueCard";
import { authOptions } from "@/lib/auth/options";
import { getRecentPerformance } from "@/lib/dashboard/recentPerformance";
import { getOrCreateDailyPortfolioSeries } from "@/lib/portfolio/getOrCreateDailyPortfolioSeries";
import { prisma } from "@/lib/prisma";

// Normalizes mixed numeric values to JavaScript numbers for calculations.
function toNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value);
}

type DailyValuePoint = {
  date: Date;
  valueEur: number;
  cumulativeReturnPct: number | null;
};

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function deriveWeeklyFridaySeries(dailyPoints: DailyValuePoint[]) {
  const byWeek = new Map<string, { friday: Date; points: DailyValuePoint[] }>();
  for (const point of dailyPoints) {
    const day = startOfDay(point.date);
    const weekStart = startOfWeek(day, { weekStartsOn: 1 });
    const friday = addDays(weekStart, 4);
    const key = toIsoDate(weekStart);
    const entry = byWeek.get(key) || { friday, points: [] };
    entry.points.push({
      date: day,
      valueEur: point.valueEur,
      cumulativeReturnPct: point.cumulativeReturnPct
    });
    byWeek.set(key, entry);
  }

  return Array.from(byWeek.values())
    .map((entry) => {
      const sorted = entry.points.sort((a, b) => a.date.getTime() - b.date.getTime());
      const onOrBeforeFriday = sorted.filter((point) => point.date.getTime() <= entry.friday.getTime());
      const selected = onOrBeforeFriday.length
        ? onOrBeforeFriday[onOrBeforeFriday.length - 1]
        : sorted[0];
      return {
        date: entry.friday,
        valueEur: selected.valueEur,
        cumulativeReturnPct: selected.cumulativeReturnPct
      };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export default async function PerformancePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) redirect("/login");

  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id },
    select: {
      tradeAt: true,
      quantity: true,
      valueEur: true,
      totalEur: true
    },
    orderBy: { tradeAt: "asc" }
  });

  if (!transactions.length) {
    return (
      <div className="card auth-card">
        <BrandMotif />
        <div className="section-title">Monthly Briefing</div>
        <h1>Performance</h1>
        <p>No transactions yet. Import your DeGiro CSV to get started.</p>
      </div>
    );
  }

  const dailyValues = await prisma.dailyPortfolioValue.findMany({
    where: { userId: user.id },
    orderBy: { date: "asc" }
  });

  const dailySeriesForChart: DailyValuePoint[] = dailyValues.map((row) => ({
    date: row.date,
    valueEur: toNumber(row.valueEur),
    cumulativeReturnPct: row.cumulativeReturnPct === null ? null : Number(row.cumulativeReturnPct)
  }));

  const weeklyFridaySeries = deriveWeeklyFridaySeries(dailySeriesForChart);
  const cashFlows = transactions.map((tx) => {
    const raw = tx.valueEur ?? tx.totalEur;
    const absValue = Math.abs(toNumber(raw));
    const qty = toNumber(tx.quantity);
    if (!Number.isFinite(absValue)) return { date: startOfDay(tx.tradeAt), flow: 0 };
    if (qty > 0) return { date: startOfDay(tx.tradeAt), flow: absValue };
    if (qty < 0) return { date: startOfDay(tx.tradeAt), flow: -absValue };
    return { date: startOfDay(tx.tradeAt), flow: 0 };
  });

  let flowIndex = 0;
  let investedTotal = 0;
  const chartData: PortfolioChartPoint[] = weeklyFridaySeries.map((row) => {
    const weekDate = startOfDay(row.date);
    while (flowIndex < cashFlows.length && cashFlows[flowIndex].date.getTime() <= weekDate.getTime()) {
      investedTotal += cashFlows[flowIndex].flow;
      flowIndex += 1;
    }
    return {
      date: format(weekDate, "yyyy-MM-dd"),
      EUR: Number(toNumber(row.valueEur).toFixed(2)),
      Invested: Number(investedTotal.toFixed(2))
    };
  });
  const weeklyReturnData: PortfolioChartPoint[] = weeklyFridaySeries
    .filter((row) => row.cumulativeReturnPct !== null)
    .map((row) => ({
      date: format(startOfDay(row.date), "yyyy-MM-dd"),
      Return: Number((toNumber(row.cumulativeReturnPct ?? 0) * 100).toFixed(2))
    }));

  const recentPerformance = await getRecentPerformance(user.id, 4);
  const dailySeries = await getOrCreateDailyPortfolioSeries(user.id, {
    endDate: new Date(),
    days: 28
  });
  const dailyPoints = dailySeriesForChart;
  let dailyFlowIndex = 0;
  let dailyInvestedTotal = 0;
  const dailyChartData: PortfolioChartPoint[] = dailyPoints.map((point) => {
    const day = startOfDay(point.date);
    while (dailyFlowIndex < cashFlows.length && cashFlows[dailyFlowIndex].date.getTime() <= day.getTime()) {
      dailyInvestedTotal += cashFlows[dailyFlowIndex].flow;
      dailyFlowIndex += 1;
    }
    return {
      date: format(day, "yyyy-MM-dd"),
      EUR: Number(point.valueEur.toFixed(2)),
      Invested: Number(dailyInvestedTotal.toFixed(2))
    };
  });
  const dailyReturnData: PortfolioChartPoint[] = dailyPoints
    .filter((point) => point.cumulativeReturnPct !== null)
    .map((point) => ({
      date: format(startOfDay(point.date), "yyyy-MM-dd"),
      Return: Number((toNumber(point.cumulativeReturnPct ?? 0) * 100).toFixed(2))
    }));

  return (
    <div className="stack-lg">
      <PortfolioAiSummaryCardClient />
      <PortfolioValueCard
        weeklyValueData={chartData}
        dailyValueData={dailyChartData}
        weeklyReturnData={weeklyReturnData}
        dailyReturnData={dailyReturnData}
      />
      <RecentPerformanceCard data={recentPerformance} dailySeries={dailySeries} />
    </div>
  );
}
