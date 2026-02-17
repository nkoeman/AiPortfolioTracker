import { beforeEach, describe, expect, it, vi } from "vitest";
import { __testables, fetchEcbFxSeries } from "@/lib/ecb/client";

describe("ECB client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("parses SDMX JSON daily observations", () => {
    const points = __testables.parseEcbFxSeriesPayload({
      dataSets: [
        {
          series: {
            "0:0:0:0:0": {
              observations: {
                "0": [1.1],
                "2": [1.2]
              }
            }
          }
        }
      ],
      structure: {
        dimensions: {
          observation: [
            {
              id: "TIME_PERIOD",
              values: [{ id: "2026-01-01" }, { id: "2026-01-02" }, { id: "2026-01-03" }]
            }
          ]
        }
      }
    });

    expect(points).toEqual([
      { date: "2026-01-01", rate: 1.1 },
      { date: "2026-01-03", rate: 1.2 }
    ]);
  });

  it("retries failed requests and returns parsed points", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: { get: () => "application/json" },
        text: async () => "service unavailable"
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "application/vnd.sdmx.data+json;version=1.0.0-wd" },
        json: async () => ({
          dataSets: [
            {
              series: {
                "0:0:0:0:0": {
                  observations: {
                    "0": [1.25]
                  }
                }
              }
            }
          ],
          structure: {
            dimensions: {
              observation: [
                {
                  id: "TIME_PERIOD",
                  values: [{ id: "2026-01-05" }]
                }
              ]
            }
          }
        })
      });

    vi.stubGlobal("fetch", fetchMock);

    const points = await fetchEcbFxSeries("usd", "2026-01-01", "2026-01-31");
    const requestUrl = new URL(fetchMock.mock.calls[0][0]);
    const requestOptions = fetchMock.mock.calls[0][1];

    expect(requestUrl.pathname).toContain("/EXR/D.USD.EUR.SP00.A");
    expect(requestOptions?.headers?.Accept).toBe("application/vnd.sdmx.data+json;version=1.0.0-wd");
    expect(points).toEqual([{ date: "2026-01-05", rate: 1.25 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
