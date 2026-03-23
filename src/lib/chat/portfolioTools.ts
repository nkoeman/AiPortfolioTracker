import { getTopMoversByRange } from "@/lib/dashboard/topMoversByRange";
import {
  getPortfolioExposure,
  type PortfolioExposureChartKey
} from "@/lib/exposure/portfolioExposure";
import { getFxRateForWeek } from "@/lib/fx/convert";
import { prisma } from "@/lib/prisma";
import {
  getSeriesForTimeframe,
  parseChatTimeframe,
  type ChatTimeframe,
  type PortfolioValueRow
} from "@/lib/chat/timeframe";

type JsonSchema = Record<string, unknown>;

type ToolContext = {
  userId: string;
  now: Date;
};

type ToolExecuteResult = {
  ok: boolean;
  tool: string;
  data?: Record<string, unknown>;
  caveats?: string[];
  error?: string;
};

export type PortfolioToolDefinition = {
  name: string;
  description: string;
  parameters: JsonSchema;
  execute: (context: ToolContext, args: Record<string, unknown>) => Promise<ToolExecuteResult>;
};

type PositionValueRow = {
  instrumentId: string;
  isin: string;
  instrumentName: string;
  quantity: number;
  valueEur: number;
  weight: number;
  currency: string;
  priceDate: string;
};

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object" && "toString" in value) {
    return Number(String(value));
  }
  return Number.NaN;
}

function round(value: number, digits = 8) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(digits));
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseOptionalDate(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) return null;
  return parsed;
}

function parseLimit(value: unknown, fallback: number, max: number) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(max, parsed);
}

async function getDailyPortfolioRows(userId: string): Promise<PortfolioValueRow[]> {
  const rows = await prisma.dailyPortfolioValue.findMany({
    where: { userId },
    orderBy: { date: "asc" },
    select: {
      date: true,
      valueEur: true,
      partialValuation: true
    }
  });

  return rows.map((row) => ({
    date: row.date,
    valueEur: toNumber(row.valueEur),
    partialValuation: row.partialValuation
  }));
}

function computePerformancePayload(rows: PortfolioValueRow[], timeframe: ChatTimeframe) {
  const series = getSeriesForTimeframe(rows, timeframe);
  const startValue = series.points[0]?.valueEur ?? null;
  const endValue = series.points.length ? series.points[series.points.length - 1].valueEur : null;
  const changeEur =
    startValue !== null && endValue !== null ? round(endValue - startValue, 2) : null;
  const returnPct =
    startValue !== null && endValue !== null && startValue !== 0
      ? round((endValue - startValue) / startValue, 8)
      : null;

  const partialCoveragePoints = series.points.filter((row) => row.partialValuation).length;
  const caveats: string[] = [];
  if (series.points.length < 2) {
    caveats.push("Not enough valuation points for a complete performance window.");
  }
  if (partialCoveragePoints > 0) {
    caveats.push("Some points are partial valuations due to missing price or FX coverage.");
  }

  return {
    summary: {
      timeframe: series.timeframe,
      timeframeLabel: series.label,
      granularity: series.granularity,
      startDate: series.startDate ? toIsoDate(series.startDate) : null,
      endDate: series.endDate ? toIsoDate(series.endDate) : null,
      points: series.points.length,
      startValueEur: startValue === null ? null : round(startValue, 2),
      endValueEur: endValue === null ? null : round(endValue, 2),
      changeEur,
      returnPct
    },
    caveats
  };
}

type HoldingAggregate = {
  instrumentId: string;
  isin: string;
  instrumentName: string;
  quantity: number;
  fallbackListingId: string | null;
  listings: Array<{ id: string; isPrimary: boolean; mappingStatus: string; eodhdCode: string | null }>;
};

function pickListing(
  listings: HoldingAggregate["listings"],
  fallbackListingId: string | null
) {
  const primaryMapped = listings.find(
    (listing) => listing.isPrimary && listing.mappingStatus === "MAPPED" && listing.eodhdCode
  );
  const fallback = fallbackListingId
    ? listings.find((listing) => listing.id === fallbackListingId && listing.eodhdCode)
    : null;
  const anyMapped = listings.find((listing) => listing.mappingStatus === "MAPPED" && listing.eodhdCode);
  return primaryMapped || fallback || anyMapped || null;
}

