import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureEodhdExchangeDirectoryLoaded: vi.fn(),
  resolveOrCreateListingForTransaction: vi.fn(),
  syncDailyPricesForUser: vi.fn(),
  ensureWeeklyFxRates: vi.fn(),
  refreshDailyPortfolioValuesForUser: vi.fn(),
  transactionFindFirst: vi.fn(),
  transactionFindMany: vi.fn(),
  transactionUpdateMany: vi.fn()
}));

vi.mock("@/lib/eodhd/exchanges", () => ({
  ensureEodhdExchangeDirectoryLoaded: mocks.ensureEodhdExchangeDirectoryLoaded
}));

vi.mock("@/lib/eodhd/mapping", () => ({
  resolveOrCreateListingForTransaction: mocks.resolveOrCreateListingForTransaction
}));

vi.mock("@/lib/prices/syncDailyPrices", () => ({
  syncDailyPricesForUser: mocks.syncDailyPricesForUser
}));

vi.mock("@/lib/fx/sync", () => ({
  ensureWeeklyFxRates: mocks.ensureWeeklyFxRates
}));

vi.mock("@/lib/valuation/dailyPortfolioValue", () => ({
  refreshDailyPortfolioValuesForUser: mocks.refreshDailyPortfolioValuesForUser
}));


vi.mock("@/lib/prisma", () => ({
  prisma: {
    transaction: {
      findFirst: mocks.transactionFindFirst,
      findMany: mocks.transactionFindMany,
      updateMany: mocks.transactionUpdateMany
    }
  }
}));

import { syncFullForUser, syncLast4WeeksForUser } from "@/lib/prices/sync";

describe("sync pipeline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-16T12:00:00.000Z"));
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    mocks.ensureEodhdExchangeDirectoryLoaded.mockReset().mockResolvedValue({});
    mocks.resolveOrCreateListingForTransaction.mockReset().mockResolvedValue(null);
    mocks.syncDailyPricesForUser.mockReset().mockResolvedValue({
      listingCount: 2,
      pricePoints: 50,
      fromDate: new Date("2026-01-01T00:00:00.000Z"),
      toDate: new Date("2026-02-16T00:00:00.000Z")
    });
    mocks.ensureWeeklyFxRates.mockReset().mockResolvedValue({});
    mocks.refreshDailyPortfolioValuesForUser.mockReset().mockResolvedValue({
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-02-16T00:00:00.000Z"),
      points: [{ date: new Date("2026-01-01T00:00:00.000Z"), valueEur: 100 }],
      lastUpdatedAt: new Date("2026-02-16T00:00:00.000Z")
    });
    mocks.transactionFindMany.mockReset().mockResolvedValue([]);
    mocks.transactionUpdateMany.mockReset().mockResolvedValue({ count: 0 });
    mocks.transactionFindFirst.mockReset().mockResolvedValue({
      tradeAt: new Date("2020-03-13T18:35:00.000Z")
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("full sync runs prices -> daily pipeline in order", async () => {
    const callOrder: string[] = [];
    mocks.syncDailyPricesForUser.mockImplementation(async (...args) => {
      callOrder.push("prices");
      return {
        listingCount: 2,
        pricePoints: 50,
        fromDate: args[1],
        toDate: args[2]
      };
    });
    mocks.refreshDailyPortfolioValuesForUser.mockImplementation(async () => {
      callOrder.push("daily");
      return {
        startDate: new Date("2020-03-13T00:00:00.000Z"),
        endDate: new Date("2026-02-16T00:00:00.000Z"),
        points: [{ date: new Date("2020-03-13T00:00:00.000Z"), valueEur: 100 }],
        lastUpdatedAt: new Date("2026-02-16T00:00:00.000Z")
      };
    });

    const result = await syncFullForUser("user_1");

    expect(callOrder).toEqual(["prices", "daily"]);
    expect(result.mode).toBe("full");
    expect(result.fromDate.toISOString().slice(0, 10)).toBe("2020-03-13");
  });

  it("recent sync uses ~last 4 weeks range", async () => {
    const result = await syncLast4WeeksForUser("user_1");
    expect(result.mode).toBe("recent");
    expect(result.toDate.toISOString().slice(0, 10)).toBe("2026-02-16");
    expect(result.fromDate.toISOString().slice(0, 10)).toBe("2026-01-12");
    expect(mocks.syncDailyPricesForUser).toHaveBeenCalledWith(
      "user_1",
      new Date("2026-01-12T00:00:00.000Z"),
      new Date("2026-02-16T00:00:00.000Z")
    );
  });
});
