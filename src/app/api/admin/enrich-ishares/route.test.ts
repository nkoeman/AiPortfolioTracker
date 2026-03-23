import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  userFindUnique: vi.fn(),
  ensureIsharesExposureSnapshots: vi.fn(),
  backfillNormalizeExposureSnapshots: vi.fn()
}));

vi.mock("next-auth", () => ({
  getServerSession: mocks.getServerSession
}));

vi.mock("@/lib/auth/options", () => ({
  authOptions: {}
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique
    }
  }
}));

vi.mock("@/lib/ishares/ensureIsharesExposure", () => ({
  ensureIsharesExposureSnapshots: mocks.ensureIsharesExposureSnapshots
}));

vi.mock("@/lib/exposure/normalize", () => ({
  backfillNormalizeExposureSnapshots: mocks.backfillNormalizeExposureSnapshots
}));

import { POST } from "@/app/api/admin/enrich-ishares/route";

describe("POST /api/admin/enrich-ishares", () => {
  beforeEach(() => {
    mocks.getServerSession.mockReset();
    mocks.userFindUnique.mockReset();
    mocks.ensureIsharesExposureSnapshots.mockReset();
    mocks.backfillNormalizeExposureSnapshots.mockReset();
  });

  it("runs a normalization backfill immediately after enrichment", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { email: "user@example.com" } });
    mocks.userFindUnique.mockResolvedValue({ id: "user_1" });
    mocks.ensureIsharesExposureSnapshots.mockResolvedValue({ ready: 2, failed: 0 });
    mocks.backfillNormalizeExposureSnapshots.mockResolvedValue({ scanned: 2, normalized: 2, skipped: 0 });

    const request = new Request("http://localhost/api/admin/enrich-ishares", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instrumentIds: ["inst_1"], force: true })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.ensureIsharesExposureSnapshots).toHaveBeenCalledWith({
      userId: "user_1",
      instrumentIds: ["inst_1"],
      force: true
    });
    expect(mocks.backfillNormalizeExposureSnapshots).toHaveBeenCalledWith({
      userId: "user_1",
      instrumentIds: ["inst_1"],
      batchSize: 250,
      delayMs: 0
    });
    expect(body).toEqual({
      ok: true,
      result: { ready: 2, failed: 0 },
      normalization: { scanned: 2, normalized: 2, skipped: 0 }
    });
  });
});
