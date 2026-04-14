export type ImportIdentity =
  | { type: "ORDER_ID"; key: string; orderId: string }
  | { type: "FALLBACK"; key: string; orderId: null };

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeOrderId(orderId: string | null | undefined) {
  if (!orderId) return null;
  const normalized = normalizeWhitespace(orderId);
  return normalized.length ? normalized : null;
}

export function toQuantityKey(quantity: number) {
  return Number(quantity).toFixed(8);
}

export function buildFallbackTransactionKey(tradeAt: Date, isin: string, quantity: number) {
  return `FALLBACK|${tradeAt.getTime()}|${isin.trim().toUpperCase()}|${toQuantityKey(quantity)}`;
}

export function buildImportIdentity(params: {
  orderId?: string | null;
  tradeAt: Date;
  isin: string;
  quantity: number;
}): ImportIdentity {
  const normalizedOrderId = normalizeOrderId(params.orderId);
  if (normalizedOrderId) {
    return {
      type: "ORDER_ID",
      key: `ORDER_ID|${normalizedOrderId}`,
      orderId: normalizedOrderId
    };
  }

  return {
    type: "FALLBACK",
    key: buildFallbackTransactionKey(params.tradeAt, params.isin, params.quantity),
    orderId: null
  };
}
