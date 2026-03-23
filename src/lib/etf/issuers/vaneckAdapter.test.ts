import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getText: vi.fn(),
  getBytes: vi.fn(),
  getJson: vi.fn()
}));

vi.mock("@/lib/etf/issuers/httpClient", async () => {
  return {
    getText: mocks.getText,
    getBytes: mocks.getBytes,
    getJson: mocks.getJson
  };
});

import { vaneckAdapter } from "@/lib/etf/issuers/vaneckAdapter";

function createHints(overrides: Partial<Parameters<typeof vaneckAdapter.fetchExposure>[1]> = {}) {
  return {
    instrumentId: "inst_vaneck",
    isin: "IE00BWFN6Y49",
    name: "VanEck Test ETF",
    displayName: "VanEck Test ETF",
    issuer: "VanEck",
    securityType: "ETF",
    securityType2: "ETF",
    marketSector: "Funds",
    trackedIndexName: null,
    tickerHint: "TSWE",
    cachedProductUrl: null,
    ...overrides
  };
}

async function readFixture(fileName: string) {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const fixturePath = path.resolve(currentDir, "__fixtures__", "vaneck", fileName);
  return fs.readFile(fixturePath);
}

async function readFixtureText(fileName: string) {
  const bytes = await readFixture(fileName);
  return bytes.toString("utf8");
}

