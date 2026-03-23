import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { resolveOrCreateListingForTransaction } from "@/lib/eodhd/mapping";
import { parseDegiroCsv } from "@/lib/import/degiroCsv";
import { ensureInstrumentProfiles } from "@/lib/enrichment";
import { enrichInstrumentsFromOpenFigi } from "@/lib/openfigi/enrich";
import { kickoffIsharesExposureSnapshots } from "@/lib/ishares/ensureIsharesExposure";
import { syncLast4WeeksForUser } from "@/lib/prices/sync";
import { prisma } from "@/lib/prisma";
import { buildTransactionUniqueKey } from "@/lib/transactions/buildUniqueKey";

export const runtime = "nodejs";

// Imports a DeGiro CSV, resolves MIC-first listing mapping, and triggers background price sync.
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "CSV file is required." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const csv = buffer.toString("utf8");
    const rows = parseDegiroCsv(csv);

    if (!rows.length) {
      return NextResponse.json({ error: "No valid rows found in CSV." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const importBatch = await prisma.importBatch.create({
      data: {
        userId: user.id,
        source: "degiro",
        fileName: file.name
      }
    });

    const productByIsin = new Map<string, string>();
    for (const row of rows) {
      if (!productByIsin.has(row.isin)) {
        productByIsin.set(row.isin, row.product);
      }
    }

    const instrumentMap = new Map<string, { id: string; isin: string }>();
    for (const [isin, product] of productByIsin.entries()) {
      const instrument = await prisma.instrument.upsert({
        where: { isin },
        update: { name: product },
        create: { isin, name: product, displayName: product }
      });

      if (!instrument.displayName) {
        await prisma.instrument.update({
          where: { isin },
          data: { displayName: product }
        });
      }

      instrumentMap.set(isin, { id: instrument.id, isin: instrument.isin });
    }

    try {
      await enrichInstrumentsFromOpenFigi(Array.from(productByIsin.keys()), {
        userId: user.id,
        importBatchId: importBatch.id
      });
    } catch (error) {
      console.error("[ENRICH][OPENFIGI] import enrichment failed", {
        userId: user.id,
        importBatchId: importBatch.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    try {
      await ensureInstrumentProfiles(Array.from(productByIsin.keys()), {
        userId: user.id,
        importBatchId: importBatch.id
      });
    } catch (error) {
      console.error("[ENRICH][PROFILE] import enrichment failed", {
        userId: user.id,
        importBatchId: importBatch.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    kickoffIsharesExposureSnapshots({
      userId: user.id,
      instrumentIds: Array.from(instrumentMap.values()).map((instrument) => instrument.id)
    });

    const listingCache = new Map<string, string | null>();

    const prepared = [] as Array<{
      userId: string;
      instrumentId: string;
      listingId: string | null;
      importBatchId: string;
      tradeAt: Date;
      quantity: number;
      price: number | null;
      valueEur: number | null;
      totalEur: number | null;
      currency: string;
      exchange: string;
      exchangeCode: string;
      type: "TRADE";
      uniqueKey: string;
    }>;

    for (const row of rows) {
      const instrument = instrumentMap.get(row.isin);
      if (!instrument) continue;

      const beursCode = (row.exchange || "UNKNOWN").trim().toUpperCase() || "UNKNOWN";
      const listingKey = `${row.isin}|${beursCode}`;

      let listingId = listingCache.get(listingKey);
      if (listingId === undefined) {
        const listing = await resolveOrCreateListingForTransaction({
          userId: user.id,
          isin: instrument.isin,
          productName: row.product,
          degiroBeursCode: beursCode,
          transactionCurrency: row.currency || "UNKNOWN"
        });
        listingId = listing?.id || null;
        listingCache.set(listingKey, listingId);
      }

      prepared.push({
        userId: user.id,
        instrumentId: instrument.id,
        listingId: listingId ?? null,
        importBatchId: importBatch.id,
        tradeAt: row.tradeAt,
        quantity: row.quantity,
        price: row.price,
        valueEur: row.valueEur,
        totalEur: row.totalEur,
        currency: row.currency,
        exchange: beursCode,
        exchangeCode: beursCode,
        type: "TRADE",
        uniqueKey: buildTransactionUniqueKey(
          user.id,
          row.isin,
          beursCode,
          row.tradeAt,
          row.quantity,
          row.price,
          row.totalEur,
          row.product
        )
      });
    }

    const result = await prisma.transaction.createMany({ data: prepared, skipDuplicates: true });

    const unmappedRows = prepared.filter((row) => !row.listingId).length;
    const warning =
      unmappedRows > 0
        ? "Some instruments could not be mapped; they will be excluded from valuation until mapping succeeds automatically."
        : null;

    const listingIds = Array.from(new Set(prepared.map((row) => row.listingId).filter((id): id is string => Boolean(id))));

    void syncLast4WeeksForUser(user.id).catch((error) => {
      console.error("[prices.sync] import-triggered sync failed", { userId: user.id, error });
    });

    return NextResponse.json({
      imported: result.count,
      totalRows: rows.length,
      skipped: rows.length - result.count,
      syncTriggered: true,
      mappedListings: listingIds.length,
      unmappedRows,
      warning
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
