import { beforeEach, describe, expect, it, vi } from "vitest";
import { Instrument } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  instrumentFindMany: vi.fn(),
  profileUpsert: vi.fn(),
  profileUpdate: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    instrument: {
      findMany: mocks.instrumentFindMany
    },
    instrumentProfile: {
      upsert: mocks.profileUpsert,
      update: mocks.profileUpdate
    }
  }
}));

import { ensureInstrumentProfiles } from "@/lib/enrichment";

function makeInstrument(overrides: Partial<Instrument>): Instrument {
  return {
    id: "inst_1",
    isin: "ISIN123",
    name: "Test ETF",
    displayName: null,
    figi: null,
    figiComposite: null,
    securityType: null,
    securityType2: "ETF",
    marketSector: null,
    assetClass: null,
    issuer: null,
    countryOfRisk: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides
  };
}

describe("instrument profile orchestrator", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.instrumentFindMany.mockReset();
    mocks.profileUpsert.mockReset();
    mocks.profileUpdate.mockReset();
  });

  it("upserts rule-based profile data", async () => {
    mocks.instrumentFindMany.mockResolvedValue([
      {
        ...makeInstrument({ name: "Random UCITS ETF" }),
        profile: null
      }
    ]);
    mocks.profileUpsert.mockResolvedValue({});
    mocks.profileUpdate.mockResolvedValue({});

    await expect(
      ensureInstrumentProfiles(["ISIN123"], { userId: "user_1", importBatchId: "batch_1" })
    ).resolves.toBeUndefined();

    expect(mocks.profileUpsert).toHaveBeenCalled();
    expect(mocks.profileUpdate).not.toHaveBeenCalled();
  });
});
