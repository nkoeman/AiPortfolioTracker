import { describe, expect, it } from "vitest";
import {
  buildFallbackTransactionKey,
  buildImportIdentity,
  normalizeOrderId
} from "@/lib/import/transactionIdentity";

describe("transactionIdentity", () => {
  it("prefers Order ID when available", () => {
    const identity = buildImportIdentity({
      orderId: "  ORD-001 ",
      tradeAt: new Date("2026-03-01T09:30:00.000Z"),
      isin: "IE00B4L5Y983",
      quantity: 2
    });

    expect(identity.type).toBe("ORDER_ID");
    expect(identity.orderId).toBe("ORD-001");
    expect(identity.key).toBe("ORDER_ID|ORD-001");
  });

  it("uses fallback identity when Order ID is missing", () => {
    const tradeAt = new Date("2026-03-01T09:30:00.000Z");
    const identity = buildImportIdentity({
      orderId: null,
      tradeAt,
      isin: "ie00b4l5y983",
      quantity: 2
    });

    expect(identity.type).toBe("FALLBACK");
    expect(identity.orderId).toBeNull();
    expect(identity.key).toBe(
      buildFallbackTransactionKey(tradeAt, "IE00B4L5Y983", 2)
    );
  });

  it("normalizes empty and whitespace-only order ids to null", () => {
    expect(normalizeOrderId("")).toBeNull();
    expect(normalizeOrderId("   ")).toBeNull();
  });
});
