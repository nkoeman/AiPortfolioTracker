import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { format, startOfDay } from "date-fns";
import { BrandMotif } from "@/components/BrandMotif";
import { SyncPricesButton } from "@/components/SyncPricesButton";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";

function toNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value);
}

// Renders transaction data update actions, CSV import, and a full transaction overview.
export default async function TransactionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) redirect("/login");

  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      tradeAt: true,
      quantity: true,
      price: true,
      valueEur: true,
      totalEur: true,
      instrument: {
        select: {
          name: true,
          displayName: true
        }
      }
    },
    orderBy: { tradeAt: "desc" }
  });

  return (
    <div className="stack-lg">
      <div className="card row">
        <div>
          <div className="section-title">Data update</div>
          <h2>Data update</h2>
          <small>Run sync jobs to refresh prices and portfolio values.</small>
        </div>
        <SyncPricesButton />
      </div>

      <div className="card import-card">
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
      </div>

      <div className="card">
        <div className="section-title">Transactions</div>
        <h2>All Transactions</h2>
        {!transactions.length ? (
          <small>No transactions yet.</small>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Name</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => {
                const amount = tx.valueEur ?? tx.totalEur;
                return (
                  <tr key={tx.id}>
                    <td>{format(startOfDay(tx.tradeAt), "yyyy-MM-dd")}</td>
                    <td>{tx.instrument.displayName || tx.instrument.name}</td>
                    <td>{toNumber(tx.quantity).toFixed(4)}</td>
                    <td>{tx.price === null ? "-" : toNumber(tx.price).toFixed(4)}</td>
                    <td>{amount === null ? "-" : `EUR ${toNumber(amount).toFixed(2)}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
