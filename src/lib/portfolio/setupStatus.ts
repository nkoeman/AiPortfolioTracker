import { startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";

export type PortfolioSetupState = "empty" | "preparing" | "ready" | "error";
export type PortfolioSetupStepStatus = "complete" | "running" | "pending" | "warning" | "error";
export type PortfolioSetupStepId =
  | "import_transactions"
  | "map_instruments"
  | "sync_prices"
  | "sync_fx"
  | "compute_valuations"
  | "prepare_analytics";

export type PortfolioSetupStatus = {
  state: PortfolioSetupState;
  hasTransactions: boolean;
  isInitialSetup: boolean;
  progressPct: number;
  currentStep: PortfolioSetupStepId | null;
  steps: Array<{
    id: PortfolioSetupStepId;
    label: string;
    status: PortfolioSetupStepStatus;
    detail?: string;
  }>;
  stats: {
    transactionsImported: number;
    assetsFound: number;
    firstTransactionDate: string | null;
    lastValuationDate: string | null;
  };
  message: string;
};

const STEP_LABELS: Record<PortfolioSetupStepId, string> = {
  import_transactions: "Importing transactions",
  map_instruments: "Identifying investments",
  sync_prices: "Downloading historical prices",
  sync_fx: "Downloading exchange rates",
  compute_valuations: "Calculating portfolio history",
  prepare_analytics: "Preparing analytics"
};

function toIsoDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function statusWeight(status: PortfolioSetupStepStatus) {
  if (status === "complete") return 1;
  if (status === "running") return 0.55;
  if (status === "warning") return 0.75;
  return 0;
}

function buildProgress(steps: PortfolioSetupStatus["steps"]) {
  const total = steps.length || 1;
  const value = steps.reduce((sum, step) => sum + statusWeight(step.status), 0);
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}

function firstActiveStep(steps: PortfolioSetupStatus["steps"]) {
  return steps.find((step) => step.status === "running" || step.status === "error" || step.status === "warning")?.id
    ?? steps.find((step) => step.status === "pending")?.id
    ?? null;
}

export async function getPortfolioSetupStatus(userId: string): Promise<PortfolioSetupStatus> {
  const now = new Date();
  const [transactions, dailyAggregate, partialValuations, runningLock] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId },
      select: {
        tradeAt: true,
        instrumentId: true,
        currency: true,
        listing: {
          select: {
            id: true,
            mappingStatus: true,
            eodhdCode: true,
            currency: true
          }
        }
      },
      orderBy: { tradeAt: "asc" }
    }),
    prisma.dailyPortfolioValue.aggregate({
      where: { userId },
      _count: { id: true },
      _min: { date: true },
      _max: { date: true }
    }),
    prisma.dailyPortfolioValue.count({
      where: { userId, partialValuation: true }
    }),
    prisma.syncLock.findFirst({
      where: {
        key: `price-sync:${userId}`,
        expiresAt: { gt: now }
      },
      select: { key: true }
    })
  ]);

  const transactionCount = transactions.length;
  const hasTransactions = transactionCount > 0;
  const assetIds = new Set(transactions.map((tx) => tx.instrumentId));
  const firstTransactionDate = transactions[0]?.tradeAt ? startOfDay(transactions[0].tradeAt) : null;
  const mappedListings = new Map<string, { currency: string | null }>();
  let unmappedCount = 0;
  let failedMappingCount = 0;

  for (const tx of transactions) {
    const listing = tx.listing;
    if (!listing || !listing.eodhdCode || listing.mappingStatus !== "MAPPED") {
      unmappedCount += 1;
      if (listing?.mappingStatus === "FAILED") failedMappingCount += 1;
      continue;
    }
    mappedListings.set(listing.id, { currency: listing.currency || tx.currency || "EUR" });
  }

  const listingIds = Array.from(mappedListings.keys());
  const [priceRows, pricedListings, nonEurFxRows] = await Promise.all([
    listingIds.length
      ? prisma.dailyListingPrice.count({
          where: { listingId: { in: listingIds } }
        })
      : Promise.resolve(0),
    listingIds.length
      ? prisma.dailyListingPrice.findMany({
          where: { listingId: { in: listingIds } },
          distinct: ["listingId"],
          select: { listingId: true }
        })
      : Promise.resolve([]),
    (() => {
      const currencies = Array.from(
        new Set(
          Array.from(mappedListings.values())
            .map((listing) => String(listing.currency || "EUR").toUpperCase())
            .filter((currency) => currency !== "EUR")
        )
      );
      return currencies.length
        ? prisma.fxRate.count({ where: { quote: { in: currencies } } })
        : Promise.resolve(0);
    })()
  ]);

  const isSyncRunning = Boolean(runningLock);
  const hasMappedListings = listingIds.length > 0;
  const hasPriceCoverage = hasMappedListings && pricedListings.length === listingIds.length && priceRows > 0;
  const needsFx = Array.from(mappedListings.values()).some(
    (listing) => String(listing.currency || "EUR").toUpperCase() !== "EUR"
  );
  const hasFxCoverage = !needsFx || nonEurFxRows > 0;
  const dailyCount = dailyAggregate._count.id;
  const hasDailyValues = dailyCount > 0;
  const hasPartialValuation = partialValuations > 0;
  const hasCompleteValuation = hasDailyValues && !hasPartialValuation;

  if (!hasTransactions) {
    const steps = (Object.entries(STEP_LABELS) as Array<[PortfolioSetupStepId, string]>).map(([id, label]) => ({
      id,
      label,
      status: "pending" as const
    }));
    return {
      state: "empty",
      hasTransactions: false,
      isInitialSetup: true,
      progressPct: 0,
      currentStep: "import_transactions",
      steps,
      stats: {
        transactionsImported: 0,
        assetsFound: 0,
        firstTransactionDate: null,
        lastValuationDate: null
      },
      message: "Import your DeGiro CSV to start preparing your portfolio."
    };
  }

  const mappingHasBlockingError = failedMappingCount > 0 || (!isSyncRunning && !hasMappedListings);
  const priceHasBlockingError = !isSyncRunning && hasMappedListings && !hasPriceCoverage;
  const valuationHasBlockingError = !isSyncRunning && hasDailyValues && hasPartialValuation;
  const state: PortfolioSetupState =
    mappingHasBlockingError || priceHasBlockingError || valuationHasBlockingError
      ? "error"
      : hasCompleteValuation && hasPriceCoverage && hasFxCoverage
        ? "ready"
        : "preparing";

  const steps: PortfolioSetupStatus["steps"] = [
    {
      id: "import_transactions",
      label: STEP_LABELS.import_transactions,
      status: "complete",
      detail: `${transactionCount} transaction${transactionCount === 1 ? "" : "s"} imported`
    },
    {
      id: "map_instruments",
      label: STEP_LABELS.map_instruments,
      status: mappingHasBlockingError ? "error" : unmappedCount > 0 || !hasMappedListings ? "running" : "complete",
      detail: mappingHasBlockingError
        ? `${failedMappingCount || unmappedCount} transaction${failedMappingCount + unmappedCount === 1 ? "" : "s"} need mapping`
        : `${assetIds.size} asset${assetIds.size === 1 ? "" : "s"} found`
    },
    {
      id: "sync_prices",
      label: STEP_LABELS.sync_prices,
      status: priceHasBlockingError ? "error" : hasPriceCoverage ? "complete" : isSyncRunning ? "running" : "pending",
      detail: hasPriceCoverage
        ? `${pricedListings.length} listing${pricedListings.length === 1 ? "" : "s"} have price history`
        : isSyncRunning
          ? "Fetching missing price history"
          : "Waiting for price sync"
    },
    {
      id: "sync_fx",
      label: STEP_LABELS.sync_fx,
      status: hasFxCoverage ? "complete" : isSyncRunning ? "running" : "pending",
      detail: hasFxCoverage ? "Exchange-rate coverage available" : "Waiting for FX coverage"
    },
    {
      id: "compute_valuations",
      label: STEP_LABELS.compute_valuations,
      status: valuationHasBlockingError ? "error" : hasCompleteValuation ? "complete" : isSyncRunning ? "running" : "pending",
      detail: hasCompleteValuation
        ? `${dailyCount} daily valuation${dailyCount === 1 ? "" : "s"} calculated`
        : hasPartialValuation
          ? `${partialValuations} partial valuation${partialValuations === 1 ? "" : "s"} need attention`
          : "Waiting for valuation calculation"
    },
    {
      id: "prepare_analytics",
      label: STEP_LABELS.prepare_analytics,
      status: state === "ready" ? "complete" : state === "error" ? "pending" : "pending",
      detail: state === "ready" ? "Analytics are ready" : "Waiting for valuation data"
    }
  ];

  const currentStep = firstActiveStep(steps);
  const progressPct = state === "ready" ? 100 : buildProgress(steps);
  const message =
    state === "ready"
      ? "Portfolio ready."
      : state === "error"
        ? "Portfolio preparation needs attention before analytics can be shown."
        : isSyncRunning
          ? "Downloading historical prices and calculating your portfolio history. This usually only happens once."
          : "Portfolio preparation is queued. If it does not continue, retry the full sync.";

  return {
    state,
    hasTransactions,
    isInitialSetup: !hasCompleteValuation,
    progressPct,
    currentStep,
    steps,
    stats: {
      transactionsImported: transactionCount,
      assetsFound: assetIds.size,
      firstTransactionDate: toIsoDate(firstTransactionDate),
      lastValuationDate: toIsoDate(dailyAggregate._max.date)
    },
    message
  };
}

export function shouldBlockPortfolioAnalytics(status: PortfolioSetupStatus) {
  return status.hasTransactions && status.state !== "ready";
}
