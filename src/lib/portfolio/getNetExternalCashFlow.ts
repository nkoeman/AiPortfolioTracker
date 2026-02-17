import { prisma } from "@/lib/prisma";
import type { TransactionType } from "@prisma/client";

const EXTERNAL_TYPES: TransactionType[] = ["DEPOSIT", "WITHDRAWAL", "CASH_TRANSFER", "TRADE"];

type ExternalTransaction = {
  type: "DEPOSIT" | "WITHDRAWAL" | "CASH_TRANSFER" | "TRADE";
  tradeAt: Date;
  valueEur: number | null;
  totalEur: number | null;
};

function toNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeExternalAmount(row: ExternalTransaction) {
  if (row.type === "TRADE") {
    const tradeRaw = toNumber(row.totalEur ?? row.valueEur);
    return tradeRaw ?? 0;
  }

  const raw = toNumber(row.valueEur ?? row.totalEur);
  if (raw === null) return 0;
  const absValue = Math.abs(raw);
  if (row.type === "DEPOSIT") return -absValue;
  if (row.type === "WITHDRAWAL") return absValue;
  // CASH_TRANSFER uses sign if present; otherwise treat as neutral.
  return raw;
}

// Returns net external cash flow between (startDateExclusive, endDateInclusive].
// Sign convention: negative = investment (cash in), positive = withdrawal (cash out).
export async function getNetExternalCashFlow(
  userId: string,
  startDateExclusive: Date,
  endDateInclusive: Date
): Promise<number> {
  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      type: { in: EXTERNAL_TYPES },
      tradeAt: {
        gt: startDateExclusive,
        lte: endDateInclusive
      }
    },
    select: {
      type: true,
      tradeAt: true,
      valueEur: true,
      totalEur: true
    }
  });

  return rows.reduce((sum, row) => sum + normalizeExternalAmount(row as ExternalTransaction), 0);
}

export type ExternalFlowPoint = {
  date: Date;
  amountEur: number;
};

// Returns day-bucketed external cash flows within [startDate, endDate].
// Sign convention: negative = investment (cash in), positive = withdrawal (cash out).
export async function getExternalCashFlowSeries(
  userId: string,
  startDateInclusive: Date,
  endDateInclusive: Date
): Promise<ExternalFlowPoint[]> {
  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      type: { in: EXTERNAL_TYPES },
      tradeAt: {
        gte: startDateInclusive,
        lte: endDateInclusive
      }
    },
    select: {
      type: true,
      tradeAt: true,
      valueEur: true,
      totalEur: true
    },
    orderBy: { tradeAt: "asc" }
  });

  const byDate = new Map<string, ExternalFlowPoint>();
  for (const row of rows) {
    const date = new Date(`${row.tradeAt.toISOString().slice(0, 10)}T00:00:00.000Z`);
    const key = date.toISOString().slice(0, 10);
    const existing = byDate.get(key) || { date, amountEur: 0 };
    existing.amountEur += normalizeExternalAmount(row as ExternalTransaction);
    byDate.set(key, existing);
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
}
