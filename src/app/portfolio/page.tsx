import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { format, startOfDay, startOfYear } from "date-fns";
import { ClosedPositionsTable, ClosedPositionRow } from "@/components/ClosedPositionsTable";
import { OpenPositionsTable, OpenPositionRow, OpenPositionColumn } from "@/components/OpenPositionsTable";
import { authOptions } from "@/lib/auth/options";
import { getFxRateForWeek } from "@/lib/fx/convert";
import { prisma } from "@/lib/prisma";

type SortKey =
  | "name"
  | "isin"
  | "quantity"
  | "latestAdjCloseEur"
  | "marketValueEur"
  | "totalPnlEur"
  | "ytdPnlEur"
  | "ytdPct";

type SortDir = "asc" | "desc";

function toSingleQueryParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function compareNullableNumbers(a: number | null, b: number | null) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value);
}

function buildProfileTags(profile: { assetType: string; region: string; trackedIndexName: string | null } | null) {
  if (!profile) return [];
  const tags: string[] = [];
  if (profile.assetType && profile.assetType !== "OTHER") tags.push(profile.assetType);
  if (profile.region && profile.region !== "UNKNOWN") tags.push(profile.region);
  if (profile.trackedIndexName) tags.push(profile.trackedIndexName);
  return tags;
}

function buildClosedPositions(
  transactions: Array<{
    instrumentId: string;
    quantity: unknown;
    tradeAt: Date;
    price: unknown;
    valueEur: unknown;
    instrument: { name: string; displayName: string | null; isin: string };
  }>
): ClosedPositionRow[] {
  const map = new Map<
    string,
    {
      name: string;
      isin: string;
      netQty: number;
      soldQty: number;
      buyCostEur: number | null;
      sellProceedsEur: number | null;
      lastTradeAt: Date;
    }
  >();

  for (const tx of transactions) {
    const qty = toNumber(tx.quantity);
    const txPrice = tx.price === null || tx.price === undefined ? null : toNumber(tx.price);
    const txValueEur = tx.valueEur === null || tx.valueEur === undefined ? null : toNumber(tx.valueEur);

    const current = map.get(tx.instrumentId) || {
      name: tx.instrument.displayName || tx.instrument.name,
      isin: tx.instrument.isin,
      netQty: 0,
      soldQty: 0,
      buyCostEur: 0,
      sellProceedsEur: 0,
      lastTradeAt: tx.tradeAt
    };

    current.netQty += qty;

    if (qty > 0) {
      const buyLegEur = txValueEur !== null && Number.isFinite(txValueEur) ? Math.abs(txValueEur) : null;
      if (buyLegEur !== null) {
        if (current.buyCostEur !== null) current.buyCostEur += buyLegEur;
      } else if (txPrice !== null && Number.isFinite(txPrice) && current.buyCostEur !== null) {
        current.buyCostEur += qty * txPrice;
      } else {
        current.buyCostEur = null;
      }
    }

    if (qty < 0) {
      const sold = Math.abs(qty);
      current.soldQty += sold;
      const sellLegEur = txValueEur !== null && Number.isFinite(txValueEur) ? Math.abs(txValueEur) : null;
      if (sellLegEur !== null) {
        if (current.sellProceedsEur !== null) current.sellProceedsEur += sellLegEur;
      } else if (txPrice !== null && Number.isFinite(txPrice) && current.sellProceedsEur !== null) {
        current.sellProceedsEur += sold * txPrice;
      } else {
        current.sellProceedsEur = null;
      }
    }

    if (tx.tradeAt > current.lastTradeAt) current.lastTradeAt = tx.tradeAt;
    map.set(tx.instrumentId, current);
  }

  return Array.from(map.entries())
    .filter(([, row]) => Math.abs(row.netQty) < 1e-8 && row.soldQty > 0)
    .map(([instrumentId, row]) => {
      const pnl =
        row.buyCostEur === null || row.sellProceedsEur === null ? null : row.sellProceedsEur - row.buyCostEur;
      const pnlPct = pnl === null || !row.buyCostEur || row.buyCostEur === 0 ? null : pnl / row.buyCostEur;

      return {
        instrumentId,
        name: row.name,
        isin: row.isin,
        buyCostEur: row.buyCostEur,
        sellProceedsEur: row.sellProceedsEur,
        pnl,
        pnlPct,
        closedAt: row.lastTradeAt
      };
    })
    .sort((a, b) => b.closedAt.getTime() - a.closedAt.getTime());
}

