import { describe, expect, it } from "vitest";
import {
  computeWindowChange,
  rankContributors,
  selectRecentWeeks,
  RecentPerformanceContributor,
  RecentPerformancePoint
} from "@/lib/dashboard/recentPerformance";

describe("recent performance helpers", () => {
  it("selects the latest 4 weeks in ascending order", () => {
    const weeks: RecentPerformancePoint[] = [
      { weekEndDate: new Date("2026-01-03"), valueEur: 100 },
      { weekEndDate: new Date("2026-01-10"), valueEur: 102 },
      { weekEndDate: new Date("2026-01-17"), valueEur: 98 },
      { weekEndDate: new Date("2026-01-24"), valueEur: 110 },
      { weekEndDate: new Date("2026-01-31"), valueEur: 115 }
    ];

    const selected = selectRecentWeeks(weeks, 4);

    expect(selected).toHaveLength(4);
    expect(selected[0].weekEndDate.toISOString().slice(0, 10)).toBe("2026-01-10");
    expect(selected[3].weekEndDate.toISOString().slice(0, 10)).toBe("2026-01-31");
  });

  it("computes change and percent for the window", () => {
    const weeks: RecentPerformancePoint[] = [
      { weekEndDate: new Date("2026-01-10"), valueEur: 100 },
      { weekEndDate: new Date("2026-01-31"), valueEur: 90 }
    ];

    const result = computeWindowChange(weeks);

    expect(result.startValueEur).toBe(100);
    expect(result.endValueEur).toBe(90);
    expect(result.changeEur).toBe(-10);
    expect(result.changePct).toBeCloseTo(-0.1, 6);
  });

  it("guards against divide-by-zero when computing percent", () => {
    const weeks: RecentPerformancePoint[] = [
      { weekEndDate: new Date("2026-01-10"), valueEur: 0 },
      { weekEndDate: new Date("2026-01-31"), valueEur: 10 }
    ];

    const result = computeWindowChange(weeks);

    expect(result.changeEur).toBe(10);
    expect(result.changePct).toBeNull();
  });

  it("ranks contributors by positive and negative contribution", () => {
    const rows: RecentPerformanceContributor[] = [
      { instrumentId: "a", isin: "ISIN-A", instrumentName: "A", contributionEur: 50, contributionPctOfMove: null, localReturnPct: null },
      { instrumentId: "b", isin: "ISIN-B", instrumentName: "B", contributionEur: -30, contributionPctOfMove: null, localReturnPct: null },
      { instrumentId: "c", isin: "ISIN-C", instrumentName: "C", contributionEur: 70, contributionPctOfMove: null, localReturnPct: null },
      { instrumentId: "d", isin: "ISIN-D", instrumentName: "D", contributionEur: -80, contributionPctOfMove: null, localReturnPct: null },
      { instrumentId: "e", isin: "ISIN-E", instrumentName: "E", contributionEur: 20, contributionPctOfMove: null, localReturnPct: null },
      { instrumentId: "f", isin: "ISIN-F", instrumentName: "F", contributionEur: -10, contributionPctOfMove: null, localReturnPct: null }
    ];

    const ranked = rankContributors(rows);

    expect(ranked.topGainers[0].instrumentId).toBe("c");
    expect(ranked.topLosers[0].instrumentId).toBe("d");
  });
});
