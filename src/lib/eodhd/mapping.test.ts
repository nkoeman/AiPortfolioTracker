import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureEodhdExchangeDirectoryLoaded: vi.fn(),
  resolveMicFromBeurs: vi.fn(),
  resolveEodhdExchangeFromMic: vi.fn(),
  searchByIsin: vi.fn(),
  upsert: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  eodhdExchangeFindMany: vi.fn()
}));

vi.mock("@/lib/eodhd/exchanges", () => ({
  ensureEodhdExchangeDirectoryLoaded: mocks.ensureEodhdExchangeDirectoryLoaded
}));

vi.mock("@/lib/brokers/degiro/beursToMic", () => ({
  resolveMicFromBeurs: mocks.resolveMicFromBeurs
}));

vi.mock("@/lib/exchange/micToEodhdExchange", () => ({
  resolveEodhdExchangeFromMic: mocks.resolveEodhdExchangeFromMic
}));

vi.mock("@/lib/eodhd/client", () => ({
  eodhdClient: {
    searchByIsin: mocks.searchByIsin
  }
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    instrumentListing: {
      upsert: mocks.upsert,
      findFirst: mocks.findFirst,
      update: mocks.update
    },
    eodhdExchange: {
      findMany: mocks.eodhdExchangeFindMany
    }
  }
}));

import { __testables, resolveOrCreateListingForTransaction } from "@/lib/eodhd/mapping";

