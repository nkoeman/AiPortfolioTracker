import { describe, expect, it } from "vitest";
import { getWeeklySeriesFromDaily } from "@/lib/valuation/portfolioSeries";

describe("getWeeklySeriesFromDaily", () => {
  it("groups daily values by ISO week and picks the latest date in each week", () => {
    const result = getWeeklySeriesFromDaily([
      { date: new Date("2026-02-02T00:00:00.000Z"), valueEur: 100, partialValuation: false },
      { date: new Date("2026-02-03T00:00:00.000Z"), valueEur: 101, partialValuation: false },
      { date: new Date("2026-02-08T00:00:00.000Z"), valueEur: 105, partialValuation: true },
      { date: new Date("2026-02-09T00:00:00.000Z"), valueEur: 106, partialValuation: false }
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].weekEndDate.toISOString().slice(0, 10)).toBe("2026-02-08");
    expect(result[0].valueEur).toBe(105);
    expect(result[0].partialValuation).toBe(true);
    expect(result[1].weekEndDate.toISOString().slice(0, 10)).toBe("2026-02-09");
    expect(result[1].valueEur).toBe(106);
  });

  it("returns empty array when no values exist", () => {
    expect(getWeeklySeriesFromDaily([])).toEqual([]);
  });

  it("preserves Monday-only valuation points", () => {
    const result = getWeeklySeriesFromDaily([
      { date: new Date("2026-01-05T00:00:00.000Z"), valueEur: 100 },
      { date: new Date("2026-01-12T00:00:00.000Z"), valueEur: 105 }
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].weekEndDate.toISOString().slice(0, 10)).toBe("2026-01-05");
    expect(result[1].weekEndDate.toISOString().slice(0, 10)).toBe("2026-01-12");
  });
});
