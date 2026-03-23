import { describe, expect, it } from "vitest";
import { modifiedDietzReturn } from "@/lib/performance/dietz";

describe("modifiedDietzReturn", () => {
  it("computes first-period seeding return using start-of-period funding assumption", () => {
    const result = modifiedDietzReturn({
      startValueEur: 0,
      endValueEur: 899.72982709,
      cashFlows: [{ amountEur: 859.38 }],
      periodStart: new Date("2026-02-01T00:00:00.000Z"),
      periodEnd: new Date("2026-02-01T00:00:00.000Z"),
      timingAssumption: "START_OF_DAY"
    });

    expect(result).not.toBeNull();
    const expectedReturn = 899.72982709 / 859.38 - 1;
    expect(result as number).toBeCloseTo(expectedReturn, 10);
    const seededIndex = 100 * (1 + (result as number));
    expect(seededIndex).toBeCloseTo((899.72982709 / 859.38) * 100, 6);
  });

  it("returns null when denominator is zero (A=0 and no weighted flows)", () => {
    const result = modifiedDietzReturn({
      startValueEur: 0,
      endValueEur: 100,
      cashFlows: [],
      periodStart: new Date("2026-02-01T00:00:00.000Z"),
      periodEnd: new Date("2026-02-01T00:00:00.000Z"),
      timingAssumption: "END_OF_DAY"
    });

    expect(result).toBeNull();
  });

  it("uses deterministic weights for multiple first-period flows without timestamps", () => {
    const result = modifiedDietzReturn({
      startValueEur: 0,
      endValueEur: 120,
      cashFlows: [{ amountEur: 60 }, { amountEur: 40 }],
      periodStart: new Date("2026-02-01T00:00:00.000Z"),
      periodEnd: new Date("2026-02-01T00:00:00.000Z"),
      timingAssumption: "START_OF_DAY"
    });

    expect(result).not.toBeNull();
    expect(result as number).toBeCloseTo(0.2, 8);
  });
});