describe("vaneckAdapter", () => {
  beforeEach(() => {
    mocks.getText.mockReset();
    mocks.getBytes.mockReset();
    mocks.getJson.mockReset();
  });

  it("resolves factsheet by ISIN through factsheet list scan", async () => {
    const listHtml = await readFixtureText("factsheets-list.html");
    const tswePdf = await readFixture("tswe-factsheet.pdf");
    const defaultPdf = Buffer.from("No matching ISIN here.");

    mocks.getText.mockImplementation(async (url: string) => {
      if (url.includes("/fact-sheets/")) return listHtml;
      throw new Error(`unexpected URL: ${url}`);
    });
    mocks.getBytes.mockImplementation(async (url: string) => {
      if (url.includes("tswe-fact-sheet.pdf")) return tswePdf;
      return defaultPdf;
    });

    const resolved = await vaneckAdapter.resolveByIsin(
      "IE00BWFN6Y49",
      createHints({
        isin: "IE00BWFN6Y49",
        displayName: "VanEck World Equal Weight Screened UCITS ETF",
        tickerHint: "TSWE"
      })
    );

    expect(resolved).toBeTruthy();
    expect(resolved?.factsheetUrl).toContain("tswe-fact-sheet.pdf");
    expect(resolved?.resolvedFrom).toBe("FACTSHEET_LIST");
  });

  it("falls back to page-linked factsheet when PDF ISIN verification is temporarily blocked", async () => {
    const searchHtml = `
      <html>
        <body>
          <a href="/nl/en/investments/world-etf/?q=test">World Equal Weight ETF</a>
        </body>
      </html>
    `;
    const productHtml = `
      <html>
        <body>
          <div>ISIN NL0010408704</div>
          <a href="/nl/en/library/fact-sheets/tswe-fact-sheet.pdf">Fact sheet</a>
        </body>
      </html>
    `;

    mocks.getText.mockImplementation(async (url: string) => {
      if (url.includes("/search/?searchtext=NL0010408704")) return searchHtml;
      if (url.includes("/investments/world-etf")) return productHtml;
      throw new Error(`unexpected URL: ${url}`);
    });
    mocks.getBytes.mockRejectedValue(new Error("temporary blocked"));

    const resolved = await vaneckAdapter.resolveByIsin(
      "NL0010408704",
      createHints({
        isin: "NL0010408704",
        displayName: "VanEck World Equal Weight Screened UCITS ETF",
        tickerHint: "TSWE"
      })
    );

    expect(resolved).toBeTruthy();
    expect(resolved?.factsheetUrl).toContain("tswe-fact-sheet.pdf");
    expect(resolved?.productUrl).toContain("/investments/world-etf");
  });

  it("ignores non-pdf cached product URL and resolves via search/listing", async () => {
    const searchHtml = `
      <html>
        <body>
          <a href="/nl/en/investments/world-etf/">World Equal Weight ETF</a>
        </body>
      </html>
    `;
    const productHtml = `
      <html>
        <body>
          <div>ISIN NL0010408704</div>
          <a href="/nl/en/library/fact-sheets/tswe-fact-sheet.pdf">Fact sheet</a>
        </body>
      </html>
    `;
    const tswePdf = await readFixture("tswe-factsheet.pdf");

    mocks.getText.mockImplementation(async (url: string) => {
      if (url.includes("/search/?searchtext=NL0010408704")) return searchHtml;
      if (url.includes("/investments/world-etf")) return productHtml;
      throw new Error(`unexpected URL: ${url}`);
    });
    mocks.getBytes.mockImplementation(async (url: string) => {
      if (url.includes("tswe-fact-sheet.pdf")) return tswePdf;
      throw new Error(`unexpected URL: ${url}`);
    });

    const resolved = await vaneckAdapter.resolveByIsin(
      "NL0010408704",
      createHints({
        isin: "NL0010408704",
        displayName: "VanEck World Equal Weight Screened UCITS ETF",
        tickerHint: "TSWE",
        cachedProductUrl: "https://www.vaneck.com/nl/en/investments/world-etf"
      })
    );

    expect(resolved).toBeTruthy();
    expect(resolved?.factsheetUrl).toContain("tswe-fact-sheet.pdf");
  });

  it("parses country + sector from english factsheet PDF", async () => {
    const tswePdf = await readFixture("tswe-factsheet.pdf");
    mocks.getBytes.mockResolvedValue(tswePdf);

    const result = await vaneckAdapter.fetchExposure(
      {
        issuer: "VANECK",
        isin: "IE00BWFN6Y49",
        locale: "https://www.vaneck.com/nl/en",
        localeBaseUsed: "https://www.vaneck.com/nl/en",
        productUrl: "https://www.vaneck.com/nl/en/library/fact-sheets/tswe-fact-sheet.pdf",
        factsheetUrl: "https://www.vaneck.com/nl/en/library/fact-sheets/tswe-fact-sheet.pdf",
        resolvedFrom: "FACTSHEET_LIST"
      },
      createHints({
        isin: "IE00BWFN6Y49",
        displayName: "VanEck World Equal Weight Screened UCITS ETF"
      })
    );

    expect(result.payload.country.length).toBeGreaterThan(0);
    expect(result.payload.sector.length).toBeGreaterThan(0);
    expect(result.sourceMeta).toMatchObject({
      issuer: "VANECK",
      parsingMode: "PDF",
      resolvedFrom: "FACTSHEET_LIST"
    });
  });

  it("fills missing sector exposure from product weightings blocks when factsheet payload is incomplete", async () => {
    const nonPdf = Buffer.from("factsheet fetch temporarily unavailable");
    const searchHtml = `
      <html>
        <body>
          <a href="/nl/en/investments/world-etf/">World ETF</a>
        </body>
      </html>
    `;
    const productHtml = `
      <html>
        <body>
          <div>ISIN NL0010408704</div>
          <a href="/nl/en/library/fact-sheets/tswe-fact-sheet.pdf">Fact sheet</a>
          <ve-holdingsweightingschartblock data-blockid="194768" data-pageid="233170" data-template=""></ve-holdingsweightingschartblock>
          <ve-holdingsweightingschartblock data-blockid="194841" data-pageid="233170" data-template=""></ve-holdingsweightingschartblock>
        </body>
      </html>
    `;

    mocks.getBytes.mockResolvedValue(nonPdf);
    mocks.getText.mockImplementation(async (url: string) => {
      if (url.includes("/search/?searchtext=NL0010408704")) return searchHtml;
      if (url.includes("/investments/world-etf")) return productHtml;
      if (url.includes("fact-sheets/tswe-fact-sheet.pdf")) return "factsheet text unavailable";
      throw new Error(`unexpected URL: ${url}`);
    });
    mocks.getJson.mockImplementation(async (url: string) => {
      if (url.includes("blockid=194768")) {
        return {
          data: {
            WeightingsType: "CountryOfRisk",
            AsOfDate: "31 Jan 2026",
            Holdings: [
              { Label: "United States", Weight: "36.93" },
              { Label: "Japan", Weight: "15.32" }
            ]
          }
        };
      }
      if (url.includes("blockid=194841")) {
        return {
          data: {
            WeightingsType: "Sector",
            AsOfDate: "31 Jan 2026",
            Holdings: [
              { Label: "Financials", Weight: "30.7" },
              { Label: "Information Technology", Weight: "23.0" }
            ]
          }
        };
      }
      throw new Error(`unexpected URL: ${url}`);
    });

    const result = await vaneckAdapter.fetchExposure(
      {
        issuer: "VANECK",
        isin: "NL0010408704",
        locale: "https://www.vaneck.com/nl/en",
        localeBaseUsed: "https://www.vaneck.com/nl/en",
        productUrl: "https://www.vaneck.com/nl/en/library/fact-sheets/tswe-fact-sheet.pdf",
        factsheetUrl: "https://www.vaneck.com/nl/en/library/fact-sheets/tswe-fact-sheet.pdf",
        resolvedFrom: "CACHE"
      },
      createHints({
        isin: "NL0010408704",
        displayName: "VanEck World Equal Weight Screened UCITS ETF",
        tickerHint: "TSWE"
      })
    );

    expect(result.payload.sector.length).toBeGreaterThan(0);
    expect(result.payload.country.length).toBeGreaterThan(0);
  });

  it("discards bogus PDF labels like /Length and falls back to weightings data", async () => {
    const bogusPdf = Buffer.from("/Length 9\n/Length 137\n", "utf8");
    const searchHtml = `
      <html>
        <body>
          <a href="/nl/en/investments/world-etf/">World ETF</a>
        </body>
      </html>
    `;
    const productHtml = `
      <html>
        <body>
          <div>ISIN NL0010408704</div>
          <a href="/nl/en/library/fact-sheets/tswe-fact-sheet.pdf">Fact sheet</a>
          <ve-holdingsweightingschartblock data-blockid="194768" data-pageid="233170" data-template=""></ve-holdingsweightingschartblock>
          <ve-holdingsweightingschartblock data-blockid="194841" data-pageid="233170" data-template=""></ve-holdingsweightingschartblock>
        </body>
      </html>
    `;

    mocks.getBytes.mockResolvedValue(bogusPdf);
    mocks.getText.mockImplementation(async (url: string) => {
      if (url.includes("/search/?searchtext=NL0010408704")) return searchHtml;
      if (url.includes("/investments/world-etf")) return productHtml;
      if (url.includes("fact-sheets/tswe-fact-sheet.pdf")) return bogusPdf.toString("utf8");
      throw new Error(`unexpected URL: ${url}`);
    });
    mocks.getJson.mockImplementation(async (url: string) => {
      if (url.includes("blockid=194768")) {
        return {
          data: {
            WeightingsType: "CountryOfRisk",
            AsOfDate: "31 Jan 2026",
            Holdings: [
              { Label: "United States", Weight: "36.93" },
              { Label: "Japan", Weight: "15.32" }
            ]
          }
        };
      }
      if (url.includes("blockid=194841")) {
        return {
          data: {
            WeightingsType: "Sector",
            AsOfDate: "31 Jan 2026",
            Holdings: [
              { Label: "Financials", Weight: "30.7" },
              { Label: "Information Technology", Weight: "23.0" }
            ]
          }
        };
      }
      throw new Error(`unexpected URL: ${url}`);
    });

    const result = await vaneckAdapter.fetchExposure(
      {
        issuer: "VANECK",
        isin: "NL0010408704",
        locale: "https://www.vaneck.com/nl/en",
        localeBaseUsed: "https://www.vaneck.com/nl/en",
        productUrl: "https://www.vaneck.com/nl/en/library/fact-sheets/tswe-fact-sheet.pdf",
        factsheetUrl: "https://www.vaneck.com/nl/en/library/fact-sheets/tswe-fact-sheet.pdf",
        resolvedFrom: "CACHE"
      },
      createHints({
        isin: "NL0010408704",
        displayName: "VanEck World Equal Weight Screened UCITS ETF",
        tickerHint: "TSWE"
      })
    );

    expect(result.payload.country.some((row) => row.country === "United States")).toBe(true);
    expect(result.payload.sector.some((row) => row.sector === "Financials")).toBe(true);
    expect(result.payload.country.some((row) => row.country === "/Length")).toBe(false);
    expect(result.payload.sector.some((row) => row.sector === "/Length")).toBe(false);
  });

  it("applies single-country inference only when unambiguous", async () => {
    const sectorOnly = await readFixture("aex-sector-only.pdf");
    mocks.getBytes.mockResolvedValue(sectorOnly);

    const inferred = await vaneckAdapter.fetchExposure(
      {
        issuer: "VANECK",
        isin: "NL0000000001",
        locale: "https://www.vaneck.com/nl/en",
        productUrl: "https://www.vaneck.com/nl/en/library/fact-sheets/aex-fact-sheet.pdf",
        factsheetUrl: "https://www.vaneck.com/nl/en/library/fact-sheets/aex-fact-sheet.pdf",
        resolvedFrom: "URL_PATTERN"
      },
      createHints({
        isin: "NL0000000001",
        displayName: "VanEck AEX UCITS ETF",
        tickerHint: "AEX"
      })
    );

    expect(inferred.payload.country).toEqual([{ country: "Netherlands", weight: 1 }]);

    const notInferred = await vaneckAdapter.fetchExposure(
      {
        issuer: "VANECK",
        isin: "NL0000000001",
        locale: "https://www.vaneck.com/nl/en",
        productUrl: "https://www.vaneck.com/nl/en/library/fact-sheets/aex-fact-sheet.pdf",
        factsheetUrl: "https://www.vaneck.com/nl/en/library/fact-sheets/aex-fact-sheet.pdf",
        resolvedFrom: "URL_PATTERN"
      },
      createHints({
        isin: "NL0000000001",
        displayName: "VanEck MSCI World UCITS ETF",
        trackedIndexName: "MSCI World"
      })
    );

    expect(notInferred.payload.country).toEqual([]);
  });
});
