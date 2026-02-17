export type PriceQuote = {
  isin: string;
  exchange: string;
  date: Date;
  close: number;
  currency: "EUR";
  isMock: true;
};

export interface PriceService {
  getLatestPrice(isin: string, exchange: string): Promise<PriceQuote | null>;
  getPriceOnDate(isin: string, exchange: string, date: Date): Promise<PriceQuote | null>;
}

// Builds a deterministic integer hash so mock prices are stable per instrument+exchange.
function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Generates a pseudo market price curve used only when real providers are unavailable.
function mockPriceFor(isin: string, exchange: string, date: Date) {
  const base = 40 + (hashString(`${isin}|${exchange}`) % 120);
  const dayFactor = (date.getTime() / 86400000) % 30;
  const wiggle = Math.sin(dayFactor) * 2;
  return Math.max(1, base + wiggle);
}

export class MockPriceService implements PriceService {
  // Returns a synthetic latest quote for local development and fallback scenarios.
  async getLatestPrice(isin: string, exchange: string): Promise<PriceQuote> {
    const date = new Date();
    return {
      isin,
      exchange,
      date,
      close: Number(mockPriceFor(isin, exchange, date).toFixed(2)),
      currency: "EUR",
      isMock: true
    };
  }

  // Returns a synthetic historical quote for charting and P&L math in mock mode.
  async getPriceOnDate(isin: string, exchange: string, date: Date): Promise<PriceQuote> {
    return {
      isin,
      exchange,
      date,
      close: Number(mockPriceFor(isin, exchange, date).toFixed(2)),
      currency: "EUR",
      isMock: true
    };
  }
}

export const priceService: PriceService = new MockPriceService();

// TODO: Replace MockPriceService with a real provider (e.g. Alpha Vantage, Stooq, or a paid feed).
// TODO: Add ISIN -> symbol + exchange mapping and caching strategy.
