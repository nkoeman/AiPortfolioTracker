import { describe, expect, it } from "vitest";
import { finalizeExposure } from "@/lib/etf/exposure/finalizeExposure";
import { __testables } from "@/lib/etf/exposure/finalizeExposure";

describe("finalizeExposure", () => {
  it("applies single-country inference when country is missing and inference is unambiguous", () => {
    const result = finalizeExposure({
      rawCountry: [],
      rawSector: [{ name: "Information Technology", weight: 30 }],
      fallbackInput: {
        displayName: "AEX UCITS ETF",
        indexName: "AEX"
      },
      instrumentId: "inst_1"
    });

    expect(result.payload.country).toEqual([{ country: "Netherlands", weight: 1 }]);
    expect(result.sourceMeta.countryRegionInference).toMatchObject({
      applied: true,
      source: "INDEX_MAP"
    });
  });

  it("does not override valid extracted country exposure", () => {
    const result = finalizeExposure({
      rawCountry: [
        { name: "United States", weight: 60 },
        { name: "Japan", weight: 25 },
        { name: "United Kingdom", weight: 15 }
      ],
      rawSector: [{ name: "Information Technology", weight: 30 }],
      fallbackInput: {
        displayName: "AEX UCITS ETF",
        indexName: "AEX"
      },
      instrumentId: "inst_2"
    });

    expect(result.payload.country.length).toBe(3);
    expect(result.payload.country[0].country).toBe("United States");
    expect(result.sourceMeta.countryRegionInference).toMatchObject({
      applied: false
    });
  });

  it("interprets percent strings below 1.5 correctly", () => {
    expect(__testables.toWeight("0.56%")).toBeCloseTo(0.0056, 8);
    expect(__testables.toWeight("1.25%")).toBeCloseTo(0.0125, 8);
  });

  it("preserves scraped label order and duplicates", () => {
    const result = finalizeExposure({
      rawCountry: [
        { name: "  United States  ", weight: 60 },
        { name: "Japan", weight: 25 },
        { name: "United States", weight: 15 }
      ],
      rawSector: [
        { name: "Financials", weight: 30 },
        { name: "Information Technology", weight: 20 }
      ],
      instrumentId: "inst_3"
    });

    expect(result.payload.country).toEqual([
      { country: "  United States  ", weight: 0.6 },
      { country: "Japan", weight: 0.25 },
      { country: "United States", weight: 0.15 }
    ]);
    expect(result.payload.sector).toEqual([
      { sector: "Financials", weight: 0.3 },
      { sector: "Information Technology", weight: 0.2 }
    ]);
  });
});
