import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { comgestAdapter } from "@/lib/etf/issuers/comgestAdapter";

function createHints(overrides: Partial<Parameters<typeof comgestAdapter.fetchExposure>[1]> = {}) {
  return {
    instrumentId: "inst_comgest",
    isin: "IE00COMGEST01",
    name: "Comgest Growth",
    displayName: "Comgest Growth",
    issuer: "Comgest",
    securityType: "FUND",
    securityType2: "FUND",
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

describe("comgestAdapter", () => {
  it("parses sector + country from english page content", async () => {
    const html = await readFixture("comgest-sample.html");
    const result = await comgestAdapter.fetchExposure(
      {
        issuer: "COMGEST",
        isin: "IE00COMGEST01",
        locale: "en",
        productUrl: "https://example.com/comgest",
        pageHtml: html
      },
      createHints()
    );

    expect(result.payload.country.length).toBeGreaterThan(0);
    expect(result.payload.sector.length).toBeGreaterThan(0);
    expect(result.sourceMeta.parsingMode).toBe("HTML");
  });
});
