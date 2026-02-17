import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fxFindFirst: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    fxRate: {
      findFirst: mocks.fxFindFirst
    }
  }
}));

import { getFxRateForWeek } from "@/lib/fx/convert";

describe("FX conversion utility", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.fxFindFirst.mockReset();
  });

  it("returns 1 for EUR reporting currency", async () => {
    await expect(getFxRateForWeek(new Date("2026-01-03T00:00:00.000Z"), "EUR")).resolves.toBe(1);
    expect(mocks.fxFindFirst).not.toHaveBeenCalled();
  });

  it("inverts ECB EUR->quote rates into quote->EUR multipliers", async () => {
    mocks.fxFindFirst.mockResolvedValue({
      weekEndDate: new Date("2026-01-03T00:00:00.000Z"),
      observedDate: new Date("2026-01-02T00:00:00.000Z"),
      rate: 1.25
    });

    await expect(getFxRateForWeek(new Date("2026-01-03T00:00:00.000Z"), "USD")).resolves.toBeCloseTo(0.8, 8);
    expect(mocks.fxFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          base: "EUR",
          quote: "USD"
        })
      })
    );
  });
});