describe("MIC-first mapping", () => {
  beforeEach(() => {
    mocks.ensureEodhdExchangeDirectoryLoaded.mockReset().mockResolvedValue({ cachedCount: 1, refreshed: false });
    mocks.resolveMicFromBeurs.mockReset();
    mocks.resolveEodhdExchangeFromMic.mockReset();
    mocks.searchByIsin.mockReset();
    mocks.upsert.mockReset();
    mocks.findFirst.mockReset().mockResolvedValue(null);
    mocks.update.mockReset();
    mocks.eodhdExchangeFindMany.mockReset().mockResolvedValue([]);
  });

  it("selects only candidates with the expected exchange suffix", () => {
    const exchangeDirectory = __testables.buildExchangeDirectoryMap([
      { code: "AS", country: "NL", currency: "EUR" },
      { code: "DE", country: "DE", currency: "EUR" }
    ]);

    const result = __testables.selectBestEodhdCandidate({
      candidates: [
        { eodhdCode: "IMAE.DE", exchangeName: "Xetra", exchangeCode: "DE", currency: "EUR" },
        { eodhdCode: "IMAE.AS", exchangeName: "Amsterdam", exchangeCode: "AS", currency: "EUR" }
      ],
      expectedSuffix: "AS",
      listingCountry: "NL",
      listingCurrency: "EUR",
      exchangeDirectory
    });

    expect(result.candidate?.eodhdCode).toBe("IMAE.AS");
    expect(result.reason).toBe("EXACT");
  });

  it("falls back to country match when no suffix matches", () => {
    const exchangeDirectory = __testables.buildExchangeDirectoryMap([
      { code: "AS", country: "NL", currency: "EUR" },
      { code: "EU", country: "NL", currency: "EUR" },
      { code: "US", country: "US", currency: "USD" }
    ]);

    const result = __testables.selectBestEodhdCandidate({
      candidates: [
        { eodhdCode: "ABC.EU", exchangeName: "Europe", exchangeCode: "EU", currency: "EUR" },
        { eodhdCode: "ABC.US", exchangeName: "NYSE", exchangeCode: "US", currency: "USD" }
      ],
      expectedSuffix: "AS",
      listingCountry: "NL",
      listingCurrency: "EUR",
      exchangeDirectory
    });

    expect(result.candidate?.eodhdCode).toBe("ABC.EU");
    expect(result.reason).toBe("COUNTRY");
  });

  it("falls back to currency match when no suffix or country matches", () => {
    const exchangeDirectory = __testables.buildExchangeDirectoryMap([
      { code: "US", country: "US", currency: "USD" },
      { code: "EU", country: null, currency: null }
    ]);

    const result = __testables.selectBestEodhdCandidate({
      candidates: [
        { eodhdCode: "ABC.US", exchangeName: "NYSE", exchangeCode: "US", currency: "USD" },
        { eodhdCode: "ABC.EU", exchangeName: "Europe", exchangeCode: "EU", currency: "EUR" }
      ],
      expectedSuffix: "AS",
      listingCountry: null,
      listingCurrency: "EUR",
      exchangeDirectory
    });

    expect(result.candidate?.eodhdCode).toBe("ABC.EU");
    expect(result.reason).toBe("CURRENCY");
  });

  it("uses tie-breakers for multiple country matches", () => {
    const exchangeDirectory = __testables.buildExchangeDirectoryMap([
      { code: "EU", country: "NL", currency: "EUR" },
      { code: "NL", country: "NL", currency: "EUR" },
      { code: "AS", country: "NL", currency: "EUR" }
    ]);

    const result = __testables.selectBestEodhdCandidate({
      candidates: [
        { eodhdCode: "AAA.EU", exchangeName: "Europe", exchangeCode: "EU", currency: null },
        { eodhdCode: "AAA.NL", exchangeName: "Local", exchangeCode: "NL", currency: "EUR" }
      ],
      expectedSuffix: "AS",
      listingCountry: "NL",
      listingCurrency: "EUR",
      exchangeDirectory
    });

    expect(result.candidate?.eodhdCode).toBe("AAA.NL");
    expect(result.reason).toBe("COUNTRY");
  });

  it("uses deterministic ordering for multiple currency matches", () => {
    const exchangeDirectory = __testables.buildExchangeDirectoryMap([
      { code: "EU", country: "NL", currency: "EUR" }
    ]);

    const result = __testables.selectBestEodhdCandidate({
      candidates: [
        { eodhdCode: "BBB.EU", exchangeName: "Europe", exchangeCode: "EU", currency: "EUR" },
        { eodhdCode: "AAA.EU", exchangeName: "Europe", exchangeCode: "EU", currency: "EUR" }
      ],
      expectedSuffix: "AS",
      listingCountry: null,
      listingCurrency: "EUR",
      exchangeDirectory
    });

    expect(result.candidate?.eodhdCode).toBe("AAA.EU");
    expect(result.reason).toBe("CURRENCY");
  });

  it("returns null when no candidates exist", () => {
    const exchangeDirectory = __testables.buildExchangeDirectoryMap([]);
    const result = __testables.selectBestEodhdCandidate({
      candidates: [],
      expectedSuffix: "AS",
      listingCountry: "NL",
      listingCurrency: "EUR",
      exchangeDirectory
    });

    expect(result.candidate).toBeNull();
    expect(result.reason).toBe("NONE");
  });

  it("falls back deterministically when candidate data is sparse", () => {
    const exchangeDirectory = __testables.buildExchangeDirectoryMap([]);
    const result = __testables.selectBestEodhdCandidate({
      candidates: [
        { eodhdCode: "ZZZ", exchangeName: "Unknown", exchangeCode: "", currency: null },
        { eodhdCode: "AAA", exchangeName: "Unknown", exchangeCode: "", currency: null }
      ],
      expectedSuffix: "AS",
      listingCountry: null,
      listingCurrency: null,
      exchangeDirectory
    });

    expect(result.candidate?.eodhdCode).toBe("AAA");
    expect(result.reason).toBe("NONE");
  });

  it("marks mapping as FAILED when beurs->MIC lookup is missing", async () => {
    mocks.resolveMicFromBeurs.mockResolvedValue(null);
    mocks.resolveEodhdExchangeFromMic.mockResolvedValue(null);

    await expect(
      resolveOrCreateListingForTransaction({
        userId: "user_1",
        isin: "IE00B4L5Y983",
        productName: "Example ETF",
        degiroBeursCode: "EAM",
        transactionCurrency: "EUR"
      })
    ).resolves.toBeNull();

    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    const call = mocks.upsert.mock.calls[0][0];
    expect(call.update.mappingStatus).toBe("FAILED");
    expect(call.update.mappingError).toContain("No curated MIC mapping");
  });
});
