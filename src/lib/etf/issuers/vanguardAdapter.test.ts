import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import * as httpClient from "@/lib/etf/issuers/httpClient";
import * as isharesExposure from "@/lib/ishares/isharesExposure";
import { vanguardAdapter } from "@/lib/etf/issuers/vanguardAdapter";

function createHints(overrides: Partial<Parameters<typeof vanguardAdapter.fetchExposure>[1]> = {}) {
  return {
    instrumentId: "inst_1",
    isin: "IE00VGTEST0001",
    name: "Vanguard Test Fund",
    displayName: "Vanguard Test Fund",
    issuer: "Vanguard",
    securityType: "ETF",
    securityType2: "ETF",
    marketSector: "Funds",
    trackedIndexName: null,
    tickerHint: null,
    cachedProductUrl: null,
    ...overrides
  };
}

async function readFixture(fileName: string) {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const fixturePath = path.resolve(currentDir, "__fixtures__", fileName);
  return fs.readFile(fixturePath, "utf8");
}

describe("vanguardAdapter", () => {
  it("parses country + sector exposure when present", async () => {
    const html = await readFixture("vanguard-sample.html");
    const result = await vanguardAdapter.fetchExposure(
      {
        issuer: "VANGUARD",
        isin: "IE00VGTEST0001",
        locale: "uk",
        productUrl: "https://example.com/vanguard",
        pageHtml: html
      },
      createHints()
    );

    expect(result.payload.country.length).toBeGreaterThan(0);
    expect(result.payload.sector.length).toBeGreaterThan(0);
    expect(result.sourceMeta.parsingMode).toBe("JSON");
  });

  it("does not infer single-country exposure for broad market products", async () => {
    const html = await readFixture("vanguard-sector-only.html");
    const result = await vanguardAdapter.fetchExposure(
      {
        issuer: "VANGUARD",
        isin: "IE00VGTEST0002",
        locale: "uk",
        productUrl: "https://example.com/vanguard-world",
        pageHtml: html
      },
      createHints({
        displayName: "Vanguard FTSE All-World UCITS ETF",
        trackedIndexName: "FTSE All-World"
      })
    );

    expect(result.payload.sector.length).toBeGreaterThan(0);
    expect(result.payload.country).toEqual([]);
    expect(result.sourceMeta.countryRegionInference).toMatchObject({
      applied: false
    });
  });

  it("extracts sectors from Vanguard PDF text fallback when generic PDF parser returns empty sector payload", async () => {
    const getBytesSpy = vi.spyOn(httpClient, "getBytes").mockResolvedValue(
      Buffer.from(
        [
          "Data as at 31 January 2026",
          "Weighted exposureInformation Technology",
          "Information Technology 33.4%",
          "Financials 12.9",
          "Consumer Discretionary 10.4",
          "Health Care 9.4",
          "Industrials 8.6",
          "Market allocation",
          "United States 100.0%"
        ].join("\n"),
        "utf8"
      )
    );
    const parsePdfSpy = vi.spyOn(isharesExposure, "parseIsharesFactsheetPdfBytes").mockResolvedValue({
      asOfDate: new Date("2026-01-31T00:00:00.000Z"),
      payload: {
        country: [{ country: "United States", weight: 1 }],
        sector: []
      },
      sourceMeta: { parser: "factsheet-text" }
    });

    const result = await vanguardAdapter.fetchExposure(
      {
        issuer: "VANGUARD",
        isin: "IE00VGTEST0003",
        locale: "uk",
        productUrl: "https://example.com/vanguard",
        factsheetUrl: "https://example.com/factsheet.pdf",
        pageHtml: "<html><body>No sector JSON on page</body></html>"
      },
      createHints({
        isin: "IE00VGTEST0003",
        displayName: "Vanguard S&P 500 UCITS ETF"
      })
    );

    expect(getBytesSpy).toHaveBeenCalledTimes(1);
    expect(parsePdfSpy).toHaveBeenCalledTimes(1);
    expect(result.payload.sector.length).toBeGreaterThan(0);
    expect(result.payload.sector.some((row) => row.sector === "Information Technology")).toBe(true);
    expect(result.sourceMeta.vanguardSectorFallback).toBe(true);

    getBytesSpy.mockRestore();
    parsePdfSpy.mockRestore();
  });

  it("tries multiple factsheet candidates and prefers an english candidate with sector data", async () => {
    const getBytesSpy = vi.spyOn(httpClient, "getBytes").mockImplementation(async (url: string) => {
      if (url.includes("_DU.pdf")) {
        return Buffer.from("dummy-du-pdf", "utf8");
      }
      return Buffer.from("dummy-en-pdf", "utf8");
    });
    const parsePdfSpy = vi.spyOn(isharesExposure, "parseIsharesFactsheetPdfBytes").mockImplementation(async (bytes: Buffer) => {
      const marker = bytes.toString("utf8");
      if (marker.includes("dummy-du-pdf")) {
        return {
          asOfDate: new Date("2026-01-31T00:00:00.000Z"),
          payload: {
            country: [{ country: "United States", weight: 1 }],
            sector: []
          },
          sourceMeta: { parser: "factsheet-text" }
        };
      }
      return {
        asOfDate: new Date("2026-01-31T00:00:00.000Z"),
        payload: {
          country: [{ country: "United States", weight: 1 }],
          sector: [{ sector: "Information Technology", weight: 0.334 }]
        },
        sourceMeta: { parser: "factsheet-text" }
      };
    });

    const result = await vanguardAdapter.fetchExposure(
      {
        issuer: "VANGUARD",
        isin: "IE00VGTEST0004",
        locale: "nl",
        productUrl: "https://www.nl.vanguard/professional/product/etf/equity/9503/sp-500-ucits-etf-usd-distributing",
        factsheetUrl: "https://fund-docs.vanguard.com/SandP_500_UCITS_ETF_USD_Distributing_9503_NETH_INT_DU.pdf",
        pageHtml: `
          <html><body>
            <a href="https://fund-docs.vanguard.com/SandP_500_UCITS_ETF_USD_Distributing_9503_NETH_INT_DU.pdf">NL factsheet</a>
            <a href="https://fund-docs.vanguard.com/SandP_500_UCITS_ETF_USD_Distributing_9503_EU_INT_UK_EN.pdf">EN factsheet</a>
          </body></html>
        `
      },
      createHints({
        isin: "IE00VGTEST0004",
        displayName: "Vanguard S&P 500 UCITS ETF"
      })
    );

    expect(getBytesSpy).toHaveBeenCalled();
    expect(result.payload.sector.length).toBeGreaterThan(0);
    expect(String(result.sourceMeta.factsheetUrl)).toContain("_UK_EN.pdf");

    getBytesSpy.mockRestore();
    parsePdfSpy.mockRestore();
  });
});