async function getCurrentPositionValues(userId: string, asOfDate: Date): Promise<{
  positions: PositionValueRow[];
  caveats: string[];
}> {
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: "TRADE",
      tradeAt: { lte: asOfDate }
    },
    include: {
      instrument: {
        select: {
          id: true,
          isin: true,
          name: true,
          displayName: true,
          listings: {
            select: {
              id: true,
              isPrimary: true,
              mappingStatus: true,
              eodhdCode: true
            }
          }
        }
      }
    },
    orderBy: { tradeAt: "asc" }
  });

  if (!transactions.length) {
    return {
      positions: [],
      caveats: ["No transactions available for this account yet."]
    };
  }

  const byInstrument = new Map<string, HoldingAggregate>();
  for (const tx of transactions) {
    const current = byInstrument.get(tx.instrumentId) || {
      instrumentId: tx.instrumentId,
      isin: tx.instrument.isin,
      instrumentName: tx.instrument.displayName || tx.instrument.name,
      quantity: 0,
      fallbackListingId: tx.listingId,
      listings: tx.instrument.listings
    };

    current.quantity += toNumber(tx.quantity);
    if (!current.fallbackListingId && tx.listingId) current.fallbackListingId = tx.listingId;
    byInstrument.set(tx.instrumentId, current);
  }

  const chosenListingByInstrument = new Map<string, string>();
  const listingIds = new Set<string>();
  let mappingMisses = 0;

  for (const aggregate of byInstrument.values()) {
    if (aggregate.quantity <= 0) continue;
    const selected = pickListing(aggregate.listings, aggregate.fallbackListingId);
    if (!selected) {
      mappingMisses += 1;
      continue;
    }
    chosenListingByInstrument.set(aggregate.instrumentId, selected.id);
    listingIds.add(selected.id);
  }

  const priceRows = listingIds.size
    ? await prisma.dailyListingPrice.findMany({
        where: {
          listingId: { in: Array.from(listingIds) },
          date: { lte: asOfDate }
        },
        orderBy: [{ listingId: "asc" }, { date: "desc" }],
        select: {
          listingId: true,
          date: true,
          adjustedClose: true,
          currency: true
        }
      })
    : [];

  const latestPriceByListing = new Map<string, (typeof priceRows)[number]>();
  for (const row of priceRows) {
    if (!latestPriceByListing.has(row.listingId)) {
      latestPriceByListing.set(row.listingId, row);
    }
  }

  const caveats: string[] = [];
  if (mappingMisses > 0) {
    caveats.push(`${mappingMisses} held instruments are excluded because no mapped listing was available.`);
  }

  let missingPriceCount = 0;
  let missingFxCount = 0;
  const rawPositions: Array<PositionValueRow & { rawValueEur: number }> = [];
  for (const aggregate of byInstrument.values()) {
    if (aggregate.quantity <= 0) continue;
    const listingId = chosenListingByInstrument.get(aggregate.instrumentId);
    if (!listingId) continue;

    const price = latestPriceByListing.get(listingId);
    if (!price) {
      missingPriceCount += 1;
      continue;
    }

    const adjustedClose = toNumber(price.adjustedClose);
    if (!Number.isFinite(adjustedClose) || adjustedClose <= 0) {
      missingPriceCount += 1;
      continue;
    }

    let fxToEur = 1;
    try {
      fxToEur = await getFxRateForWeek(price.date, String(price.currency || "EUR"));
    } catch {
      missingFxCount += 1;
      continue;
    }

    const rawValueEur = aggregate.quantity * adjustedClose * fxToEur;
    if (!Number.isFinite(rawValueEur) || rawValueEur <= 0) continue;

    rawPositions.push({
      instrumentId: aggregate.instrumentId,
      isin: aggregate.isin,
      instrumentName: aggregate.instrumentName,
      quantity: round(aggregate.quantity, 8),
      valueEur: 0,
      weight: 0,
      currency: String(price.currency || "EUR"),
      priceDate: toIsoDate(price.date),
      rawValueEur
    });
  }

  if (missingPriceCount > 0) {
    caveats.push(`${missingPriceCount} held instruments were skipped because no recent price was available.`);
  }
  if (missingFxCount > 0) {
    caveats.push(`${missingFxCount} held instruments were skipped because FX conversion was unavailable.`);
  }

  const totalValueEur = rawPositions.reduce((sum, row) => sum + row.rawValueEur, 0);
  const positions = rawPositions
    .map((row) => ({
      instrumentId: row.instrumentId,
      isin: row.isin,
      instrumentName: row.instrumentName,
      quantity: row.quantity,
      valueEur: round(row.rawValueEur, 2),
      weight: totalValueEur > 0 ? round(row.rawValueEur / totalValueEur, 8) : 0,
      currency: row.currency,
      priceDate: row.priceDate
    }))
    .sort((a, b) => b.valueEur - a.valueEur);

  if (!positions.length) {
    caveats.push("No valued open positions were found for the selected date.");
  }

  return { positions, caveats };
}

