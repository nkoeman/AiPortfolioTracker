import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    degiroVenueMap: { findUnique: mocks.findUnique }
  }
}));

import { resolveMicFromBeurs } from "@/lib/brokers/degiro/beursToMic";

describe("resolveMicFromBeurs", () => {
  beforeEach(() => {
    mocks.findUnique.mockReset();
  });

  it("returns MIC from DB curated venue mapping", async () => {
    mocks.findUnique.mockResolvedValue({ mic: "XAMS" });

    await expect(resolveMicFromBeurs("eam")).resolves.toBe("XAMS");
    expect(mocks.findUnique).toHaveBeenCalledWith({ where: { brokerVenueCode: "EAM" } });
  });

  it("returns null when the beurs code is unknown", async () => {
    mocks.findUnique.mockResolvedValue(null);
    await expect(resolveMicFromBeurs("XXX")).resolves.toBeNull();
  });
});