import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getText: vi.fn(),
  getJson: vi.fn(),
  getBytes: vi.fn(),
  parsePdf: vi.fn()
}));

vi.mock("@/lib/etf/issuers/httpClient", async () => {
  return {
    getText: mocks.getText,
    getJson: mocks.getJson,
    getBytes: mocks.getBytes
  };
});

vi.mock("@/lib/ishares/isharesExposure", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ishares/isharesExposure")>("@/lib/ishares/isharesExposure");
  return {
    ...actual,
    parseIsharesFactsheetPdfBytes: mocks.parsePdf
  };
});

import { spdrAdapter } from "@/lib/etf/issuers/spdrAdapter";

function createHints(overrides: Partial<Parameters<typeof spdrAdapter.fetchExposure>[1]> = {}) {
  return {
    instrumentId: "inst_spdr",
    isin: "IE00SPDR00001",
    name: "SPDR Test Fund",
    displayName: "SPDR Test Fund",
    issuer: "SPDR",
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

describe("spdrAdapter", () => {
  beforeEach(() => {
    mocks.getText.mockReset();
    mocks.getJson.mockReset();
    mocks.getBytes.mockReset();
    mocks.parsePdf.mockReset();
  });

  it("resolves by ISIN via SPDR suggest API when search pages do not expose links", async () => {
    mocks.getJson.mockResolvedValue({
      status: "success",
      suggests: {
        Investments: [
          {
            title: "State Street SPDR Russell 2000",
            link: "https://www.ssga.com/nl/nl/intermediary/etfs/state-street-spdr-russell-2000-us-small-cap-ucits-etf-acc-zprr-gy",
            ticker: "ZPRR GY",
            target: ""
          }
        ]
      }
    });
    mocks.getText.mockImplementation(async (url: string) => {
      if (url.includes("/public-api/aem/v2/suggest")) {
        throw new Error("suggest should use getJson");
      }
      return '<html><meta name="ISIN" content="IE00BJ38QD84" /><a href="/library-content/products/factsheets/etfs/emea/factsheet-emea-nl-zprr-gy.pdf">Factsheet</a></html>';
    });

    const resolved = await spdrAdapter.resolveByIsin("IE00BJ38QD84", createHints({
      isin: "IE00BJ38QD84",
      tickerHint: "ZPRR"
    }));

    expect(resolved).toBeTruthy();
    expect(resolved?.productUrl).toContain("/state-street-spdr-russell-2000-us-small-cap-ucits-etf-acc-zprr-gy");
    expect(resolved?.factsheetUrl).toContain("factsheet-emea-nl-zprr-gy.pdf");
    expect(mocks.getJson).toHaveBeenCalled();
  });

  it("parses geographic + sector exposure from HTML", async () => {
    const html = await readFixture("spdr-sample.html");
    const result = await spdrAdapter.fetchExposure(
      {
        issuer: "SPDR",
        isin: "IE00SPDR00001",
        locale: "uk",
        productUrl: "https://example.com/spdr",
        pageHtml: html
      },
      createHints()
    );

    expect(result.payload.country.length).toBeGreaterThan(0);
    expect(result.payload.sector.length).toBeGreaterThan(0);
  });

  it("parses hidden SPDR breakdown JSON when no headings/tables are present", async () => {
    const html = `
      <html><body>
        <div>ISIN: IE00SPDR00003</div>
        <input type="hidden" id="fund-sector-breakdown" value="{&#34;asOfDateSimple&#34;:&#34;24 feb 2026&#34;,&#34;attrArray&#34;:[{&#34;name&#34;:{&#34;value&#34;:&#34;Technologie&#34;},&#34;weight&#34;:{&#34;originalValue&#34;:&#34;11.5&#34;}}]}" />
        <input type="hidden" id="fund-geographical-breakdown" value="{&#34;asOfDateSimple&#34;:&#34;24 feb 2026&#34;,&#34;attrArray&#34;:[{&#34;name&#34;:{&#34;value&#34;:&#34;United States&#34;},&#34;weight&#34;:{&#34;originalValue&#34;:&#34;98.4&#34;}}]}" />
      </body></html>
    `;

    const result = await spdrAdapter.fetchExposure(
      {
        issuer: "SPDR",
        isin: "IE00SPDR00003",
        locale: "nl",
        productUrl: "https://example.com/spdr",
        pageHtml: html
      },
      createHints({ isin: "IE00SPDR00003" })
    );

    expect(result.payload.country.length).toBeGreaterThan(0);
    expect(result.payload.sector.length).toBeGreaterThan(0);
    expect(result.sourceMeta.parsingMode).toBe("HIDDEN_JSON");
  });

  it("prefers english locale page for labels and keeps raw english sector names", async () => {
    const englishHtml = `
      <html><body>
        <div>ISIN: IE00BJ38QD84</div>
        <input type="hidden" id="fund-sector-breakdown" value="{&#34;asOfDateSimple&#34;:&#34;24 feb 2026&#34;,&#34;attrArray&#34;:[{&#34;name&#34;:{&#34;value&#34;:&#34;Health Care&#34;},&#34;weight&#34;:{&#34;originalValue&#34;:&#34;12.0&#34;}}]}" />
        <input type="hidden" id="fund-geographical-breakdown" value="{&#34;asOfDateSimple&#34;:&#34;24 feb 2026&#34;,&#34;attrArray&#34;:[{&#34;name&#34;:{&#34;value&#34;:&#34;United States&#34;},&#34;weight&#34;:{&#34;originalValue&#34;:&#34;99.0&#34;}}]}" />
      </body></html>
    `;
    mocks.getText.mockImplementation(async (url: string) => {
      if (url.includes("/nl/en/")) return englishHtml;
      throw new Error("not found");
    });

    const result = await spdrAdapter.fetchExposure(
      {
        issuer: "SPDR",
        isin: "IE00BJ38QD84",
        locale: "nl",
        productUrl: "https://www.ssga.com/nl/nl/intermediary/etfs/state-street-spdr-russell-2000-us-small-cap-ucits-etf-acc-zprr-gy",
        pageHtml: `
          <html><body>
            <div>ISIN: IE00BJ38QD84</div>
            <input type="hidden" id="fund-sector-breakdown" value="{&#34;attrArray&#34;:[{&#34;name&#34;:{&#34;value&#34;:&#34;Gesundheitswesen&#34;},&#34;weight&#34;:{&#34;originalValue&#34;:&#34;12.0&#34;}}]}" />
          </body></html>
        `
      },
      createHints({
        isin: "IE00BJ38QD84"
      })
    );

    expect(result.sourceMeta.productUrl).toContain("/nl/en/");
    expect(result.payload.sector.some((row) => row.sector === "Health Care")).toBe(true);
    expect(result.payload.sector.some((row) => row.sector === "Gesundheitswesen")).toBe(false);
  });

  it("uses PDF fallback when geo section is missing and factsheet URL exists", async () => {
    const html = await readFixture("spdr-sector-only.html");
    mocks.getBytes.mockResolvedValue(Buffer.from("fake-pdf"));
    mocks.parsePdf.mockResolvedValue({
      asOfDate: new Date("2026-02-20T00:00:00.000Z"),
      payload: {
        country: [{ country: "US", weight: 1 }],
        sector: [{ sector: "Information Technology", weight: 0.3 }]
      },
      sourceMeta: { parser: "factsheet-text" }
    });

    const result = await spdrAdapter.fetchExposure(
      {
        issuer: "SPDR",
        isin: "IE00SPDR00002",
        locale: "uk",
        productUrl: "https://example.com/spdr",
        factsheetUrl: "/factsheet.pdf",
        pageHtml: html
      },
      createHints({
        isin: "IE00SPDR00002"
      })
    );

    expect(mocks.getBytes).toHaveBeenCalledTimes(1);
    expect(mocks.parsePdf).toHaveBeenCalledTimes(1);
    expect(result.payload.country).toEqual([{ country: "US", weight: 1 }]);
    expect(result.sourceMeta.parsingMode).toBe("PDF");
  });
});
