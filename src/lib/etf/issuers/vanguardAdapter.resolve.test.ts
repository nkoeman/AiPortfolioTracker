import { beforeEach, describe, expect, it, vi } from "vitest";

const { getTextMock, postJsonMock } = vi.hoisted(() => ({
  getTextMock: vi.fn(),
  postJsonMock: vi.fn()
}));

vi.mock("@/lib/etf/issuers/httpClient", () => ({
  getBytes: vi.fn(),
  getText: getTextMock,
  postJson: postJsonMock
}));

import { vanguardAdapter } from "@/lib/etf/issuers/vanguardAdapter";

function createHints() {
  return {
    instrumentId: "inst_1",
    isin: "IE00B3XXRP09",
    name: "Vanguard S&P 500 UCITS ETF USD Distributing",
    displayName: "Vanguard S&P 500 UCITS ETF USD Distributing",
    issuer: "Vanguard",
    securityType: "ETF",
    securityType2: "ETF",
    marketSector: "Funds",
    trackedIndexName: "S&P 500",
    tickerHint: "VUSA",
    cachedProductUrl: null
  };
}

describe("vanguardAdapter.resolveByIsin", () => {
  beforeEach(() => {
    getTextMock.mockReset();
    postJsonMock.mockReset();
  });

  it("resolves via product search route + ISIN match when direct search pages are unavailable", async () => {
    getTextMock.mockImplementation(async (url: string) => {
      if (url.includes("/professional/product?search=")) {
        return '<html><script id="serverApp-state" type="application/json">{"site":{"portIds":"9503,9504"}}</script></html>';
      }
      if (url.includes("/professional/product/etf/equity/9503")) {
        return '<html>IE00B3XXRP09 <a href="/factsheets/vusa.pdf">Fact sheet</a></html>';
      }
      throw new Error(`unexpected url: ${url}`);
    });

    postJsonMock.mockResolvedValue({
      data: {
        funds: [
          {
            profile: {
              portId: "9503",
              fundFullName: "Vanguard S&P 500 UCITS ETF (USD) Distributing",
              shareClassName: "ETF",
              polarisPdtTypeIndicator: "ETF",
              assetClassificationLevel1: "Equity",
              identifiers: [{ altId: "ISIN", altIdValue: "IE00B3XXRP09", altIdCode: "ISIN" }],
              listings: []
            }
          }
        ]
      }
    });

    const resolved = await vanguardAdapter.resolveByIsin("IE00B3XXRP09", createHints());

    expect(resolved).toBeTruthy();
    expect(resolved?.productUrl).toContain("/professional/product/etf/equity/9503");
    expect(resolved?.factsheetUrl).toBe("/factsheets/vusa.pdf");
    expect(postJsonMock).toHaveBeenCalled();
  });

  it("accepts a GPX-matched product page even when ISIN is not rendered server-side", async () => {
    getTextMock.mockImplementation(async (url: string) => {
      if (url.includes("/professional/product?search=")) {
        return '<html><script id="serverApp-state" type="application/json">{"site":{"portIds":"9503,9504"}}</script></html>';
      }
      if (url.includes("/professional/product/etf/equity/9503")) {
        return '<html><head><title>Fund page</title></head><body><a href="https://fund-docs.vanguard.com/SandP_500_UCITS_ETF_USD_Distributing_9503_NETH_INT_DU.pdf">Fact sheet</a></body></html>';
      }
      throw new Error(`unexpected url: ${url}`);
    });

    postJsonMock.mockResolvedValue({
      data: {
        funds: [
          {
            profile: {
              portId: "9503",
              fundFullName: "Vanguard S&P 500 UCITS ETF (USD) Distributing",
              shareClassName: "ETF",
              polarisPdtTypeIndicator: "ETF",
              assetClassificationLevel1: "Equity",
              identifiers: [{ altId: "ISIN", altIdValue: "IE00B3XXRP09", altIdCode: "ISIN" }],
              listings: []
            }
          }
        ]
      }
    });

    const resolved = await vanguardAdapter.resolveByIsin("IE00B3XXRP09", createHints());

    expect(resolved).toBeTruthy();
    expect(resolved?.productUrl).toContain("/professional/product/etf/equity/9503");
    expect(resolved?.factsheetUrl).toContain("SandP_500_UCITS_ETF_USD_Distributing_9503_NETH_INT_DU.pdf");
    expect(postJsonMock).toHaveBeenCalled();
  });
});