export default async function PortfolioPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) redirect("/login");

  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id },
    include: {
      instrument: {
        include: {
          listings: true,
          profile: true
        }
      },
      listing: true
    },
    orderBy: { tradeAt: "asc" }
  });

  const closedPositions = buildClosedPositions(transactions);

  if (!transactions.length) {
    return (
      <div className="card auth-card">
        <div className="section-title">Portfolio</div>
        <h1>Portfolio</h1>
        <p>No transactions yet. Import your DeGiro CSV to get started.</p>
      </div>
    );
  }

  const firstTransactionDate = startOfDay(transactions[0].tradeAt);
  const today = startOfDay(new Date());
  const ytdStart = startOfYear(today);

  const byInstrument = new Map<
    string,
    {
      instrumentId: string;
      isin: string;
      name: string;
      qty: number;
      fallbackListingId: string | null;
      listings: typeof transactions[number]["instrument"]["listings"];
      profile: typeof transactions[number]["instrument"]["profile"];
    }
  >();

  for (const tx of transactions) {
    const key = tx.instrumentId;
    const entry = byInstrument.get(key) ?? {
      instrumentId: tx.instrumentId,
      isin: tx.instrument.isin,
      name: tx.instrument.displayName || tx.instrument.name,
      qty: 0,
      fallbackListingId: tx.listingId,
      listings: tx.instrument.listings,
      profile: tx.instrument.profile
    };
    entry.qty += toNumber(tx.quantity);
    if (!entry.fallbackListingId && tx.listingId) {
      entry.fallbackListingId = tx.listingId;
    }
    byInstrument.set(key, entry);
  }

  const chosenListingByInstrument = new Map<string, string>();
  const chosenListingIds = new Set<string>();
  let unmappedCount = 0;

  for (const entry of byInstrument.values()) {
    const primaryMapped = entry.listings.find((l) => l.isPrimary && l.mappingStatus === "MAPPED" && l.eodhdCode);
    const anyMapped = entry.listings.find((l) => l.mappingStatus === "MAPPED" && l.eodhdCode);
    const fallback = entry.listings.find((l) => l.id === entry.fallbackListingId && l.eodhdCode);

    const chosen = primaryMapped || fallback || anyMapped || null;
    if (!chosen) {
      unmappedCount += 1;
      continue;
    }

    chosenListingByInstrument.set(entry.instrumentId, chosen.id);
    chosenListingIds.add(chosen.id);
  }

  const prices = await prisma.dailyListingPrice.findMany({
    where: {
      listingId: { in: Array.from(chosenListingIds) },
      date: { gte: firstTransactionDate }
    },
    orderBy: [{ listingId: "asc" }, { date: "asc" }]
  });

  const pricesByListing = new Map<string, Array<{ date: Date; adjClose: number; currency: string }>>();
  for (const price of prices) {
    const list = pricesByListing.get(price.listingId) ?? [];
    list.push({
      date: startOfDay(price.date),
      adjClose: toNumber(price.adjustedClose),
      currency: price.currency || "EUR"
    });
    pricesByListing.set(price.listingId, list);
  }

  const costBasisEurByInstrument = new Map<string, { buyCostEur: number | null; sellProceedsEur: number | null }>();

  for (const tx of transactions) {
    const qty = toNumber(tx.quantity);
    const valueEur = tx.valueEur === null || tx.valueEur === undefined ? null : toNumber(tx.valueEur);

    const basis = costBasisEurByInstrument.get(tx.instrumentId) || { buyCostEur: 0, sellProceedsEur: 0 };

    if (qty > 0) {
      if (valueEur !== null && Number.isFinite(valueEur)) {
        if (basis.buyCostEur !== null) basis.buyCostEur += Math.abs(valueEur);
      } else {
        basis.buyCostEur = null;
      }
    }

    if (qty < 0) {
      if (valueEur !== null && Number.isFinite(valueEur)) {
        if (basis.sellProceedsEur !== null) basis.sellProceedsEur += Math.abs(valueEur);
      } else {
        basis.sellProceedsEur = null;
      }
    }

    costBasisEurByInstrument.set(tx.instrumentId, basis);
  }

  const rows = [] as OpenPositionRow[];

  for (const entry of byInstrument.values()) {
    const listingId = chosenListingByInstrument.get(entry.instrumentId);
    if (!listingId || entry.qty === 0) continue;

    const series = pricesByListing.get(listingId) ?? [];
    const latest = series[series.length - 1] ?? null;
    const ytdStartPrice = series.find((point) => point.date.getTime() >= ytdStart.getTime()) ?? null;

    const latestAdjClose = latest?.adjClose ?? null;

    let latestFx: number | null = null;
    if (latest && latestAdjClose !== null) {
      try {
        latestFx = await getFxRateForWeek(latest.date, latest.currency);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn("[VAL][EUR] missing latest FX conversion for position", {
          userId: user.id,
          instrumentId: entry.instrumentId,
          isin: entry.isin,
          listingId,
          currency: latest.currency,
          weekEndDate: format(latest.date, "yyyy-MM-dd"),
          message
        });
      }
    }

    const latestAdjCloseEur = latestAdjClose === null || latestFx === null ? null : latestAdjClose * latestFx;
    const marketValueEur = latestAdjClose === null || latestFx === null ? null : entry.qty * latestAdjClose * latestFx;

    const basis = costBasisEurByInstrument.get(entry.instrumentId) || { buyCostEur: null, sellProceedsEur: null };
    const netInvestedEur =
      basis.buyCostEur === null || basis.sellProceedsEur === null
        ? null
        : basis.buyCostEur - basis.sellProceedsEur;
    const totalPnlEur = marketValueEur === null || netInvestedEur === null ? null : marketValueEur - netInvestedEur;

    let ytdPnlEur: number | null = null;
    let ytdPct: number | null = null;

    if (latestAdjClose !== null && ytdStartPrice && ytdStartPrice.adjClose !== 0 && latestFx !== null) {
      try {
        const ytdFx = await getFxRateForWeek(ytdStartPrice.date, ytdStartPrice.currency);
        const latestUnitEur = latestAdjClose * latestFx;
        const ytdUnitEur = ytdStartPrice.adjClose * ytdFx;
        ytdPnlEur = entry.qty * (latestUnitEur - ytdUnitEur);
        ytdPct = ytdUnitEur === 0 ? null : latestUnitEur / ytdUnitEur - 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn("[VAL][EUR] missing YTD FX conversion for position", {
          userId: user.id,
          instrumentId: entry.instrumentId,
          isin: entry.isin,
          listingId,
          latestCurrency: latest.currency,
          ytdCurrency: ytdStartPrice.currency,
          latestWeekEndDate: format(latest.date, "yyyy-MM-dd"),
          ytdWeekEndDate: format(ytdStartPrice.date, "yyyy-MM-dd"),
          message
        });
      }
    }

    rows.push({
      name: entry.name,
      isin: entry.isin,
      quantity: entry.qty,
      latestAdjCloseEur,
      marketValueEur,
      totalPnlEur,
      ytdPnlEur,
      ytdPct,
      profileTags: buildProfileTags(entry.profile)
    });
  }

  const rawSort = toSingleQueryParam(searchParams?.sort);
  const rawDir = toSingleQueryParam(searchParams?.dir);

  const allowedSorts: SortKey[] = [
    "name",
    "isin",
    "quantity",
    "latestAdjCloseEur",
    "marketValueEur",
    "totalPnlEur",
    "ytdPnlEur",
    "ytdPct"
  ];

  const sortKey: SortKey = allowedSorts.includes(rawSort as SortKey) ? (rawSort as SortKey) : "name";
  const sortDir: SortDir = rawDir === "desc" ? "desc" : "asc";
  const direction = sortDir === "asc" ? 1 : -1;

  rows.sort((a, b) => {
    switch (sortKey) {
      case "name":
        return direction * a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      case "isin":
        return direction * a.isin.localeCompare(b.isin, undefined, { sensitivity: "base" });
      case "quantity":
        return direction * (a.quantity - b.quantity);
      case "latestAdjCloseEur":
        return direction * compareNullableNumbers(a.latestAdjCloseEur, b.latestAdjCloseEur);
      case "marketValueEur":
        return direction * compareNullableNumbers(a.marketValueEur, b.marketValueEur);
      case "totalPnlEur":
        return direction * compareNullableNumbers(a.totalPnlEur, b.totalPnlEur);
      case "ytdPnlEur":
        return direction * compareNullableNumbers(a.ytdPnlEur, b.ytdPnlEur);
      case "ytdPct":
        return direction * compareNullableNumbers(a.ytdPct, b.ytdPct);
      default:
        return 0;
    }
  });

  const columns: OpenPositionColumn[] = [
    { key: "name", label: "Product" },
    { key: "isin", label: "ISIN" },
    { key: "quantity", label: "Qty" },
    { key: "latestAdjCloseEur", label: "Latest adj close (EUR)" },
    { key: "marketValueEur", label: "Market value (EUR)" },
    { key: "totalPnlEur", label: "P&L (EUR)" },
    { key: "ytdPnlEur", label: "YTD P&L (EUR)" },
    { key: "ytdPct", label: "% YTD" }
  ];

  return (
    <div className="stack-lg">
      <div className="card row">
        <div>
          <div className="section-title">Portfolio</div>
          <h2>Portfolio</h2>
          {unmappedCount > 0 ? (
            <small className="warning-text">
              Some instruments could not be mapped; they are excluded from valuation until mapping succeeds automatically.
            </small>
          ) : null}
        </div>
      </div>

      <div className="card">
        <div className="section-title">Portfolio Drivers</div>
        <h2>Open Positions</h2>
        <OpenPositionsTable
          rows={rows}
          columns={columns}
          sortKey={sortKey}
          sortDir={sortDir}
          basePath="/portfolio"
        />
      </div>

      <div className="card">
        <div className="section-title">Risk Summary</div>
        <h2>Closed Positions</h2>
        <ClosedPositionsTable rows={closedPositions} />
      </div>
    </div>
  );
}
