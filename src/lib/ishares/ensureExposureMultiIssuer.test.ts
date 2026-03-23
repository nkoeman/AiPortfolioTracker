import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  instrumentFindMany: vi.fn(),
  snapshotUpsert: vi.fn(),
  resolveAdapterForInstrument: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    instrument: {
      findMany: mocks.instrumentFindMany
    },
    instrumentExposureSnapshot: {
      upsert: mocks.snapshotUpsert
    }
  }
}));

vi.mock("@/lib/etf/issuers/registry", () => ({
  resolveAdapterForInstrument: mocks.resolveAdapterForInstrument
}));

import { ensureIsharesExposureSnapshots } from "@/lib/ishares/ensureIsharesExposure";

describe("ensureIsharesExposureSnapshots (multi issuer routing)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-24T10:00:00.000Z"));
    process.env.ETF_EXPOSURE_TTL_DAYS = "30";
    mocks.instrumentFindMany.mockReset();
    mocks.snapshotUpsert.mockReset();
    mocks.resolveAdapterForInstrument.mockReset();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    { issuer: "VANGUARD", source: "VANGUARD" as const },
    { issuer: "SPDR", source: "SPDR" as const },
    { issuer: "COMGEST", source: "COMGEST" as const },
    { issuer: "VANECK", source: "VANECK" as const }
  ])("skips snapshot updated within 30 days for $issuer", async ({ issuer, source }) => {
    mocks.instrumentFindMany.mockResolvedValue([
      {
        id: "inst_1",
        isin: "IE00TEST0001",
        name: `${issuer} fund`,
        displayName: `${issuer} fund`,
        issuer,
        securityType: "ETF",
        securityType2: "ETF",
        marketSector: "Funds",
        listings: [],
        profile: { trackedIndexName: null },
        exposureSnapshots: [
          {
            source,
            status: "READY",
            expiresAt: new Date("2026-03-01T00:00:00.000Z"),
            updatedAt: new Date("2026-02-20T00:00:00.000Z"),
            sourceMeta: null,
            payload: { country: [{ country: "United States", weight: 1 }], sector: [{ sector: "Information Technology", weight: 0.3 }] }
          }
        ]
      }
    ]);

    mocks.resolveAdapterForInstrument.mockReturnValue({
      issuer,
      source,
      canHandleInstrument: () => true,
      resolveByIsin: vi.fn(),
      fetchExposure: vi.fn()
    });

    const result = await ensureIsharesExposureSnapshots({ userId: "user_1" });
    expect(result.skippedFresh).toBe(1);
    expect(result.attempted).toBe(0);
    expect(mocks.snapshotUpsert).not.toHaveBeenCalled();
  });

  it("supports issuer filtering via context.issuers", async () => {
    mocks.instrumentFindMany.mockResolvedValue([
      {
        id: "inst_1",
        isin: "IE00TEST0001",
        name: "VanEck ETF",
        displayName: "VanEck ETF",
        issuer: "VanEck",
        securityType: "ETF",
        securityType2: "ETF",
        marketSector: "Funds",
        listings: [],
        profile: { trackedIndexName: null },
        exposureSnapshots: []
      }
    ]);

    mocks.resolveAdapterForInstrument.mockReturnValue({
      issuer: "VANECK",
      source: "VANECK",
      canHandleInstrument: () => true,
      resolveByIsin: vi.fn().mockResolvedValue({
        issuer: "VANECK",
        isin: "IE00TEST0001",
        locale: "https://www.vaneck.com/nl/en",
        productUrl: "https://www.vaneck.com/nl/en/library/fact-sheets/test-fund.pdf",
        factsheetUrl: "https://www.vaneck.com/nl/en/library/fact-sheets/test-fund.pdf"
      }),
      fetchExposure: vi.fn().mockResolvedValue({
        asOfDate: new Date("2026-01-31T00:00:00.000Z"),
        payload: {
          country: [{ country: "US", weight: 1 }],
          sector: [{ sector: "Information Technology", weight: 0.3 }]
        },
        sourceMeta: { parsingMode: "PDF" }
      })
    });

    const result = await ensureIsharesExposureSnapshots({
      userId: "user_1",
      issuers: ["VANECK"]
    });

    expect(result.ready).toBe(1);
    expect(mocks.snapshotUpsert).toHaveBeenCalledTimes(1);
    expect(mocks.snapshotUpsert.mock.calls[0][0].where.instrumentId_source).toEqual({
      instrumentId: "inst_1",
      source: "VANECK"
    });
  });

  it("retries VANGUARD snapshot when it is older than 30 days", async () => {
    mocks.instrumentFindMany.mockResolvedValue([
      {
        id: "inst_1",
        isin: "IE00TEST0001",
        name: "Vanguard S&P 500 UCITS ETF",
        displayName: "Vanguard S&P 500 UCITS ETF",
        issuer: "Vanguard",
        securityType: "ETF",
        securityType2: "ETF",
        marketSector: "Funds",
        listings: [],
        profile: { trackedIndexName: "S&P 500" },
        exposureSnapshots: [
          {
            source: "VANGUARD",
            status: "READY",
            expiresAt: new Date("2026-03-01T00:00:00.000Z"),
            updatedAt: new Date("2025-12-20T00:00:00.000Z"),
            sourceMeta: { parsingMode: "PDF" },
            payload: { country: [{ country: "United States", weight: 1 }], sector: [] }
          }
        ]
      }
    ]);

    const resolveByIsin = vi.fn().mockResolvedValue({
      issuer: "VANGUARD",
      isin: "IE00TEST0001",
      locale: "https://www.vanguard.co.uk",
      productUrl: "https://www.vanguard.co.uk/professional/product/etf/equity/9503/vanguard-s-and-p-500-ucits-etf-usd-distributing",
      factsheetUrl: "https://fund-docs.vanguard.com/SandP_500_UCITS_ETF_USD_Distributing_9503_EU_INT_UK_EN.pdf"
    });
    const fetchExposure = vi.fn().mockResolvedValue({
      asOfDate: new Date("2026-01-31T00:00:00.000Z"),
      payload: {
        country: [{ country: "United States", weight: 1 }],
        sector: [{ sector: "Information Technology", weight: 0.334 }]
      },
      sourceMeta: { parsingMode: "PDF" }
    });

    mocks.resolveAdapterForInstrument.mockReturnValue({
      issuer: "VANGUARD",
      source: "VANGUARD",
      canHandleInstrument: () => true,
      resolveByIsin,
      fetchExposure
    });

    const result = await ensureIsharesExposureSnapshots({
      userId: "user_1",
      issuers: ["VANGUARD"]
    });

    expect(result.skippedFresh).toBe(0);
    expect(result.attempted).toBe(1);
    expect(resolveByIsin).toHaveBeenCalledTimes(1);
    expect(fetchExposure).toHaveBeenCalledTimes(1);
    expect(mocks.snapshotUpsert).toHaveBeenCalledTimes(1);
  });

  it("stores FAILED snapshot with short retry TTL for VanEck adapter errors", async () => {
    mocks.instrumentFindMany.mockResolvedValue([
      {
        id: "inst_1",
        isin: "IE00TEST0001",
        name: "VanEck ETF",
        displayName: "VanEck ETF",
        issuer: "VanEck",
        securityType: "ETF",
        securityType2: "ETF",
        marketSector: "Funds",
        listings: [],
        profile: { trackedIndexName: null },
        exposureSnapshots: []
      }
    ]);

    mocks.resolveAdapterForInstrument.mockReturnValue({
      issuer: "VANECK",
      source: "VANECK",
      canHandleInstrument: () => true,
      resolveByIsin: vi.fn().mockResolvedValue({
        issuer: "VANECK",
        isin: "IE00TEST0001",
        locale: "https://www.vaneck.com/nl/en",
        productUrl: "https://www.vaneck.com/nl/en/library/fact-sheets/test-fund.pdf",
        factsheetUrl: "https://www.vaneck.com/nl/en/library/fact-sheets/test-fund.pdf"
      }),
      fetchExposure: vi.fn().mockRejectedValue(new Error("429 Too Many Requests"))
    });

    const result = await ensureIsharesExposureSnapshots({
      userId: "user_1",
      issuers: ["VANECK"]
    });

    expect(result.failed).toBe(1);
    expect(mocks.snapshotUpsert).toHaveBeenCalledTimes(1);
    const upsertPayload = mocks.snapshotUpsert.mock.calls[0][0];
    expect(upsertPayload.update.status).toBe("FAILED");
    expect(upsertPayload.update.expiresAt.toISOString()).toBe("2026-02-25T10:00:00.000Z");
  });
});