async function executeGetPortfolioOverview(context: ToolContext): Promise<ToolExecuteResult> {
  const [dailyRows, transactions, positionsResult] = await Promise.all([
    getDailyPortfolioRows(context.userId),
    prisma.transaction.count({ where: { userId: context.userId } }),
    getCurrentPositionValues(context.userId, context.now)
  ]);

  const latest = dailyRows[dailyRows.length - 1] ?? null;
  const totalValueEur = latest ? round(latest.valueEur, 2) : null;
  const openPositions = positionsResult.positions.length;
  const topPositions = positionsResult.positions.slice(0, 5).map((row) => ({
    instrumentId: row.instrumentId,
    isin: row.isin,
    name: row.instrumentName,
    valueEur: row.valueEur,
    weightPct: round(row.weight * 100, 2)
  }));

  return {
    ok: true,
    tool: "getPortfolioOverview",
    data: {
      asOfDate: latest ? toIsoDate(latest.date) : null,
      portfolioValueEur: totalValueEur,
      openPositions,
      totalTransactions: transactions,
      topPositions
    },
    caveats: positionsResult.caveats
  };
}

async function executeGetPerformanceSummary(
  context: ToolContext,
  args: Record<string, unknown>
): Promise<ToolExecuteResult> {
  const timeframe = parseChatTimeframe(args.timeframe);
  const rows = await getDailyPortfolioRows(context.userId);
  const payload = computePerformancePayload(rows, timeframe);

  return {
    ok: true,
    tool: "getPerformanceSummary",
    data: payload.summary,
    caveats: payload.caveats
  };
}

async function executeGetTopContributors(
  context: ToolContext,
  args: Record<string, unknown>
): Promise<ToolExecuteResult> {
  const timeframe = parseChatTimeframe(args.timeframe);
  const movers = await getTopMoversByRange(context.userId, timeframe);
  return {
    ok: true,
    tool: "getTopContributors",
    data: {
      timeframe: movers.range,
      timeframeLabel: movers.label,
      granularity: movers.granularity,
      window: {
        startDate: movers.window.startDate ? toIsoDate(movers.window.startDate) : null,
        endDate: movers.window.endDate ? toIsoDate(movers.window.endDate) : null
      },
      topContributors: movers.contributors.topGainers.map((row) => ({
        instrumentId: row.instrumentId,
        isin: row.isin,
        name: row.instrumentName,
        contributionEur: round(row.contributionEur, 2),
        localReturnPct: row.localReturnPct === null ? null : round(row.localReturnPct, 8)
      }))
    },
    caveats:
      movers.contributors.topGainers.length === 0
        ? ["No positive contributors were found in this window."]
        : []
  };
}

async function executeGetTopDetractors(
  context: ToolContext,
  args: Record<string, unknown>
): Promise<ToolExecuteResult> {
  const timeframe = parseChatTimeframe(args.timeframe);
  const movers = await getTopMoversByRange(context.userId, timeframe);
  return {
    ok: true,
    tool: "getTopDetractors",
    data: {
      timeframe: movers.range,
      timeframeLabel: movers.label,
      granularity: movers.granularity,
      window: {
        startDate: movers.window.startDate ? toIsoDate(movers.window.startDate) : null,
        endDate: movers.window.endDate ? toIsoDate(movers.window.endDate) : null
      },
      topDetractors: movers.contributors.topLosers.map((row) => ({
        instrumentId: row.instrumentId,
        isin: row.isin,
        name: row.instrumentName,
        contributionEur: round(row.contributionEur, 2),
        localReturnPct: row.localReturnPct === null ? null : round(row.localReturnPct, 8)
      }))
    },
    caveats:
      movers.contributors.topLosers.length === 0
        ? ["No negative contributors were found in this window."]
        : []
  };
}

