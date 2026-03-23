import { describe, expect, it } from "vitest";
import { __testables } from "@/lib/ishares/isharesResolve";

describe("ishares resolver helpers", () => {
  it("extracts product rows from the product-search route html", () => {
    const html = `
      <table>
        <tr>
          <td class="links"><a href="/uk/individual/en/products/264659/ishares-msci-emerging-markets-imi-ucits-etf">EIMI</a></td>
          <td class="links"><a href="/uk/individual/en/products/264659/ishares-msci-emerging-markets-imi-ucits-etf">iShares Core MSCI EM IMI UCITS ETF</a></td>
        </tr>
        <tr>
          <td class="links"><a href="/uk/individual/en/products/251380/ishares-msci-emerging-markets-minimum-volatility-ucits-etf">EMIM</a></td>
          <td class="links"><a href="/uk/individual/en/products/251380/ishares-msci-emerging-markets-minimum-volatility-ucits-etf">iShares Edge MSCI EM Minimum Volatility UCITS ETF</a></td>
        </tr>
      </table>
    `;

    const rows = __testables.parseProductSearchRows(html);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      href: "/uk/individual/en/products/264659/ishares-msci-emerging-markets-imi-ucits-etf",
      ticker: "EIMI",
      name: "iShares Core MSCI EM IMI UCITS ETF"
    });
  });

  it("builds fallback terms from isin, ticker and product name", () => {
    const terms = __testables.buildFallbackTerms("IE00BKM4GZ66", {
      ticker: "EMIM",
      productName: "iShares Core MSCI EM IMI UCITS ETF USD Acc"
    });

    expect(terms).toContain("IE00BKM4GZ66");
    expect(terms).toContain("EMIM");
    expect(terms).toContain("MSCI EM IMI");
  });

  it("ranks search rows by ticker/name relevance", () => {
    const rows = [
      {
        href: "/uk/individual/en/products/251380/ishares-msci-emerging-markets-minimum-volatility-ucits-etf",
        ticker: "EMIM",
        name: "iShares Edge MSCI EM Minimum Volatility UCITS ETF"
      },
      {
        href: "/uk/individual/en/products/264659/ishares-msci-emerging-markets-imi-ucits-etf",
        ticker: "EIMI",
        name: "iShares Core MSCI EM IMI UCITS ETF"
      }
    ];

    const ranked = __testables.rankProductSearchRows(rows, {
      ticker: "EMIM",
      productName: "iShares Core MSCI EM IMI UCITS ETF USD Acc"
    });

    expect(ranked[0].href).toContain("/251380/");
    expect(ranked[1].href).toContain("/264659/");
  });
});
