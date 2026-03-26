import { redirect } from "next/navigation";
import { format, startOfDay } from "date-fns";
import { BrandMotif } from "@/components/BrandMotif";
import { ManualTransactionButton } from "@/components/ManualTransactionButton";
import { SyncPricesButton } from "@/components/SyncPricesButton";
import { PageContainer } from "@/components/layout/PageContainer";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/layout/Card";
import { getCurrentAppUser } from "@/lib/auth/appUser";
import { ensureEodhdExchangeDirectoryLoaded } from "@/lib/eodhd/exchanges";
import { prisma } from "@/lib/prisma";

function toNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value);
}

// Renders transaction data update actions, CSV import, and a full transaction overview.
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

  const transactions = await prisma.transaction.findMany({
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
  });

  const exchanges = await prisma.eodhdExchange.findMany({
    select: {
      code: true,
      name: true,
      country: true,
      currency: true
    },
    orderBy: [{ code: "asc" }]
  });

  return (
    <PageContainer>
      <div className="page-stack">
        <Section>
          <Card className="row">
            <div>
              <div className="section-title">Data update</div>
              <h2>Data update</h2>
              <small>Run sync jobs to refresh prices and portfolio values.</small>
            </div>
            <SyncPricesButton />
          </Card>
        </Section>

        <Section>
          <Card className="import-card">
            <BrandMotif />
            <div className="section-title">Transactions</div>
            <h1>Transactions</h1>
            <p>
              Upload your DeGiro transactions export. Supported columns: Datum, Tijd, Product, ISIN, Aantal,
              Koers, Waarde EUR, Totaal EUR.
            </p>
            <form action="/api/import" method="post" encType="multipart/form-data">
              <label>
                CSV file
                <input type="file" name="file" accept=".csv,text/csv" required />
              </label>
              <button type="submit">Import</button>
            </form>
            <small>
              Imports are idempotent: duplicate rows (same trade details) will be skipped.
            </small>
          </Card>
        </Section>

        <Section>
          <Card>
            <div className="row">
              <div className="stack-sm">
                <div className="section-title">Transactions</div>
                <h2>All Transactions</h2>
              </div>
              <ManualTransactionButton exchanges={exchanges} />
            </div>
            {!transactions.length ? (
              <small>No transactions yet.</small>
            ) : (
              <div className="table-scroll">
                <table className="table table-mobile-stack">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Name</th>
                      <th>Quantity</th>
                      <th>Price</th>
                      <th>Currency</th>
                      <th>Exchange</th>
                      <th>Costs</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => {
                      const amount = tx.valueEur ?? tx.totalEur;
                      const type = toNumber(tx.quantity) < 0 ? "Sell" : "Buy";
                      return (
                        <tr key={tx.id}>
                          <td data-label="Date">{format(startOfDay(tx.tradeAt), "yyyy-MM-dd")}</td>
                          <td data-label="Type">{type}</td>
                          <td data-label="Name">{tx.instrument.displayName || tx.instrument.name}</td>
                          <td data-label="Quantity">{Math.abs(toNumber(tx.quantity)).toFixed(4)}</td>
                          <td data-label="Price">{tx.price === null ? "-" : toNumber(tx.price).toFixed(4)}</td>
                          <td data-label="Currency">{tx.currency}</td>
                          <td data-label="Exchange">{tx.exchangeCode}</td>
                          <td data-label="Costs">
                            {tx.transactionCosts === null ? "-" : `${tx.currency} ${toNumber(tx.transactionCosts).toFixed(2)}`}
                          </td>
                          <td data-label="Amount">{amount === null ? "-" : `EUR ${toNumber(amount).toFixed(2)}`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </Section>
      </div>
    </PageContainer>
  );
}
