import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  userFindUnique: vi.fn(),
  getPortfolioExposure: vi.fn()
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

vi.mock("@/lib/exposure/portfolioExposure", () => ({
  getPortfolioExposure: mocks.getPortfolioExposure
}));

import { GET } from "@/app/api/portfolio/exposure/route";

describe("GET /api/portfolio/exposure", () => {
  beforeEach(() => {
    mocks.getServerSession.mockReset();
    mocks.userFindUnique.mockReset();
    mocks.getPortfolioExposure.mockReset();
  });

  it("returns 401 when the request is unauthenticated", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/portfolio/exposure"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns the exposure payload and preserves normalized chart sums", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { email: "user@example.com" } });
    mocks.userFindUnique.mockResolvedValue({ id: "user_1" });
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
