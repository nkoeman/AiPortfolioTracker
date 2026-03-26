import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentAppUser: vi.fn(),
  getPortfolioExposure: vi.fn()
}));

vi.mock("@/lib/auth/appUser", () => ({
  getCurrentAppUser: mocks.getCurrentAppUser
}));

vi.mock("@/lib/exposure/portfolioExposure", () => ({
  getPortfolioExposure: mocks.getPortfolioExposure
}));

import { GET } from "@/app/api/portfolio/exposure/route";

describe("GET /api/portfolio/exposure", () => {
  beforeEach(() => {
    mocks.getCurrentAppUser.mockReset();
    mocks.getPortfolioExposure.mockReset();
  });

  it("returns 401 when the request is unauthenticated", async () => {
    mocks.getCurrentAppUser.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/portfolio/exposure"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns the exposure payload and preserves normalized chart sums", async () => {
    mocks.getCurrentAppUser.mockResolvedValue({ id: "user_1", email: "user@example.com", name: null, clerkUserId: "clerk_1" });
    mocks.getPortfolioExposure.mockResolvedValue({
      asOfDate: "2026-02-27",
      coverage: 0.9,
      charts: {
        region: [
          { key: "NORTH_AMERICA", label: "North America", value: 0.6 },
          { key: "NO_DATA", label: "No data", value: 0.4 }
        ],
        development: [
          { key: "DEVELOPED", label: "Developed", value: 0.6 },
          { key: "NO_DATA", label: "No data", value: 0.4 }
        ],
        country: [
          { key: "US", label: "US", value: 0.6 },
          { key: "NO_DATA", label: "No data", value: 0.4 }
        ],
        sector: [
          { key: "INFORMATION_TECHNOLOGY", label: "Information Technology", value: 0.7 },
          { key: "FINANCIALS", label: "Financials", value: 0.3 }
        ]
      },
      chartMeta: {
        region: { coverage: 0.6, noData: 0.4 },
        development: { coverage: 0.6, noData: 0.4 },
        country: { coverage: 0.6, noData: 0.4 },
        sector: { coverage: 1, noData: 0 }
      },
      meta: {
        normalizerVersion: "v1",
        regionMapVersion: "v1",
        developmentMapVersion: "v1",
        snapshotsUsed: 1,
        missingExposureInstruments: 1,
        countryCoverage: 0.6,
        sectorCoverage: 1
      }
    });

    const response = await GET(new Request("http://localhost/api/portfolio/exposure?asOf=2026-02-27"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.getPortfolioExposure).toHaveBeenCalledWith("user_1", new Date("2026-02-27T00:00:00.000Z"));

    const sum = (rows: Array<{ value: number }>) => rows.reduce((total, row) => total + row.value, 0);
    expect(sum(body.charts.region)).toBeCloseTo(1, 8);
    expect(sum(body.charts.development)).toBeCloseTo(1, 8);
    expect(sum(body.charts.country)).toBeCloseTo(1, 8);
    expect(sum(body.charts.sector)).toBeCloseTo(1, 8);
  });
});