async function executeGetExposureBreakdown(
  context: ToolContext,
  args: Record<string, unknown>
): Promise<ToolExecuteResult> {
  const requestedDimension =
    typeof args.dimension === "string" ? args.dimension.trim().toLowerCase() : "sector";
  const dimensionMap: Record<string, PortfolioExposureChartKey> = {
    region: "region",
    development: "development",
    country: "country",
    sector: "sector"
  };
  const dimension = dimensionMap[requestedDimension] ?? "sector";
  const asOfDate = parseOptionalDate(args.asOfDate) ?? context.now;
  const exposure = await getPortfolioExposure(context.userId, asOfDate);
  const chart = exposure.charts[dimension];
  const chartMeta = exposure.chartMeta[dimension];
  return {
    ok: true,
    tool: "getExposureBreakdown",
    data: {
      dimension,
      asOfDate: exposure.asOfDate,
      coveragePct: round(chartMeta.coverage * 100, 2),
      noDataPct: round(chartMeta.noData * 100, 2),
      slices: chart.map((row) => ({
        key: row.key,
        label: row.label,
        valuePct: round(row.value * 100, 2)
      }))
    },
    caveats:
      chartMeta.noData > 0
        ? ["Exposure coverage is partial and includes a No data bucket."]
        : []
  };
}

async function executeGetTransactions(
  context: ToolContext,
  args: Record<string, unknown>
): Promise<ToolExecuteResult> {
  const limit = parseLimit(args.limit, 20, 100);
  const startDate = parseOptionalDate(args.startDate);
  const endDate = parseOptionalDate(args.endDate);

  const rows = await prisma.transaction.findMany({
    where: {
      userId: context.userId,
      type: "TRADE",
      ...(startDate || endDate
        ? {
            tradeAt: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {})
            }
          }
        : {})
    },
    orderBy: { tradeAt: "desc" },
    take: limit,
    include: {
      instrument: {
        select: {
          id: true,
          isin: true,
          name: true,
          displayName: true
        }
      }
    }
  });

  let buyValueEur = 0;
  let sellValueEur = 0;
  const transactions = rows.map((row) => {
    const quantity = toNumber(row.quantity);
    const action = quantity >= 0 ? "BUY" : "SELL";
    const valueCandidate = row.valueEur ?? row.totalEur;
    const valueEur =
      valueCandidate === null || valueCandidate === undefined ? null : Math.abs(toNumber(valueCandidate));
    if (valueEur !== null && Number.isFinite(valueEur)) {
      if (action === "BUY") buyValueEur += valueEur;
      else sellValueEur += valueEur;
    }

    return {
      date: toIsoDate(row.tradeAt),
      action,
      instrumentId: row.instrument.id,
      isin: row.instrument.isin,
      name: row.instrument.displayName || row.instrument.name,
      quantity: round(Math.abs(quantity), 8),
      valueEur: valueEur === null || !Number.isFinite(valueEur) ? null : round(valueEur, 2)
    };
  });

  return {
    ok: true,
    tool: "getTransactions",
    data: {
      limit,
      range: {
        startDate: startDate ? toIsoDate(startDate) : null,
        endDate: endDate ? toIsoDate(endDate) : null
      },
      tradeCount: transactions.length,
      buyValueEur: round(buyValueEur, 2),
      sellValueEur: round(sellValueEur, 2),
      netInvestedEur: round(buyValueEur - sellValueEur, 2),
      transactions
    }
  };
}

async function executeGetLargestPositions(
  context: ToolContext,
  args: Record<string, unknown>
): Promise<ToolExecuteResult> {
  const limit = parseLimit(args.limit, 10, 50);
  const positions = await getCurrentPositionValues(context.userId, context.now);
  return {
    ok: true,
    tool: "getLargestPositions",
    data: {
      asOfDate: toIsoDate(context.now),
      positions: positions.positions.slice(0, limit).map((row) => ({
        instrumentId: row.instrumentId,
        isin: row.isin,
        name: row.instrumentName,
        quantity: row.quantity,
        valueEur: row.valueEur,
        weightPct: round(row.weight * 100, 2),
        priceDate: row.priceDate
      }))
    },
    caveats: positions.caveats
  };
}

