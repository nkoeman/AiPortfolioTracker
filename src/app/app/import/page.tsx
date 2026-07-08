import { redirect } from "next/navigation";
import { format, startOfDay } from "date-fns";
import { ManualTransactionButton } from "@/components/ManualTransactionButton";
import { SyncPricesButton } from "@/components/SyncPricesButton";
import { ImportDropzoneCard } from "@/components/import/ImportDropzoneCard";
import { TransactionsTableClient } from "@/components/import/TransactionsTableClient";
import { PageContainer } from "@/components/layout/PageContainer";
import { getCurrentAppUser } from "@/lib/auth/appUser";
import { ensureEodhdExchangeDirectoryLoaded } from "@/lib/eodhd/exchanges";
import { prisma } from "@/lib/prisma";

function toNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value);
}

const quantityFormatter = new Intl.NumberFormat("nl-NL", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4
});

function moneyFormatter(currency: string) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export default async function TransactionsPage() {
  const user = await getCurrentAppUser();
  if (!user) redirect("/sign-in");

  try {
    await ensureEodhdExchangeDirectoryLoaded();
  } catch (error) {
    console.warn("[transactions.page] unable to preload exchange directory", {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  const [transactions, exchanges, latestImport] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        tradeAt: true,
        quantity: true,
        price: true,
        transactionCosts: true,
        valueEur: true,
        totalEur: true,
        currency: true,
        exchangeCode: true,
        instrument: {
          select: {
            name: true,
            displayName: true
          }
        }
      },
      orderBy: { tradeAt: "desc" }
    }),
    prisma.eodhdExchange.findMany({
      select: {
        code: true,
        name: true,
        country: true,
        currency: true
      },
      orderBy: [{ code: "asc" }]
    }),
    prisma.importBatch.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            transactions: true
          }
        }
      }
    })
  ]);

  const rows = transactions.map((tx) => {
    const amount = tx.valueEur ?? tx.totalEur;
    const type = toNumber(tx.quantity) < 0 ? "Sell" : "Buy";
    const currency = tx.currency || "EUR";

    return {
      id: tx.id,
      date: format(startOfDay(tx.tradeAt), "yyyy-MM-dd"),
      type: type as "Buy" | "Sell",
      name: tx.instrument.displayName || tx.instrument.name,
      quantity: quantityFormatter.format(Math.abs(toNumber(tx.quantity))),
      price: tx.price === null ? "-" : moneyFormatter(currency).format(toNumber(tx.price)),
      currency,
      exchangeCode: tx.exchangeCode,
      amount: amount === null ? "-" : moneyFormatter("EUR").format(toNumber(amount))
    };
  });

  const latestImportDate = latestImport?.createdAt ? format(latestImport.createdAt, "dd MMM yyyy") : null;
  const subtitleParts = [
    `${transactions.length} transaction${transactions.length === 1 ? "" : "s"}`,
    latestImportDate ? `last import ${latestImportDate}` : "no import yet",
    "idempotent CSV import"
  ];

  return (
    <PageContainer>
      <div className="page-stack">
        <div className="page-head">
          <div>
            <h1 className="page-title">Transactions</h1>
            <p className="page-sub">{subtitleParts.join(" - ")}</p>
          </div>
        </div>

        <div className="import-grid">
          <ImportDropzoneCard
            latestImport={{
              createdAt: latestImport?.createdAt ? latestImport.createdAt.toISOString() : null,
              fileName: latestImport?.fileName ?? null,
              importedRows: latestImport?._count.transactions ?? null
            }}
          />

          <div className="card sync-status-card">
            <div className="card-head">
              <div>
                <h2 className="card-title">Sync status</h2>
              </div>
            </div>
            <SyncPricesButton />
          </div>
        </div>

        <TransactionsTableClient rows={rows} actions={<ManualTransactionButton exchanges={exchanges} />} />
      </div>
    </PageContainer>
  );
}
