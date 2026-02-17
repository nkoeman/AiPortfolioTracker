import { describe, expect, it } from "vitest";
import { AssetClass, AssetType, Region, Instrument } from "@prisma/client";
import { buildInstrumentProfileFromRules } from "@/lib/enrichment/rules";

function makeInstrument(overrides: Partial<Instrument>): Instrument {
  return {
    id: "inst_1",
    isin: "ISIN123",
    name: "Test Instrument",
    displayName: null,
    figi: null,
    figiComposite: null,
    securityType: null,
    securityType2: null,
    marketSector: null,
    assetClass: null,
    issuer: null,
    countryOfRisk: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides
  };
}

describe("instrument enrichment rules", () => {
  it("classifies MSCI World UCITS ETF as global equity ETF", () => {
    const instrument = makeInstrument({
      name: "iShares Core MSCI World UCITS ETF",
      securityType2: "ETF"
    });

    const result = buildInstrumentProfileFromRules(instrument).profilePatch;
    expect(result.assetType).toBe(AssetType.ETF);
    expect(result.assetClass).toBe(AssetClass.EQUITY);
    expect(result.region).toBe(Region.GLOBAL);
    expect(result.trackedIndexName).toBe("MSCI World");
  });

  it("detects FTSE All-World for Vanguard ETF", () => {
    const instrument = makeInstrument({
      name: "Vanguard FTSE All-World UCITS ETF",
      securityType2: "ETF"
    });

    const result = buildInstrumentProfileFromRules(instrument).profilePatch;
    expect(result.region).toBe(Region.GLOBAL);
    expect(result.trackedIndexName).toBe("FTSE All-World");
  });

  it("detects S&P 500 for US equity ETFs", () => {
    const instrument = makeInstrument({
      name: "iShares Core S&P 500 UCITS ETF",
      securityType2: "ETF"
    });

    const result = buildInstrumentProfileFromRules(instrument).profilePatch;
    expect(result.region).toBe(Region.US);
    expect(result.trackedIndexName).toBe("S&P 500");
  });

  it("marks FX hedged ETFs", () => {
    const instrument = makeInstrument({
      name: "iShares Core MSCI World EUR Hedged UCITS ETF",
      securityType2: "ETF"
    });

    const result = buildInstrumentProfileFromRules(instrument).profilePatch;
    expect(result.fxHedged).toBe(true);
  });

  it("classifies bond ETFs as bond asset class", () => {
    const instrument = makeInstrument({
      name: "iShares Core Global Aggregate Bond UCITS ETF",
      securityType2: "ETF"
    });

    const result = buildInstrumentProfileFromRules(instrument).profilePatch;
    expect(result.assetClass).toBe(AssetClass.BOND);
  });
});
