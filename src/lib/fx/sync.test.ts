import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchEcbFxSeries: vi.fn(),
  listingFindMany: vi.fn(),
  priceFindMany: vi.fn(),
  fxFindMany: vi.fn(),
  fxUpsert: vi.fn()
}));

vi.mock("@/lib/ecb/client", () => ({
  fetchEcbFxSeries: mocks.fetchEcbFxSeries
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    instrumentListing: {
      findMany: mocks.listingFindMany
    },
    price: {
      findMany: mocks.priceFindMany
    },
    fxRate: {
      findMany: mocks.fxFindMany,
      upsert: mocks.fxUpsert
    }
  }
}));

import { __testables, syncWeeklyFxRates } from "@/lib/fx/sync";

describe("weekly FX sync", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.fetchEcbFxSeries.mockReset();
    mocks.listingFindMany.mockReset();
    mocks.priceFindMany.mockReset();
    mocks.fxFindMany.mockReset().mockResolvedValue([]);
    mocks.fxUpsert.mockReset().mockResolvedValue({});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("selects the nearest prior daily observation when week date is missing", () => {
    const selected = __testables.findObservationOnOrBefore(
      [
        { date: "2026-01-01", rate: 1.1 },
        { date: "2026-01-02", rate: 1.2 }
      ],
      "2026-01-03"
    );

    expect(selected).toEqual({ date: "2026-01-02", rate: 1.2 });
  });

  it("upserts weekly FX rows using fallback observedDate when needed", async () => {
    mocks.fetchEcbFxSeries.mockResolvedValue([
      { date: "2026-01-02", rate: 1.25 },
      { date: "2026-01-09", rate: 1.3 }
    ]);

    await syncWeeklyFxRates(
      [new Date("2026-01-03T00:00:00.000Z"), new Date("2026-01-10T00:00:00.000Z")],
      ["USD"]
    );

    expect(mocks.fetchEcbFxSeries).toHaveBeenCalledWith("USD", "2025-12-27", "2026-01-10");
    expect(mocks.fxUpsert).toHaveBeenCalledTimes(2);
    expect(mocks.fxUpsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        create: expect.objectContaining({
          quote: "USD",
          rate: 1.25,
          observedDate: new Date("2026-01-02T00:00:00.000Z")
        })
      })
    );
  });
});
