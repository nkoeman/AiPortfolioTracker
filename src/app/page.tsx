import { redirect } from "next/navigation";
import { format, startOfDay } from "date-fns";
import { type PortfolioChartPoint } from "@/components/PortfolioChart";
import { PortfolioAiSummaryCardClient } from "@/components/PortfolioAiSummaryCardClient";
import { RecentPerformanceCard } from "@/components/RecentPerformanceCard";
import { BrandMotif } from "@/components/BrandMotif";
import { PortfolioValueCard } from "@/components/PortfolioValueCard";
import { PageContainer } from "@/components/layout/PageContainer";
import { Section } from "@/components/layout/Section";
import { getCurrentAppUser } from "@/lib/auth/appUser";
import {
  type PerformanceRangeOption
} from "@/lib/charts/performanceRange";
import { getTopMoversByRange } from "@/lib/dashboard/topMoversByRange";
import { getOrCreateDailyPortfolioSeries } from "@/lib/portfolio/getOrCreateDailyPortfolioSeries";
import { prisma } from "@/lib/prisma";
import { ResponsiveShowcase } from "@/components/dev/ResponsiveShowcase";

// Normalizes mixed numeric values to JavaScript numbers for calculations.
function toNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value);
}

type DailyValuePoint = {
  date: Date;
  valueEur: number;
  cumulativeReturnAmountEur: number | null;
  returnIndex: number | null;
  periodReturnPct: number | null;
};

const DEFAULT_TOP_MOVERS_RANGE: PerformanceRangeOption = "max";
const dailySeriesRefreshQueue = new Map<string, Promise<void>>();

function queueDailySeriesRefresh(userId: string, fromDate: Date) {
  const dateKey = fromDate.toISOString().slice(0, 10);
  const key = `${userId}:${dateKey}`;
  if (dailySeriesRefreshQueue.has(key)) return;

  const refreshTask = getOrCreateDailyPortfolioSeries(userId, {
    fromDate: startOfDay(fromDate),
    endDate: new Date()
  })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("[DASH][PERF] background daily series refresh failed", {
        userId,
        fromDate: dateKey,
        error: message
      });
    })
    .then(() => {
      dailySeriesRefreshQueue.delete(key);
    });

  dailySeriesRefreshQueue.set(key, refreshTask);
}

export default async function PerformancePage() {
  const user = await getCurrentAppUser();
  if (!user) redirect("/sign-in");

  // Fetch transactions and daily portfolio values in parallel — neither depends on the other.
  const [transactions, initialDailyValues] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: user.id },
      select: {
        tradeAt: true,
        quantity: true,
        valueEur: true,
        totalEur: true
      },
      orderBy: { tradeAt: "asc" }
    }),
    prisma.dailyPortfolioValue.findMany({
      where: { userId: user.id },
      orderBy: { date: "asc" }
    })
  ]);

  if (!transactions.length) {
    return (
      <PageContainer>
        <Section>
          <div className="card auth-card">
            <BrandMotif />
            <div className="section-title">Monthly Briefing</div>
            <h1>Performance</h1>
            <p>No transactions yet. Import your DeGiro CSV to get started.</p>
          </div>
        </Section>
      </PageContainer>
    );
  }

  let dailyValues = initialDailyValues;

  const firstMissingCumulativeReturnDate =
    dailyValues.find((row) => row.cumulativeReturnAmountEur === null)?.date ?? null;
  if (firstMissingCumulativeReturnDate) {
    queueDailySeriesRefresh(user.id, firstMissingCumulativeReturnDate);
  }

  const dailySeriesForChart: DailyValuePoint[] = dailyValues.map((row) => ({
    date: row.date,
    valueEur: toNumber(row.valueEur),
    cumulativeReturnAmountEur:
      row.cumulativeReturnAmountEur === null ? null : Number(row.cumulativeReturnAmountEur),
    returnIndex: row.returnIndex === null ? null : Number(row.returnIndex),
    periodReturnPct: row.periodReturnPct === null ? null : Number(row.periodReturnPct)
  }));

  const cashFlows = transactions.map((tx) => {
    const raw = tx.valueEur ?? tx.totalEur;
    const absValue = Math.abs(toNumber(raw));
    const qty = toNumber(tx.quantity);
    if (!Number.isFinite(absValue)) return { date: startOfDay(tx.tradeAt), flow: 0 };
    if (qty > 0) return { date: startOfDay(tx.tradeAt), flow: absValue };
    if (qty < 0) return { date: startOfDay(tx.tradeAt), flow: -absValue };
    return { date: startOfDay(tx.tradeAt), flow: 0 };
  });

  const initialTopMovers = await getTopMoversByRange(user.id, DEFAULT_TOP_MOVERS_RANGE);

  let dailyFlowIndex = 0;
  let dailyInvestedTotal = 0;
  const dailyChartData: PortfolioChartPoint[] = dailySeriesForChart.map((point) => {
    const day = startOfDay(point.date);
    while (dailyFlowIndex < cashFlows.length && cashFlows[dailyFlowIndex].date.getTime() <= day.getTime()) {
      dailyInvestedTotal += cashFlows[dailyFlowIndex].flow;
      dailyFlowIndex += 1;
    }
    return {
      date: format(day, "yyyy-MM-dd"),
      EUR: Number(point.valueEur.toFixed(2)),
      Invested: Number(dailyInvestedTotal.toFixed(2)),
      ReturnEur:
        point.cumulativeReturnAmountEur === null
          ? null
          : Number(point.cumulativeReturnAmountEur.toFixed(8)),
      Index: point.returnIndex === null ? null : Number(point.returnIndex.toFixed(10)),
      PeriodReturnPct:
        point.periodReturnPct === null ? null : Number((point.periodReturnPct * 100).toFixed(8))
    };
  });

  return (
    <PageContainer>
      <div className="page-stack">
        <Section>
          <PortfolioValueCard
            dailyValueData={dailyChartData}
          />
        </Section>
        <Section>
          <div className="performance-insights-grid">
            <RecentPerformanceCard
              initialRange={DEFAULT_TOP_MOVERS_RANGE}
              initialData={initialTopMovers}
            />
            <PortfolioAiSummaryCardClient />
          </div>
        </Section>
        {process.env.NODE_ENV !== "production" ? (
          <Section>
            <ResponsiveShowcase />
          </Section>
        ) : null}
      </div>
    </PageContainer>
  );
}
