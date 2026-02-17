import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  getHistoricalAdjustedClose: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    dailyListingPrice: {
      upsert: mocks.upsert
    },
    $transaction: async (ops: Array<Promise<unknown>>) => Promise.all(ops)
  }
}));

vi.mock("@/lib/eodhd/client", () => ({
  eodhdClient: {
    getHistoricalAdjustedClose: mocks.getHistoricalAdjustedClose
  }
}));

import { fetchDailyPricesForListing } from "@/lib/prices/fetchDailyAdjustedClose";

describe("daily price fetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.upsert.mockReset().mockImplementation(async (args) => args);
    mocks.getHistoricalAdjustedClose.mockReset();
  });

  it("upserts daily adjusted close points per listing and date", async () => {
    mocks.getHistoricalAdjustedClose.mockResolvedValue([
      { date: "2026-02-10", adjClose: 100.5 },
      { date: "2026-02-11", adjClose: 101.75, close: 102.05 }
    ]);

    const listing = { id: "lst_1", eodhdCode: "TEST.AS", currency: "EUR" };
    const from = new Date("2026-02-10T00:00:00.000Z");
    const to = new Date("2026-02-11T00:00:00.000Z");

    const count = await fetchDailyPricesForListing(listing, from, to);

    expect(count).toBe(2);
    expect(mocks.upsert).toHaveBeenCalledTimes(2);
    const first = mocks.upsert.mock.calls[0][0];
    expect(first.where.listingId_date.listingId).toBe("lst_1");
    expect(first.where.listingId_date.date.toISOString()).toContain("2026-02-10");
    expect(first.create.adjustedClose).toBe(100.5);
    const second = mocks.upsert.mock.calls[1][0];
    expect(second.create.close).toBe(102.05);
  });
});
