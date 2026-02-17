import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transactionFindMany: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    transaction: {
      findMany: mocks.transactionFindMany
    }
  }
}));

import { getExternalCashFlowSeries, getNetExternalCashFlow } from "@/lib/portfolio/getNetExternalCashFlow";

describe("getNetExternalCashFlow", () => {
  beforeEach(() => {
    mocks.transactionFindMany.mockReset().mockResolvedValue([]);
  });

  it("treats TRADE as external flow using signed amount", async () => {
    mocks.transactionFindMany.mockResolvedValue([
      {
        type: "TRADE",
        tradeAt: new Date("2026-02-01T10:00:00.000Z"),
        valueEur: null,
        totalEur: -100
      },
      {
        type: "TRADE",
        tradeAt: new Date("2026-02-02T10:00:00.000Z"),
        valueEur: null,
        totalEur: 120
      },
      {
        type: "DEPOSIT",
        tradeAt: new Date("2026-02-02T10:00:00.000Z"),
        valueEur: 50,
        totalEur: null
      },
      {
        type: "WITHDRAWAL",
        tradeAt: new Date("2026-02-03T10:00:00.000Z"),
        valueEur: 20,
        totalEur: null
      }
    ]);

    const result = await getNetExternalCashFlow(
      "user_1",
      new Date("2026-01-31T00:00:00.000Z"),
      new Date("2026-02-03T23:59:59.000Z")
    );

    expect(result).toBe(-10);
  });
});

describe("getExternalCashFlowSeries", () => {
  beforeEach(() => {
    mocks.transactionFindMany.mockReset().mockResolvedValue([]);
  });

  it("buckets TRADE flows by date", async () => {
    mocks.transactionFindMany.mockResolvedValue([
      {
        type: "TRADE",
        tradeAt: new Date("2026-02-01T10:00:00.000Z"),
        valueEur: null,
        totalEur: -100
      },
      {
        type: "TRADE",
        tradeAt: new Date("2026-02-01T15:00:00.000Z"),
        valueEur: null,
        totalEur: 40
      }
    ]);

    const result = await getExternalCashFlowSeries(
      "user_1",
      new Date("2026-02-01T00:00:00.000Z"),
      new Date("2026-02-01T23:59:59.000Z")
    );

    expect(result).toHaveLength(1);
    expect(result[0].amountEur).toBe(-60);
    expect(result[0].date.toISOString().slice(0, 10)).toBe("2026-02-01");
  });
});
