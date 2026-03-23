import { describe, expect, it } from "vitest";
import { buildPortfolioExposureResponse } from "@/lib/exposure/portfolioExposure";

function sumSlices(rows: Array<{ value: number }>) {
  return rows.reduce((total, row) => total + row.value, 0);
}

function findValue(rows: Array<{ key: string; value: number }>, key: string) {
  return rows.find((row) => row.key === key)?.value ?? 0;
}

describe("buildPortfolioExposureResponse", () => {
  it("aggregates country, sector, region, and development exposure from portfolio weights", () => {
    const result = buildPortfolioExposureResponse(
      [
        {
          instrumentId: "instrument_a",
          portfolioWeight: 0.6,
          countryRows: [{ key: "US", weight: 1 }],
          sectorRows: [
            { key: "INFORMATION_TECHNOLOGY", weight: 0.5 },
            { key: "FINANCIALS", weight: 0.5 }
          ]
        },
        {
          instrumentId: "instrument_b",
          portfolioWeight: 0.4,
          countryRows: [{ key: "JP", weight: 1 }],
          sectorRows: [{ key: "INFORMATION_TECHNOLOGY", weight: 1 }]
        }
      ],
      new Date("2026-02-27T00:00:00.000Z")
    );

    expect(findValue(result.charts.country, "US")).toBeCloseTo(0.6, 8);
    expect(findValue(result.charts.country, "JP")).toBeCloseTo(0.4, 8);
    expect(findValue(result.charts.sector, "INFORMATION_TECHNOLOGY")).toBeCloseTo(0.7, 8);
    expect(findValue(result.charts.sector, "FINANCIALS")).toBeCloseTo(0.3, 8);
    expect(findValue(result.charts.region, "NORTH_AMERICA")).toBeCloseTo(0.6, 8);
    expect(findValue(result.charts.region, "ASIA")).toBeCloseTo(0.4, 8);
    expect(findValue(result.charts.development, "DEVELOPED")).toBeCloseTo(1, 8);
    expect(sumSlices(result.charts.country)).toBeCloseTo(1, 8);
    expect(sumSlices(result.charts.sector)).toBeCloseTo(1, 8);
    expect(sumSlices(result.charts.region)).toBeCloseTo(1, 8);
    expect(sumSlices(result.charts.development)).toBeCloseTo(1, 8);
  });

  it("adds a no-data slice when an instrument has no exposure snapshot", () => {
    const result = buildPortfolioExposureResponse(
      [
        {
          instrumentId: "instrument_a",
          portfolioWeight: 0.75,
          countryRows: [{ key: "US", weight: 1 }],
          sectorRows: [{ key: "INFORMATION_TECHNOLOGY", weight: 1 }]
        },
        {
          instrumentId: "instrument_b",
          portfolioWeight: 0.25,
          countryRows: [],
          sectorRows: []
        }
      ],
      new Date("2026-02-27T00:00:00.000Z")
    );

    expect(result.coverage).toBeCloseTo(0.75, 8);
    expect(result.chartMeta.country.coverage).toBeCloseTo(0.75, 8);
    expect(result.chartMeta.country.noData).toBeCloseTo(0.25, 8);
    expect(findValue(result.charts.country, "NO_DATA")).toBeCloseTo(0.25, 8);
    expect(findValue(result.charts.sector, "NO_DATA")).toBeCloseTo(0.25, 8);
    expect(sumSlices(result.charts.country)).toBeCloseTo(1, 8);
    expect(sumSlices(result.charts.sector)).toBeCloseTo(1, 8);
  });
});
