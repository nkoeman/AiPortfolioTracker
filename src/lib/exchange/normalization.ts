const EXCHANGE_MAP: Record<string, string> = {
  "euronext amsterdam": "AS",
  "amsterdam": "AS",
  "xams": "AS",
  "aex": "AS",
  "xetra": "DE",
  "xetr": "DE",
  "etr": "DE",
  "frankfurt": "DE",
  "nasdaq": "US",
  "nasdaq gs": "US",
  "nasdaq gm": "US",
  "nyse": "US",
  "arca": "US",
  "bats": "US",
  "euronext paris": "PA",
  "paris": "PA",
  "xpar": "PA",
  "london stock exchange": "LSE",
  "london": "LSE",
  "xlon": "LSE",
  "milan": "MI",
  "xmilan": "MI",
  "milan stock exchange": "MI"
};

// Normalizes raw broker exchange labels into stable internal exchange codes.
export function normalizeExchangeCode(exchangeName: string | null | undefined): string {
  if (!exchangeName) return "UNKNOWN";
  const normalized = exchangeName.trim().toLowerCase();
  if (!normalized) return "UNKNOWN";
  return EXCHANGE_MAP[normalized] || normalized.toUpperCase().replace(/\s+/g, "_");
}

// Extracts the exchange suffix from a full EODHD code like VWCE.AS.
export function eodhdSuffixFromCode(eodhdCode: string | null | undefined): string | null {
  if (!eodhdCode) return null;
  const parts = eodhdCode.split(".");
  if (parts.length < 2) return null;
  return parts[parts.length - 1].toUpperCase();
}
