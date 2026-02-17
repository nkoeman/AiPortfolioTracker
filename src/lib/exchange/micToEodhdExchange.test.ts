import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    eodhdExchange: { findMany: mocks.findMany }
  }
}));

import { __testables, resolveEodhdExchangeFromMic } from "@/lib/exchange/micToEodhdExchange";

describe("resolveEodhdExchangeFromMic", () => {
  beforeEach(() => {
    mocks.findMany.mockReset();
  });

  it("resolves when one exact MIC token matches", async () => {
    mocks.findMany.mockResolvedValue([{ code: "AS", operatingMICs: "XAMS" }]);
    await expect(resolveEodhdExchangeFromMic("XAMS")).resolves.toBe("AS");
  });

  it("returns null on ambiguous MIC matches", async () => {
    mocks.findMany.mockResolvedValue([
      { code: "AS", operatingMICs: "XAMS" },
      { code: "AMS2", operatingMICs: "XAMS,TEST" }
    ]);
    await expect(resolveEodhdExchangeFromMic("XAMS")).resolves.toBeNull();
  });

  it("splits MIC tokens with safe boundaries", () => {
    expect(__testables.splitMicTokens("XAMS, XETR;XLON|XNAS")).toEqual(["XAMS", "XETR", "XLON", "XNAS"]);
  });
});