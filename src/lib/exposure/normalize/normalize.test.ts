import { describe, expect, it } from "vitest";
import {
  countryToRegion,
  normalizeCountryLabelToIso2,
  normalizeSectorLabelToGics11
} from "@/lib/exposure/normalize";

describe("exposure normalization mappings", () => {
  it.each([
    ["Basic Materials", "MATERIALS"],
    ["Cash and/or Derivatives", "CASH"],
    ["Communication", "COMMUNICATION_SERVICES"],
    ["Communication Services", "COMMUNICATION_SERVICES"],
    ["Consumer Discretionary", "CONSUMER_DISCRETIONARY"],
    ["Consumer Staples", "CONSUMER_STAPLES"],
    ["Energy", "ENERGY"],
    ["Financials", "FINANCIALS"],
    ["Health Care", "HEALTH_CARE"],
    ["Industrials", "INDUSTRIALS"],
    ["Information Technology", "INFORMATION_TECHNOLOGY"],
    ["Materials", "MATERIALS"],
    ["Other", "OTHER"],
    ["Other/Cash", "CASH"],
    ["Real Estate", "REAL_ESTATE"],
    ["Technology", "INFORMATION_TECHNOLOGY"],
    ["Telecommunications", "COMMUNICATION_SERVICES"],
    ["Unassigned", "UNASSIGNED"],
    ["Utilities", "UTILITIES"]
  ])("maps sector label %s to %s", (label, expected) => {
    expect(normalizeSectorLabelToGics11(label).key).toBe(expected);
  });

  it.each([
    ["US", "US"],
    ["USA", "US"],
    ["U.S.", "US"],
    ["United States", "US"],
    ["UK", "GB"],
    ["U.K.", "GB"],
    ["United Kingdom", "GB"],
    ["Japan", "JP"],
    ["Korea (South)", "KR"],
    ["Netherlands", "NL"],
    ["Panama", "PA"],
    ["Cash", "CASH"],
    ["Other/Cash", "CASH"]
  ])("maps country label %s to %s", (label, expected) => {
    expect(normalizeCountryLabelToIso2(label).key).toBe(expected);
  });

  it("maps PA country key to LATIN_AMERICA region", () => {
    expect(countryToRegion("PA")).toBe("LATIN_AMERICA");
  });
});
