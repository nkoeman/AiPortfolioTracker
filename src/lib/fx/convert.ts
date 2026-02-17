import { prisma } from "@/lib/prisma";

type GetFxRateOptions = {
  allowPriorFallback?: boolean;
};

function normalizeCurrency(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase();
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

// Stored FX rows follow ECB direction: 1 EUR = X quote currency.
// Valuation needs quote->EUR multipliers, so we invert: quote_to_EUR = 1 / (EUR_to_quote).
export async function getFxRateForWeek(
  weekEndDate: Date,
  currency: string,
  options: GetFxRateOptions = {}
): Promise<number> {
  const normalizedCurrency = normalizeCurrency(currency);
  if (normalizedCurrency === "EUR") return 1;

  const allowPriorFallback = options.allowPriorFallback ?? true;
  const targetDate = toIsoDate(weekEndDate);

  const fxRow = await prisma.fxRate.findFirst({
    where: {
      base: "EUR",
      quote: normalizedCurrency,
      ...(allowPriorFallback
        ? { weekEndDate: { lte: weekEndDate } }
        : { weekEndDate })
    },
    orderBy: { weekEndDate: "desc" }
  });

  if (!fxRow) {
    throw new Error(`Missing FX rate for ${normalizedCurrency} on ${targetDate}`);
  }

  const fxWeek = toIsoDate(fxRow.weekEndDate);
  if (allowPriorFallback && fxWeek !== targetDate) {
    console.warn("[FX][FALLBACK] using prior weekly FX row", {
      currency: normalizedCurrency,
      requestedWeekEndDate: targetDate,
      fxWeekEndDate: fxWeek,
      observedDate: toIsoDate(fxRow.observedDate)
    });
  }

  const eurToQuote = Number(fxRow.rate);
  if (!Number.isFinite(eurToQuote) || eurToQuote <= 0) {
    throw new Error(`Invalid FX rate for ${normalizedCurrency} on ${fxWeek}`);
  }

  return 1 / eurToQuote;
}
