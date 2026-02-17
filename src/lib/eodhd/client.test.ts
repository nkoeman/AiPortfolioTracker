import { beforeEach, describe, expect, it, vi } from "vitest";

import { EodhdClient, __testables } from "@/lib/eodhd/client";

describe("EodhdClient weekly history", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.EODHD_API_KEY = "test-key";
  });

  it("requests weekly EODHD bars and parses adjusted close", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { date: "2026-01-09", adjusted_close: "12.34" },
        { date: "2026-01-16", adj_close: 12.56 },
        { date: "2026-01-23", close: "12.99" }
      ]
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new EodhdClient();
    const points = await client.getHistoricalWeeklyAdjustedClose("IMAE.AS", "2026-01-01", "2026-02-03");

    const requestUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(requestUrl.searchParams.get("period")).toBe("w");
    expect(requestUrl.searchParams.get("from")).toBe("2026-01-01");
    expect(requestUrl.searchParams.get("to")).toBe("2026-02-03");
    expect(points).toEqual([
      { date: "2026-01-09", adjClose: 12.34 },
      { date: "2026-01-16", adjClose: 12.56 },
      { date: "2026-01-23", adjClose: 12.99, close: 12.99 }
    ]);
  });

  it("ignores malformed rows when parsing historical payloads", () => {
    const parsed = __testables.parseHistoricalAdjustedClose([
      { date: "2026-01-09", adjusted_close: "10" },
      { date: "", adjusted_close: "11" },
      { date: "2026-01-16", adjusted_close: "not-a-number" }
    ]);

    expect(parsed).toEqual([{ date: "2026-01-09", adjClose: 10 }]);
  });
});