async function executeGetPositionDetails(
  context: ToolContext,
  args: Record<string, unknown>
): Promise<ToolExecuteResult> {
  const instrumentId = typeof args.instrumentId === "string" ? args.instrumentId.trim() : "";
  const isin = typeof args.isin === "string" ? args.isin.trim().toUpperCase() : "";
  const name = typeof args.name === "string" ? args.name.trim().toLowerCase() : "";
  const positions = await getCurrentPositionValues(context.userId, context.now);

  const matches = positions.positions.filter((row) => {
    if (instrumentId && row.instrumentId === instrumentId) return true;
    if (isin && row.isin.toUpperCase() === isin) return true;
    if (name && row.instrumentName.toLowerCase().includes(name)) return true;
    return false;
  });

  if (!matches.length) {
    return {
      ok: true,
      tool: "getPositionDetails",
      data: {
        query: {
          instrumentId: instrumentId || null,
          isin: isin || null,
          name: name || null
        },
        matches: []
      },
      caveats: ["No matching open position was found for the provided identifier."]
    };
  }

  return {
    ok: true,
    tool: "getPositionDetails",
    data: {
      query: {
        instrumentId: instrumentId || null,
        isin: isin || null,
        name: name || null
      },
      matches: matches.map((row) => ({
        instrumentId: row.instrumentId,
        isin: row.isin,
        name: row.instrumentName,
        quantity: row.quantity,
        valueEur: row.valueEur,
        weightPct: round(row.weight * 100, 2),
        priceDate: row.priceDate
      }))
    },
    caveats: positions.caveats
  };
}

async function executeGetRecentPortfolioChanges(
  context: ToolContext,
  args: Record<string, unknown>
): Promise<ToolExecuteResult> {
  const timeframe = parseChatTimeframe(args.timeframe, "1m");
  const dailyRows = await getDailyPortfolioRows(context.userId);
  const performance = computePerformancePayload(dailyRows, timeframe);
  const windowStart = performance.summary.startDate
    ? new Date(`${performance.summary.startDate}T00:00:00.000Z`)
    : null;
  const windowEnd = performance.summary.endDate
    ? new Date(`${performance.summary.endDate}T00:00:00.000Z`)
    : null;

  const trades =
    windowStart && windowEnd
      ? await prisma.transaction.findMany({
          where: {
            userId: context.userId,
            type: "TRADE",
            tradeAt: { gte: windowStart, lte: windowEnd }
          },
          orderBy: { tradeAt: "desc" },
          take: 50,
          select: {
            tradeAt: true,
            quantity: true,
            valueEur: true,
            totalEur: true
          }
        })
      : [];

  let buyValueEur = 0;
  let sellValueEur = 0;
  for (const row of trades) {
    const quantity = toNumber(row.quantity);
    const raw = row.valueEur ?? row.totalEur;
    const valueEur = raw === null || raw === undefined ? Number.NaN : Math.abs(toNumber(raw));
    if (!Number.isFinite(valueEur)) continue;
    if (quantity > 0) buyValueEur += valueEur;
    if (quantity < 0) sellValueEur += valueEur;
  }

  const movers = await getTopMoversByRange(context.userId, timeframe);
  return {
    ok: true,
    tool: "getRecentPortfolioChanges",
    data: {
      timeframe,
      performance: performance.summary,
      activity: {
        tradeCount: trades.length,
        buyValueEur: round(buyValueEur, 2),
        sellValueEur: round(sellValueEur, 2),
        netInvestedEur: round(buyValueEur - sellValueEur, 2)
      },
      topContributor: movers.contributors.topGainers[0]
        ? {
            isin: movers.contributors.topGainers[0].isin,
            name: movers.contributors.topGainers[0].instrumentName,
            contributionEur: round(movers.contributors.topGainers[0].contributionEur, 2)
          }
        : null,
      topDetractor: movers.contributors.topLosers[0]
        ? {
            isin: movers.contributors.topLosers[0].isin,
            name: movers.contributors.topLosers[0].instrumentName,
            contributionEur: round(movers.contributors.topLosers[0].contributionEur, 2)
          }
        : null
    },
    caveats: performance.caveats
  };
}

