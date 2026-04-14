import crypto from "crypto";

// Creates a deterministic fingerprint so duplicate transaction rows are ignored on import or manual entry.
export function buildTransactionUniqueKey(
  userId: string,
  isin: string,
  exchangeCode: string,
  tradeAt: Date,
  quantity: number,
  price: number | null,
  totalEur: number | null,
  productName: string,
  transactionCosts: number | null = null,
  sourceIdentity: string | null = null
) {
  const raw = [
    userId,
    isin,
    exchangeCode,
    tradeAt.toISOString(),
    quantity,
    price ?? "",
    totalEur ?? "",
    productName,
    transactionCosts ?? "",
    sourceIdentity ?? ""
  ].join("|");

  return crypto.createHash("sha256").update(raw).digest("hex");
}
