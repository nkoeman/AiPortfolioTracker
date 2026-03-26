import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  userFindUnique: vi.fn(),
  getTopMoversByRange: vi.fn()
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

vi.mock("@/lib/dashboard/topMoversByRange", () => ({
  getTopMoversByRange: mocks.getTopMoversByRange
}));

import { GET } from "@/app/api/dashboard/top-movers/route";

describe("GET /api/dashboard/top-movers", () => {
  beforeEach(() => {
    mocks.getServerSession.mockReset();
    mocks.userFindUnique.mockReset();
    mocks.getTopMoversByRange.mockReset();
  });

  it("returns 401 for unauthenticated requests", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/dashboard/top-movers?range=max"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 for an invalid range", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { email: "user@example.com" } });
    mocks.userFindUnique.mockResolvedValue({ id: "user_1" });

    const response = await GET(new Request("http://localhost/api/dashboard/top-movers?range=bad"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Invalid range");
  });

  it("returns movers payload for a valid range", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { email: "user@example.com" } });
    mocks.userFindUnique.mockResolvedValue({ id: "user_1" });
    mocks.getTopMoversByRange.mockResolvedValue({
      range: "max",
      label: "Max",
      granularity: "WEEKLY",
      window: { startDate: new Date("2026-01-01T00:00:00.000Z"), endDate: new Date("2026-03-01T00:00:00.000Z") },
      contributors: { topGainers: [], topLosers: [] },
      lastUpdatedAt: new Date("2026-03-01T00:00:00.000Z")
    });

    const response = await GET(new Request("http://localhost/api/dashboard/top-movers?range=max"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.getTopMoversByRange).toHaveBeenCalledWith("user_1", "max");
    expect(body.range).toBe("max");
  });
});
