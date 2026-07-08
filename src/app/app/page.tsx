import { redirect } from "next/navigation";
import { format, startOfDay } from "date-fns";
import { type PortfolioChartPoint } from "@/components/PortfolioChart";
import { RecentPerformanceCard } from "@/components/RecentPerformanceCard";
import { BrandMotif } from "@/components/BrandMotif";
import { PortfolioValueCard } from "@/components/PortfolioValueCard";
import { PortfolioSetupScreen } from "@/components/PortfolioSetupScreen";
import { PageContainer } from "@/components/layout/PageContainer";
import { Section } from "@/components/layout/Section";
import { getCurrentAppUser } from "@/lib/auth/appUser";
import { getBenchmarkPriceSeries, queueBenchmarkPriceSync } from "@/lib/benchmarks/prices";
import {
  type PerformanceRangeOption
} from "@/lib/charts/performanceRange";
import { getTopMoversByRange } from "@/lib/dashboard/topMoversByRange";
import { getOrCreateDailyPortfolioSeries } from "@/lib/portfolio/getOrCreateDailyPortfolioSeries";
import { getPortfolioSetupStatus, shouldBlockPortfolioAnalytics } from "@/lib/portfolio/setupStatus";
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
  cumulativeReturnAmountEur: number | null;
  netExternalFlowEur: number;
  periodReturnPct: number | null;
};

const DEFAULT_TOP_MOVERS_RANGE: PerformanceRangeOption = "ytd";
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

  const setupStatus = await getPortfolioSetupStatus(user.id);
  if (shouldBlockPortfolioAnalytics(setupStatus)) {
    return (
      <PageContainer>
        <PortfolioSetupScreen initialStatus={setupStatus} />
      </PageContainer>
    );
  }

  // Fetch transactions and daily portfolio values in parallel; neither depends on the other.
  const [transactions, initialDailyValues] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: user.id },
      select: { id: true, instrumentId: true, quantity: true }
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
          <div className="card">
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
    netExternalFlowEur: toNumber(row.netExternalFlowEur),
    periodReturnPct: row.periodReturnPct === null ? null : Number(row.periodReturnPct)
  }));

  const initialTopMovers = await getTopMoversByRange(user.id, DEFAULT_TOP_MOVERS_RANGE);

  const dailyChartData: PortfolioChartPoint[] = dailySeriesForChart.map((point) => {
    const day = startOfDay(point.date);
    const invested =
      point.cumulativeReturnAmountEur === null ? null : Number((point.valueEur - point.cumulativeReturnAmountEur).toFixed(2));
    return {
      date: format(day, "yyyy-MM-dd"),
      EUR: Number(point.valueEur.toFixed(2)),
      Invested: invested,
      NetExternalFlow: Number(point.netExternalFlowEur.toFixed(8)),
      ReturnEur:
        point.cumulativeReturnAmountEur === null
          ? null
          : Number(point.cumulativeReturnAmountEur.toFixed(8)),
      PeriodReturnPct:
        point.periodReturnPct === null ? null : Number((point.periodReturnPct * 100).toFixed(8))
    };
  });
  const latestCloseDate = dailyChartData[dailyChartData.length - 1]?.date ?? null;
  const firstChartDate = dailySeriesForChart[0]?.date ?? null;
  const benchmarkSeries =
    firstChartDate && latestCloseDate
      ? await getBenchmarkPriceSeries(startOfDay(firstChartDate), startOfDay(new Date(`${latestCloseDate}T00:00:00.000Z`)))
      : [];
  if (firstChartDate) {
    queueBenchmarkPriceSync(startOfDay(firstChartDate), new Date());
  }

  return (
    <PageContainer>
      <div className="page-stack">
        <div className="page-head">
          <div>
            <h1 className="page-title">Performance</h1>
          </div>
        </div>

        <Section>
          <PortfolioValueCard
            dailyValueData={dailyChartData}
            latestCloseDate={latestCloseDate}
            benchmarks={benchmarkSeries}
          />
        </Section>
        <Section>
          <div className="performance-insights-grid performance-insights-grid-single">
            <RecentPerformanceCard
              initialRange={DEFAULT_TOP_MOVERS_RANGE}
              initialData={initialTopMovers}
            />
          </div>
        </Section>
      </div>
    </PageContainer>
  );
}
