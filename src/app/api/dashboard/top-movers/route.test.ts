import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentAppUser: vi.fn(),
  getTopMoversByRange: vi.fn()
}));

vi.mock("@/lib/auth/appUser", () => ({
  getCurrentAppUser: mocks.getCurrentAppUser
}));

vi.mock("@/lib/dashboard/topMoversByRange", () => ({
  getTopMoversByRange: mocks.getTopMoversByRange
}));

import { GET } from "@/app/api/dashboard/top-movers/route";

describe("GET /api/dashboard/top-movers", () => {
  beforeEach(() => {
    mocks.getCurrentAppUser.mockReset();
    mocks.getTopMoversByRange.mockReset();
  });

  it("returns 401 for unauthenticated requests", async () => {
    mocks.getCurrentAppUser.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/dashboard/top-movers?range=max"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 for an invalid range", async () => {
    mocks.getCurrentAppUser.mockResolvedValue({ id: "user_1", email: "user@example.com", name: null, clerkUserId: "clerk_1" });

    const response = await GET(new Request("http://localhost/api/dashboard/top-movers?range=bad"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Invalid range");
  });

  it("returns movers payload for a valid range", async () => {
    mocks.getCurrentAppUser.mockResolvedValue({ id: "user_1", email: "user@example.com", name: null, clerkUserId: "clerk_1" });
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