function executeGetMethodologyExplanation(args: Record<string, unknown>): ToolExecuteResult {
  const topic = typeof args.topic === "string" ? args.topic.trim().toLowerCase() : "general";
  const catalog: Record<string, string> = {
    performance:
      "Performance figures come from the app's canonical DailyPortfolioValue series, using the same timeframe and weekly/daily granularity logic as the portfolio performance chart.",
    exposure:
      "Exposure values are computed from normalized InstrumentExposureSnapshot data and weighted by current portfolio weights. Charts include a No data slice when coverage is incomplete.",
    contributors:
      "Top contributors/detractors reuse the existing top-movers service and are based on price movement over the selected range using the app's mapped listings and FX conversion rules.",
    transactions:
      "Transaction summaries are based on synced trade records and reported value fields (valueEur/totalEur), with buys and sells separated by signed quantity."
  };
  const key = Object.keys(catalog).find((entry) => topic.includes(entry)) || "performance";

  return {
    ok: true,
    tool: "getMethodologyExplanation",
    data: {
      topic: key,
      explanation: catalog[key]
    }
  };
}

export const portfolioChatTools: PortfolioToolDefinition[] = [
  {
    name: "getPortfolioOverview",
    description: "Get a high-level snapshot of current portfolio value, open positions, and concentration.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {}
    },
    execute: async (context) => executeGetPortfolioOverview(context)
  },
  {
    name: "getPerformanceSummary",
    description: "Get portfolio performance summary for a timeframe. Use max, ytd, 1y, or 1m.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        timeframe: { type: "string", enum: ["max", "ytd", "1y", "1m"] }
      }
    },
    execute: async (context, args) => executeGetPerformanceSummary(context, args)
  },
  {
    name: "getTopContributors",
    description: "Get top positive contributors for a timeframe.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        timeframe: { type: "string", enum: ["max", "ytd", "1y", "1m"] }
      }
    },
    execute: async (context, args) => executeGetTopContributors(context, args)
  },
  {
    name: "getTopDetractors",
    description: "Get top negative contributors for a timeframe.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        timeframe: { type: "string", enum: ["max", "ytd", "1y", "1m"] }
      }
    },
    execute: async (context, args) => executeGetTopDetractors(context, args)
  },
  {
    name: "getExposureBreakdown",
    description: "Get current portfolio exposure breakdown by region, development, country, or sector.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        dimension: { type: "string", enum: ["region", "development", "country", "sector"] },
        asOfDate: { type: "string", description: "Optional date in YYYY-MM-DD format." }
      },
      required: ["dimension"]
    },
    execute: async (context, args) => executeGetExposureBreakdown(context, args)
  },
  {
    name: "getTransactions",
    description: "Get recent trade transactions with optional date filters.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        startDate: { type: "string", description: "Optional date in YYYY-MM-DD format." },
        endDate: { type: "string", description: "Optional date in YYYY-MM-DD format." },
        limit: { type: "integer", minimum: 1, maximum: 100 }
      }
    },
    execute: async (context, args) => executeGetTransactions(context, args)
  },
  {
    name: "getLargestPositions",
    description: "Get largest currently held positions ranked by market value.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 50 }
      }
    },
    execute: async (context, args) => executeGetLargestPositions(context, args)
  },
  {
    name: "getPositionDetails",
    description: "Get details for one or more open positions by instrumentId, ISIN, or instrument name.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        instrumentId: { type: "string" },
        isin: { type: "string" },
        name: { type: "string" }
      }
    },
    execute: async (context, args) => executeGetPositionDetails(context, args)
  },
  {
    name: "getRecentPortfolioChanges",
    description: "Get a concise summary of performance, activity, and drivers for a timeframe.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        timeframe: { type: "string", enum: ["max", "ytd", "1y", "1m"] }
      }
    },
    execute: async (context, args) => executeGetRecentPortfolioChanges(context, args)
  },
  {
    name: "getMethodologyExplanation",
    description: "Explain how portfolio analytics are calculated in this app.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        topic: { type: "string" }
      }
    },
    execute: async (_context, args) => executeGetMethodologyExplanation(args)
  }
];

export function getToolByName(name: string) {
  return portfolioChatTools.find((tool) => tool.name === name) || null;
}
