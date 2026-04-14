import { parse } from "csv-parse/sync";
import { parse as parseDate } from "date-fns";

export type DegiroTransaction = {
  tradeAt: Date;
  product: string;
  isin: string;
  orderId: string | null;
  exchange: string;
  quantity: number;
  price: number | null;
  valueEur: number | null;
  totalEur: number | null;
  currency: string;
  raw: Record<string, string>;
};

// Converts Dutch-formatted numeric text (comma decimals, optional thousand separators) to numbers.
function normalizeDecimal(input: string | undefined) {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\./g, "").replace(/,/g, ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

// Parses DeGiro date+time columns into a single trade timestamp.
function parseTradeDate(dateValue: string, timeValue?: string) {
  const dateStr = dateValue.trim();
  const timeStr = (timeValue || "00:00").trim();
  const parsed = parseDate(`${dateStr} ${timeStr}`, "dd-MM-yyyy HH:mm", new Date());
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function findHeaderValue(row: Record<string, string>, headerAlias: string) {
  const normalizedAlias = headerAlias.replace(/\s+/g, "").toLowerCase();
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = key.replace(/\s+/g, "").toLowerCase();
    if (normalizedKey === normalizedAlias) return value;
  }
  return "";
}

// Transforms a DeGiro CSV export into normalized transaction rows used by the import pipeline.
export function parseDegiroCsv(csv: string): DegiroTransaction[] {
  const records = parse(csv, {
    bom: true,
    columns: true,
    relax_column_count: true,
    skip_records_with_error: true,
    skip_empty_lines: true,
    trim: true
  }) as Record<string, string>[];

  return records
    .map((row) => {
      const dateRaw = row["Datum"] || row["Datum "] || "";
      const timeRaw = row["Tijd"] || "";
      const tradeAt = parseTradeDate(dateRaw, timeRaw);
      const exchange = (row["Beurs"] || "UNKNOWN").trim() || "UNKNOWN";
      const quantity = normalizeDecimal(row["Aantal"]);
      const price = normalizeDecimal(row["Koers"]);
      const valueEur = normalizeDecimal(row["Waarde EUR"] ?? row["Waarde EUR "]);
      const totalEur = normalizeDecimal(row["Totaal EUR"] ?? row["Totaal EUR "]);
      const product = row["Product"] || "";
      const isin = row["ISIN"] || "";
      const orderId = findHeaderValue(row, "Order ID").trim() || null;
      const currency = row["Valuta"] || "EUR";

      if (!tradeAt || !isin || !product || quantity === null) return null;

      return {
        tradeAt,
        product,
        isin,
        orderId,
        exchange,
        quantity,
        price,
        valueEur,
        totalEur,
        currency,
        raw: row
      } as DegiroTransaction;
    })
    .filter(Boolean) as DegiroTransaction[];
}
