import { describe, expect, it } from "vitest";
import { parseDegiroCsv } from "@/lib/import/degiroCsv";

describe("parseDegiroCsv", () => {
  it("parses Order ID when present", () => {
    const csv = [
      "Datum,Tijd,Product,ISIN,Beurs,Aantal,Koers,Waarde EUR,Totaal EUR,Valuta,Order ID",
      "01-03-2026,10:30,Sample ETF,IE00B4L5Y983,XAMS,2,100,200,200,EUR,ABC-123"
    ].join("\n");

    const rows = parseDegiroCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].orderId).toBe("ABC-123");
  });

  it("returns null orderId when Order ID is empty", () => {
    const csv = [
      "Datum,Tijd,Product,ISIN,Beurs,Aantal,Koers,Waarde EUR,Totaal EUR,Valuta,Order ID",
      "01-03-2026,10:30,Sample ETF,IE00B4L5Y983,XAMS,2,100,200,200,EUR,"
    ].join("\n");

    const rows = parseDegiroCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].orderId).toBeNull();
  });
});
