import { prisma } from "@/lib/prisma";
import { logMap } from "@/lib/logging/mapping";

const EODHD_BASE_URL = process.env.EODHD_BASE_URL || "https://eodhd.com/api";

type RawExchange = {
  Code?: string;
  code?: string;
  Name?: string;
  name?: string;
  OperatingMIC?: string;
  operating_mic?: string;
  OperatingMICs?: string;
  operating_mics?: string;
  Country?: string;
  country?: string;
  Currency?: string;
  currency?: string;
  [key: string]: unknown;
};

export type EodhdExchangeRecord = {
  code: string;
  name: string | null;
  operatingMICs: string;
  country: string | null;
  currency: string | null;
};

// Builds authenticated EODHD endpoint URLs for exchange directory sync requests.
function buildUrl(path: string) {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) {
    throw new Error("EODHD_API_KEY is not configured.");
  }

  const url = new URL(path, `${EODHD_BASE_URL}/`);
  url.searchParams.set("api_token", apiKey);
  url.searchParams.set("fmt", "json");
  return url.toString();
}

// Converts raw exchange records from EODHD into a normalized shape for local persistence.
function normalizeExchange(record: RawExchange): EodhdExchangeRecord | null {
  const code = String(record.Code || record.code || "").trim().toUpperCase();
  // EODHD currently returns OperatingMIC (singular), with plural keys seen in some examples.
  const operatingMICs = String(
    record.OperatingMIC || record.operating_mic || record.OperatingMICs || record.operating_mics || ""
  )
    .trim()
    .toUpperCase();

  if (!code || !operatingMICs) {
    return null;
  }

  return {
    code,
    name: String(record.Name || record.name || "").trim() || null,
    operatingMICs,
    country: String(record.Country || record.country || "").trim() || null,
    currency: String(record.Currency || record.currency || "").trim().toUpperCase() || null
  };
}

// Downloads the full EODHD exchange directory used for MIC -> EODHD exchange-code resolution.
export async function fetchEodhdExchanges(): Promise<EodhdExchangeRecord[]> {
  const url = buildUrl("exchanges-list");
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`EODHD exchanges-list failed (${response.status}): ${body || "no response body"}`);
  }

  const payload = (await response.json()) as RawExchange[];
  if (!Array.isArray(payload)) {
    return [];
  }

  const deduped = new Map<string, EodhdExchangeRecord>();
  for (const row of payload) {
    const normalized = normalizeExchange(row);
    if (!normalized) continue;
    if (!deduped.has(normalized.code)) {
      deduped.set(normalized.code, normalized);
    }
  }

  return Array.from(deduped.values());
}

// Upserts the remote exchange directory locally so mapping can resolve MIC values deterministically.
export async function upsertEodhdExchanges() {
  const exchanges = await fetchEodhdExchanges();

  for (const exchange of exchanges) {
    await prisma.eodhdExchange.upsert({
      where: { code: exchange.code },
      update: {
        name: exchange.name,
        operatingMICs: exchange.operatingMICs,
        country: exchange.country,
        currency: exchange.currency
      },
      create: exchange
    });
  }

  logMap("EODHD", "exchange directory synced", {
    fetchedCount: exchanges.length,
    upsertedCount: exchanges.length
  });

  return {
    fetched: exchanges.length,
    upserted: exchanges.length
  };
}

// Ensures exchange directory data exists before MIC resolution by doing a lazy one-time refresh if needed.
export async function ensureEodhdExchangeDirectoryLoaded() {
  const cachedCount = await prisma.eodhdExchange.count();
  if (cachedCount > 0) {
    return { cachedCount, refreshed: false };
  }

  logMap("EODHD", "exchange directory cache empty, triggering lazy refresh", { cachedCount }, "warn");
  await upsertEodhdExchanges();
  return { cachedCount: 0, refreshed: true };
}