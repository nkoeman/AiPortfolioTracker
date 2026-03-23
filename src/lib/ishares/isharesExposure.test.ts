import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { __testables, parseIsharesFactsheetPdfBytes } from "@/lib/ishares/isharesExposure";

describe("parseIsharesFactsheetPdfBytes", () => {
  it("parses exposures and as-of date from fixture factsheet", async () => {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const fixturePath = path.resolve(currentDir, "__fixtures__", "sample-factsheet.pdf");
    const bytes = await fs.readFile(fixturePath);
    const parsed = await parseIsharesFactsheetPdfBytes(bytes);

    expect(parsed.asOfDate).toBeInstanceOf(Date);
    expect(parsed.payload.sector.length).toBeGreaterThan(0);
    expect(parsed.payload.country.length).toBeGreaterThan(0);
  });
});

describe("single-country fallback", () => {
  it("infers NL 100% for AEX ETF when country exposure is missing", () => {
    const input = {
      country: [],
      sector: [{ sector: "Financials", weight: 0.2 }]
    };
    const result = __testables.applySingleCountryFallback(input, {
      instrumentId: "inst_aex",
      displayName: "iShares AEX UCITS ETF"
    });

    expect(result.meta.applied).toBe(true);
    expect(result.payload.country).toEqual([{ country: "Netherlands", weight: 1 }]);
  });

  it("infers US 100% for S&P 500 ETF when country exposure is missing", () => {
    const input = {
      country: [],
      sector: [{ sector: "Information Technology", weight: 0.3 }]
    };
    const result = __testables.applySingleCountryFallback(input, {
      instrumentId: "inst_sp500",
      displayName: "iShares S&P 500 UCITS ETF"
    });

    expect(result.meta.applied).toBe(true);
    expect(result.payload.country).toEqual([{ country: "United States", weight: 1 }]);
  });

  it("does not infer for broad ETF names like MSCI World", () => {
    const input = {
      country: [],
      sector: [{ sector: "Information Technology", weight: 0.25 }]
    };
    const result = __testables.applySingleCountryFallback(input, {
      instrumentId: "inst_world",
      displayName: "iShares Core MSCI World UCITS ETF"
    });

    expect(result.meta.applied).toBe(false);
    expect(result.payload.country).toEqual([]);
  });

  it("keeps existing factsheet country exposure and does not overwrite", () => {
    const input = {
      country: [{ country: "United States", weight: 0.95 }],
      sector: [{ sector: "Information Technology", weight: 0.28 }]
    };
    const result = __testables.applySingleCountryFallback(input, {
      instrumentId: "inst_existing",
      displayName: "iShares AEX UCITS ETF"
    });

    expect(result.meta.applied).toBe(false);
    expect(result.payload.country).toEqual(input.country);
  });
});

describe("parseProductPageExposures", () => {
  it("keeps sector exposure even when country/region tables are absent", () => {
    const html = `
      <script>
        var tabsSectorDataTable = [
          {"name":"Information Technology","value":"31.40"},
          {"name":"Financials","value":"15.10"}
        ];
        var subTabsCountriesDataTable = [];
      </script>
    `;

    const parsed = __testables.parseProductPageExposures(html);
    expect(parsed).not.toBeNull();
    expect(parsed?.payload.sector.length).toBe(2);
    expect(parsed?.payload.country).toEqual([]);
  });
});

describe("parseIsharesFactsheetText", () => {
  it("parses sector rows when PDF text lines omit % symbol", () => {
    const text = `
      As at: 31-Jan-2026
      Information Technology 33.4%
      Financials 12.9
      Communication Services 11.0
      Consumer Discretionary 10.4
      Health Care 9.4
      Industrials 8.6
      Consumer Staples 5.0%
      Energy 3.2
      Utilities 2.2
      Materials 2.0
      Real Estate 1.9
    `;

    const parsed = __testables.parseIsharesFactsheetText(text);
    expect(parsed.payload.sector.length).toBeGreaterThanOrEqual(10);
    expect(parsed.payload.sector.find((row) => row.sector === "Information Technology")?.weight).toBeCloseTo(0.334, 6);
    expect(parsed.payload.sector.find((row) => row.sector === "Financials")?.weight).toBeCloseTo(0.129, 6);
  });

  it("parses sector rows when PDF text is collapsed into long lines", () => {
    const text = `
      Data as at 31 December 2025. Weighted exposureInformation Technology Information Technology 33.4%
      Financials 12.9 Communication Services 11.0 Consumer Discretionary 10.4 Health Care 9.4 Industrials 8.6
      Consumer Staples 5.0% Energy 3.2 Utilities 2.2 Materials 2.0 Real Estate 1.9
      Market allocationUnited States United States 100.0%
    `;

    const parsed = __testables.parseIsharesFactsheetText(text);
    expect(parsed.payload.sector.length).toBeGreaterThanOrEqual(10);
    expect(parsed.payload.sector.find((row) => row.sector.includes("Information Technology"))?.weight).toBeCloseTo(0.334, 6);
    expect(parsed.payload.sector.find((row) => row.sector === "Health Care")?.weight).toBeCloseTo(0.094, 6);
    expect(parsed.sourceMeta).toHaveProperty("sectorRegexFallback");
  });
});
