import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mapIsins: vi.fn(),
  instrumentFindMany: vi.fn(),
  enrichmentFindMany: vi.fn(),
  instrumentUpdate: vi.fn(),
  enrichmentUpsert: vi.fn()
}));

vi.mock("@/lib/openfigi/client", () => ({
  mapIsins: mocks.mapIsins,
  selectOpenFigiCandidate: vi.fn((candidates: unknown[]) => ({
    candidate: candidates[0] || null,
    warning: null
  }))
}));

vi.mock("@prisma/client", () => ({
  EnrichmentStatus: {
    PENDING: "PENDING",
    SUCCESS: "SUCCESS",
    FAILED: "FAILED"
  }
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    instrument: {
      findMany: mocks.instrumentFindMany,
      update: mocks.instrumentUpdate
    },
    instrumentEnrichment: {
      findMany: mocks.enrichmentFindMany,
      upsert: mocks.enrichmentUpsert
    }
  }
}));

import { enrichInstrumentsFromOpenFigi } from "@/lib/openfigi/enrich";

describe("OpenFIGI enrichment pipeline", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.OPENFIGI_API_KEY = "test-key";
    process.env.OPENFIGI_ENRICH_TTL_DAYS = "30";

    mocks.mapIsins.mockReset();
    mocks.instrumentFindMany.mockReset();
    mocks.enrichmentFindMany.mockReset();
    mocks.instrumentUpdate.mockReset();
    mocks.enrichmentUpsert.mockReset();

    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("updates instrument and writes enrichment row when OpenFIGI returns data", async () => {
    const now = new Date("2026-02-01T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    mocks.instrumentFindMany.mockResolvedValue([
      {
        id: "inst_1",
        isin: "US0000000001",
        name: "Legacy Name",
        displayName: null,
        securityType2: null,
        countryOfRisk: null,
        listings: [{ exchangeMic: "XNAS", isPrimary: true }]
      }
    ]);

    mocks.enrichmentFindMany.mockResolvedValue([
      {
        isin: "US0000000001",
        fetchedAt: new Date("2025-12-01T00:00:00.000Z"),
        status: "SUCCESS"
      }
    ]);

    mocks.mapIsins.mockResolvedValue([
      {
        isin: "US0000000001",
        candidates: [
          {
            name: "OpenFIGI Name",
            figi: "BBG000000001",
            securityType2: "Common Stock",
            country: "US",
            micCode: "XNAS"
          }
        ],
        error: null,
        warning: null
      }
    ]);

    await enrichInstrumentsFromOpenFigi(["US0000000001"], {
      userId: "user_1",
      importBatchId: "batch_1",
      batchSize: 25
    });

    expect(mocks.mapIsins).toHaveBeenCalledWith(["US0000000001"]);
    const updateCall = mocks.instrumentUpdate.mock.calls[0][0];
    expect(updateCall.where).toEqual({ isin: "US0000000001" });
    expect(updateCall.data).toEqual(
      expect.objectContaining({
        displayName: "OpenFIGI Name",
        figi: "BBG000000001",
        securityType2: "Common Stock",
        countryOfRisk: "US"
      })
    );
    expect(updateCall.data).not.toHaveProperty("openFigiTicker");
    expect(updateCall.data).not.toHaveProperty("openFigiExchCode");
    expect(updateCall.data).not.toHaveProperty("openFigiMic");
    expect(mocks.enrichmentUpsert).toHaveBeenCalled();

    vi.useRealTimers();
  });
});
