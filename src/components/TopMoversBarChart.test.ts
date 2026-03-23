import { describe, expect, it } from "vitest";
import type { RecentPerformanceContributor } from "@/lib/dashboard/recentPerformance";
import {
  buildTopMoversData,
  computeTopMoversDomain,
  computeTopMoversTicks
} from "@/components/TopMoversBarChart";

function contributor(
  instrumentId: string,
  contributionEur: number
): RecentPerformanceContributor {
  return {
    instrumentId,
    isin: `ISIN-${instrumentId}`,
    instrumentName: instrumentId,
    contributionEur,
    contributionPctOfMove: null,
    localReturnPct: null
  };
}

describe("TopMoversBarChart helpers", () => {
  it("builds signed EUR rows without normalization and sorted by side rules", () => {
    const rows = buildTopMoversData(
      [contributor("g2", 40), contributor("g1", 125)],
      [contributor("l1", -30), contributor("l2", -85)]
    );

    expect(rows.map((row) => row.name)).toEqual(["g1", "g2", "l1", "l2"]);
    expect(rows.map((row) => row.contributionEur)).toEqual([125, 40, -30, -85]);
    expect(rows.map((row) => row.side)).toEqual(["GAIN", "GAIN", "LOSS", "LOSS"]);
  });

  it("returns symmetric domain around largest absolute contribution", () => {
    const rows = buildTopMoversData([contributor("g1", 80)], [contributor("l1", -120)]);
    expect(computeTopMoversDomain(rows)).toEqual([-120, 120]);
  });

  it("always includes zero and consistent tick steps on x-axis", () => {
    const ticks = computeTopMoversTicks([-120, 120]);
    expect(ticks).toContain(0);
    expect(ticks).toEqual([-100, -50, 0, 50, 100]);
  });

  it("keeps positive values positive and negative values negative for chart direction", () => {
    const rows = buildTopMoversData([contributor("g1", 1)], [contributor("l1", -1)]);
    const positive = rows.find((row) => row.side === "GAIN");
    const negative = rows.find((row) => row.side === "LOSS");

    expect(positive?.contributionEur).toBeGreaterThan(0);
    expect(negative?.contributionEur).toBeLessThan(0);
  });
});
