const EODHD_BASE_URL = process.env.EODHD_BASE_URL || "https://eodhd.com/api";

type RawSearchRecord = {
  Code?: string;
  code?: string;
  Symbol?: string;
  symbol?: string;
  Exchange?: string;
  exchange?: string;
  ExchangeCode?: string;
  exchange_code?: string;
  Currency?: string;
  currency?: string;
  ISIN?: string;
  isin?: string;
  [key: string]: unknown;
};

type EodhdHistoricalRow = {
  date: string;
  adjusted_close?: number | string;
  adj_close?: number | string;
  close?: number | string;
  [key: string]: unknown;
};

export type EodhdListingCandidate = {
  eodhdCode: string;
  exchangeName: string;
  exchangeCode: string;
  currency: string | null;
};

export type HistoricalPricePoint = {
  date: string;
  adjClose: number;
  close?: number | null;
};

// Reads and validates the EODHD API key so upstream calls fail fast when credentials are missing.
function getApiKey() {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) {
    throw new Error("EODHD_API_KEY is not configured.");
  }
  return apiKey;
}

// Builds authenticated EODHD request URLs with consistent JSON response formatting.
function buildUrl(path: string, query?: Record<string, string>) {
  const url = new URL(path, `${EODHD_BASE_URL}/`);
  const apiToken = getApiKey();
  url.searchParams.set("api_token", apiToken);
  url.searchParams.set("fmt", "json");

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

type RequestOptions = {
  timeoutMs?: number;
};

// Executes a GET request against EODHD and throws rich errors for non-2xx responses.
async function requestJson<T>(
  path: string,
  query?: Record<string, string>,
  options: RequestOptions = {}
) {
  const url = buildUrl(path, query);
  const timeoutMs = options.timeoutMs;
  const controller = timeoutMs ? new AbortController() : null;
  const timeoutId =
    controller && timeoutMs
      ? setTimeout(() => {
          controller.abort();
        }, timeoutMs)
      : null;

  let res: Response;
  try {
    res = await fetch(url, {
      cache: "no-store",
      signal: controller ? controller.signal : undefined
    });
  } catch (error) {
    if (controller?.signal.aborted) {
      throw new Error(`EODHD request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`EODHD request failed (${res.status}): ${body || "no response body"}`);
  }

  return (await res.json()) as T;
}

// Normalizes provider search rows into a stable listing candidate shape used by mapping logic.
function normalizeCandidate(record: RawSearchRecord): EodhdListingCandidate | null {
  const exchangeName = String(record.Exchange || record.exchange || "").trim();
  const exchangeCode = String(record.ExchangeCode || record.exchange_code || "").trim().toUpperCase();
  const symbol = String(record.Code || record.code || record.Symbol || record.symbol || "").trim().toUpperCase();
  const currencyRaw = String(record.Currency || record.currency || "").trim().toUpperCase();

  if (!symbol) return null;

  const resolvedExchange = exchangeCode || exchangeName.trim().toUpperCase().replace(/\s+/g, "_");
  const eodhdCode = symbol.includes(".") ? symbol : resolvedExchange ? `${symbol}.${resolvedExchange}` : symbol;

  return {
    eodhdCode,
    exchangeName: exchangeName || resolvedExchange || "UNKNOWN",
    exchangeCode: resolvedExchange || "UNKNOWN",
    currency: currencyRaw || null
  };
}

function parseHistoricalAdjustedClose(payload: unknown): HistoricalPricePoint[] {
  if (!Array.isArray(payload)) return [];

  return payload
    .map((row) => {
      const typed = row as EodhdHistoricalRow;
      const rawAdj = typed.adjusted_close ?? typed.adj_close ?? typed.close;
      const adjClose = Number(rawAdj);
      if (!typed.date || !Number.isFinite(adjClose)) return null;
      const closeValueRaw = typed.close;
      const closeValue =
        closeValueRaw === undefined || closeValueRaw === null
          ? null
          : Number(closeValueRaw);
      const point: HistoricalPricePoint = { date: typed.date, adjClose };
      if (Number.isFinite(closeValue)) {
        point.close = closeValue;
      }
      return point;
    })
    .filter(Boolean) as HistoricalPricePoint[];
}

export class EodhdClient {
  // Retrieves possible exchange listings for an ISIN and removes duplicate full EODHD codes.
  async searchByIsin(isin: string): Promise<EodhdListingCandidate[]> {
    const payload = await requestJson<RawSearchRecord[]>(`search/${encodeURIComponent(isin)}`);
    if (!Array.isArray(payload)) return [];

    const dedupe = new Map<string, EodhdListingCandidate>();
    for (const row of payload) {
      const candidate = normalizeCandidate(row);
      if (!candidate) continue;
      if (!dedupe.has(candidate.eodhdCode)) {
        dedupe.set(candidate.eodhdCode, candidate);
      }
    }

    return Array.from(dedupe.values());
  }

  // Fetches historical EOD prices and converts them to date + adjusted close points for storage.
  async getHistoricalAdjustedClose(
    code: string,
    from: string,
    to: string,
    period: "d" | "w" = "d",
    options: RequestOptions = {}
  ): Promise<HistoricalPricePoint[]> {
    const payload = await requestJson<EodhdHistoricalRow[]>(
      `eod/${encodeURIComponent(code)}`,
      {
        from,
        to,
        period,
        order: "a"
      },
      options
    );

    return parseHistoricalAdjustedClose(payload);
  }

  // Weekly prices use the provider's week-ending date as the canonical storage key.
  async getHistoricalWeeklyAdjustedClose(code: string, from: string, to: string): Promise<HistoricalPricePoint[]> {
    return this.getHistoricalAdjustedClose(code, from, to, "w");
  }
}

export const eodhdClient = new EodhdClient();

export const __testables = {
  parseHistoricalAdjustedClose
};
