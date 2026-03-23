import { MappingStatus, Prisma } from "@prisma/client";
import { resolveMicFromBeurs } from "@/lib/brokers/degiro/beursToMic";
import { eodhdClient, EodhdListingCandidate } from "@/lib/eodhd/client";
import { ensureEodhdExchangeDirectoryLoaded } from "@/lib/eodhd/exchanges";
import { resolveEodhdExchangeFromMic } from "@/lib/exchange/micToEodhdExchange";
import { eodhdSuffixFromCode } from "@/lib/exchange/normalization";
import { logMap } from "@/lib/logging/mapping";
import { prisma } from "@/lib/prisma";

type ResolveParams = {
  userId: string;
  isin: string;
  productName: string;
  degiroBeursCode: string;
  transactionCurrency: string;
};

type ResolveSelectedExchangeParams = {
  userId: string;
  isin: string;
  productName: string;
  eodhdExchangeCode: string;
  transactionCurrency: string;
};

type MappingContext = {
  userId: string;
  isin: string;
  productName: string;
  degiroBeursCode: string;
  mic: string | null;
  targetExchangeCode: string | null;
  candidates: string[];
};

type SelectionReason = "EXACT" | "COUNTRY" | "CURRENCY" | "NONE";
type SelectionConfidence = "HIGH" | "MEDIUM" | "LOW";

type ExchangeDirectoryEntry = {
  code: string;
  country: string | null;
  currency: string | null;
};

// Creates a deterministic fallback exchange key when MIC/EODHD resolution fails before we know an EODHD code.
function buildFailedExchangeKey(beursCode: string) {
  const cleaned = beursCode.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  return `UNKNOWN_${cleaned || "BEURS"}`;
}

function normalizeValue(value: string | null | undefined) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || null;
}

function firstOperatingMic(value: string | null | undefined) {
  const normalized = normalizeValue(value);
  if (!normalized) return null;

  const [first] = normalized.split(/[,\s|/]+/).filter(Boolean);
  return first || null;
}

function candidateExchangeCode(candidate: EodhdListingCandidate) {
  return (
    normalizeValue(candidate.exchangeCode) ||
    normalizeValue(eodhdSuffixFromCode(candidate.eodhdCode)) ||
    null
  );
}

function buildExchangeDirectoryMap(entries: ExchangeDirectoryEntry[]) {
  const map = new Map<string, ExchangeDirectoryEntry>();
  for (const entry of entries) {
    const code = normalizeValue(entry.code);
    if (!code) continue;
    map.set(code, {
      ...entry,
      code
    });
  }
  return map;
}

type CandidateMeta = {
  candidate: EodhdListingCandidate;
  exchangeCode: string;
  suffix: string | null;
  currency: string | null;
  country: string | null;
  completenessScore: number;
  hasExchangeDirectory: boolean;
};

function scoreCandidate(meta: CandidateMeta) {
  const hasFullCode = meta.candidate.eodhdCode.includes(".");
  const hasExchange = Boolean(meta.exchangeCode);
  const hasCurrency = Boolean(meta.currency);
  const hasCountry = Boolean(meta.country);
  return (
    (hasFullCode ? 1 : 0) +
    (hasExchange ? 1 : 0) +
    (hasCurrency ? 1 : 0) +
    (hasCountry ? 1 : 0)
  );
}

function buildCandidateMeta(
  candidates: EodhdListingCandidate[],
  exchangeDirectory: Map<string, ExchangeDirectoryEntry>
) {
  return candidates.map((candidate) => {
    const suffix = normalizeValue(eodhdSuffixFromCode(candidate.eodhdCode));
    const exchangeCode = candidateExchangeCode(candidate) || "";
    const currency = normalizeValue(candidate.currency);
    const country = normalizeValue(exchangeDirectory.get(exchangeCode)?.country || null);
    const meta: CandidateMeta = {
      candidate,
      exchangeCode,
      suffix,
      currency,
      country,
      completenessScore: 0,
      hasExchangeDirectory: exchangeDirectory.has(exchangeCode)
    };
    meta.completenessScore = scoreCandidate(meta);
    return meta;
  });
}

function compareCandidates(
  a: CandidateMeta,
  b: CandidateMeta,
  options: { listingCurrency: string | null; preferCurrency: boolean }
) {
  if (a.completenessScore !== b.completenessScore) {
    return b.completenessScore - a.completenessScore;
  }
  if (a.hasExchangeDirectory !== b.hasExchangeDirectory) {
    return a.hasExchangeDirectory ? -1 : 1;
  }
  if (options.preferCurrency && options.listingCurrency) {
    const aMatch = a.currency === options.listingCurrency;
    const bMatch = b.currency === options.listingCurrency;
    if (aMatch !== bMatch) return aMatch ? -1 : 1;
  }
  const aCode = a.candidate.eodhdCode.toUpperCase();
  const bCode = b.candidate.eodhdCode.toUpperCase();
  if (aCode !== bCode) return aCode < bCode ? -1 : 1;
  if (a.exchangeCode !== b.exchangeCode) {
    return a.exchangeCode < b.exchangeCode ? -1 : 1;
  }
  return 0;
}

type SelectionInput = {
  candidates: EodhdListingCandidate[];
  expectedSuffix: string;
  listingCountry: string | null;
  listingCurrency: string | null;
  exchangeDirectory: Map<string, ExchangeDirectoryEntry>;
};

export function selectBestEodhdCandidate(
  input: SelectionInput
): {
  candidate: EodhdListingCandidate | null;
  reason: SelectionReason;
  confidence: SelectionConfidence;
  matchedCountry?: string;
  matchedCurrency?: string;
} {
  const expectedSuffix = normalizeValue(input.expectedSuffix);
  const listingCountry = normalizeValue(input.listingCountry);
  const listingCurrency = normalizeValue(input.listingCurrency);
  const metas = buildCandidateMeta(input.candidates, input.exchangeDirectory);

  if (!metas.length) {
    return { candidate: null, reason: "NONE", confidence: "LOW" };
  }

  const exactMatches = expectedSuffix
    ? metas.filter((meta) => meta.suffix === expectedSuffix)
    : [];

  if (exactMatches.length) {
    const sorted = [...exactMatches].sort((a, b) =>
      compareCandidates(a, b, { listingCurrency, preferCurrency: true })
    );
    return { candidate: sorted[0].candidate, reason: "EXACT", confidence: "HIGH" };
  }

  if (listingCountry) {
    const countryMatches = metas.filter((meta) => meta.country === listingCountry);
    if (countryMatches.length) {
      const sorted = [...countryMatches].sort((a, b) =>
        compareCandidates(a, b, { listingCurrency, preferCurrency: true })
      );
      return {
        candidate: sorted[0].candidate,
        reason: "COUNTRY",
        confidence: "MEDIUM",
        matchedCountry: listingCountry
      };
    }
  }

  if (listingCurrency) {
    const currencyMatches = metas.filter((meta) => meta.currency === listingCurrency);
    if (currencyMatches.length) {
      const sorted = [...currencyMatches].sort((a, b) =>
        compareCandidates(a, b, { listingCurrency, preferCurrency: false })
      );
      return {
        candidate: sorted[0].candidate,
        reason: "CURRENCY",
        confidence: "MEDIUM",
        matchedCurrency: listingCurrency
      };
    }
  }

  const sorted = [...metas].sort((a, b) =>
    compareCandidates(a, b, { listingCurrency, preferCurrency: true })
  );
  return {
    candidate: sorted[0].candidate,
    reason: "NONE",
    confidence: "LOW"
  };
}

// Persists a FAILED listing record so imports keep auditability even when automatic mapping cannot resolve a symbol.
async function markListingFailed(
  isin: string,
  exchangeCode: string,
  degiroBeursCode: string,
  exchangeMic: string | null,
  mappingError: string
) {
  await prisma.instrumentListing.upsert({
    where: {
      isin_exchangeCode: {
        isin,
        exchangeCode
      }
    },
    update: {
      exchangeName: degiroBeursCode,
      exchangeMic,
      degiroBeursCode,
      mappingStatus: MappingStatus.FAILED,
      mappingError,
      lastMappedAt: new Date()
    },
    create: {
      isin,
      exchangeName: degiroBeursCode,
      exchangeCode,
      exchangeMic,
      degiroBeursCode,
      mappingStatus: MappingStatus.FAILED,
      mappingError,
      lastMappedAt: new Date()
    }
  });
}

// Persists mapped listings for all EODHD candidates, retaining the full symbol including exchange suffix.
export async function upsertListingsFromIsin(isin: string): Promise<EodhdListingCandidate[]> {
  const candidates = await eodhdClient.searchByIsin(isin);

  for (const candidate of candidates) {
    const exchangeCode = eodhdSuffixFromCode(candidate.eodhdCode) || candidate.exchangeCode || "UNKNOWN";

    const data: Prisma.InstrumentListingUncheckedCreateInput = {
      isin,
      exchangeName: candidate.exchangeName || exchangeCode,
      exchangeCode,
      eodhdCode: candidate.eodhdCode,
      currency: candidate.currency,
      mappingStatus: MappingStatus.MAPPED,
      mappingError: null,
      lastMappedAt: new Date()
    };

    await prisma.instrumentListing.upsert({
      where: {
        isin_exchangeCode: {
          isin,
          exchangeCode
        }
      },
      update: {
        exchangeName: data.exchangeName,
        eodhdCode: data.eodhdCode,
        currency: data.currency,
        mappingStatus: MappingStatus.MAPPED,
        mappingError: null,
        lastMappedAt: new Date()
      },
      create: data
    });
  }

  return candidates;
}

// Ensures each instrument has one primary listing used as fallback valuation source.
export async function ensurePrimaryListing(isin: string) {
  const hasPrimary = await prisma.instrumentListing.findFirst({
    where: { isin, isPrimary: true },
    select: { id: true }
  });

  if (hasPrimary) return;

  const firstMapped = await prisma.instrumentListing.findFirst({
    where: { isin, mappingStatus: MappingStatus.MAPPED },
    orderBy: { updatedAt: "desc" }
  });

  if (firstMapped) {
    await prisma.instrumentListing.update({
      where: { id: firstMapped.id },
      data: { isPrimary: true }
    });
  }
}

// Resolves and persists the listing for a transaction using DeGiro beurs -> MIC -> EODHD exchange -> candidate suffix.
export async function resolveOrCreateListingForTransaction(params: ResolveParams) {
  const { userId, isin, productName, degiroBeursCode, transactionCurrency } = params;
  const beursCode = degiroBeursCode.trim().toUpperCase() || "UNKNOWN";

  const mic = await resolveMicFromBeurs(beursCode);
  await ensureEodhdExchangeDirectoryLoaded();
  const targetExchangeCode = await resolveEodhdExchangeFromMic(mic);

  const context: MappingContext = {
    userId,
    isin,
    productName,
    degiroBeursCode: beursCode,
    mic,
    targetExchangeCode,
    candidates: []
  };

  logMap("MIC", "resolved beurs and exchange code", context);

  if (!mic || !targetExchangeCode) {
    const exchangeKey = targetExchangeCode || buildFailedExchangeKey(beursCode);
    const error = !mic
      ? `No curated MIC mapping found for DeGiro beurs code ${beursCode}`
      : `No EODHD exchange mapping found for MIC ${mic}`;

    logMap("FAIL", "mapping prerequisite missing", { ...context, error }, "error");
    await markListingFailed(isin, exchangeKey, beursCode, mic, error);
    return null;
  }

  const existing = await prisma.instrumentListing.findFirst({
    where: {
      isin,
      exchangeCode: targetExchangeCode,
      mappingStatus: MappingStatus.MAPPED,
      eodhdCode: { not: null }
    }
  });

  if (existing) {
    logMap("SELECT", "reused existing mapped listing", {
      ...context,
      listingId: existing.id,
      eodhdCode: existing.eodhdCode
    });
    return existing;
  }

  try {
    const candidates = await eodhdClient.searchByIsin(isin);
    context.candidates = candidates.map((candidate) => candidate.eodhdCode).slice(0, 20);

    logMap("EODHD", "candidates received", {
      ...context,
      candidateCount: candidates.length
    });

    if (!candidates.length) {
      const error = `No EODHD candidates returned for ISIN ${isin}`;
      logMap("FAIL", "no EODHD candidates returned", { ...context, error }, "error");
      await markListingFailed(isin, targetExchangeCode, beursCode, mic, error);
      return null;
    }

    const exchangeCodes = new Set<string>();
    exchangeCodes.add(targetExchangeCode.trim().toUpperCase());
    for (const candidate of candidates) {
      const exchangeCode = candidateExchangeCode(candidate);
      if (exchangeCode) exchangeCodes.add(exchangeCode);
    }

    const exchangeDirectoryRows = await prisma.eodhdExchange.findMany({
      where: { code: { in: Array.from(exchangeCodes) } },
      select: { code: true, country: true, currency: true }
    });
    const exchangeDirectory = buildExchangeDirectoryMap(exchangeDirectoryRows);
    const listingCountry = normalizeValue(exchangeDirectory.get(targetExchangeCode)?.country || null);
    const listingCurrency = normalizeValue(transactionCurrency);

    const selection = selectBestEodhdCandidate({
      candidates,
      expectedSuffix: targetExchangeCode,
      listingCountry,
      listingCurrency,
      exchangeDirectory
    });

    const selected = selection.candidate;
    if (!selected) {
      const error = `EODHD candidates returned but none could be selected for ISIN ${isin}`;
      logMap("FAIL", "candidate selection returned null", { ...context, error }, "error");
      await markListingFailed(isin, targetExchangeCode, beursCode, mic, error);
      return null;
    }

    if (selection.reason !== "EXACT") {
      logMap(
        "SELECT",
        "exact exchange match not found; using fallback selection",
        {
          ...context,
          reason: selection.reason,
          confidence: selection.confidence,
          matchedCountry: selection.matchedCountry || null,
          matchedCurrency: selection.matchedCurrency || null,
          selectedEodhdCode: selected.eodhdCode,
          selectedExchange: selected.exchangeCode
        },
        "warn"
      );
    }

    logMap("SELECT", "chosen candidate", {
      ...context,
      reason: selection.reason,
      confidence: selection.confidence,
      matchedCountry: selection.matchedCountry || null,
      matchedCurrency: selection.matchedCurrency || null,
      selectedEodhdCode: selected.eodhdCode,
      selectedExchange: selected.exchangeCode
    });

    const tieCount = candidates.filter(
      (candidate) => (eodhdSuffixFromCode(candidate.eodhdCode) || "") === targetExchangeCode
    ).length;

    if (tieCount > 1 && selection.reason === "EXACT") {
      logMap(
        "SELECT",
        "multiple candidates matched expected suffix; selected deterministically",
        {
          ...context,
          selectedEodhdCode: selected.eodhdCode,
          tieCount
        },
        "warn"
      );
    }

    const listing = await prisma.instrumentListing.upsert({
      where: {
        isin_exchangeCode: {
          isin,
          exchangeCode: targetExchangeCode
        }
      },
      update: {
        exchangeName: selected.exchangeName || beursCode,
        exchangeMic: mic,
        degiroBeursCode: beursCode,
        eodhdCode: selected.eodhdCode,
        currency: selected.currency,
        mappingStatus: MappingStatus.MAPPED,
        mappingError: null,
        lastMappedAt: new Date()
      },
      create: {
        isin,
        exchangeName: selected.exchangeName || beursCode,
        exchangeCode: targetExchangeCode,
        exchangeMic: mic,
        degiroBeursCode: beursCode,
        eodhdCode: selected.eodhdCode,
        currency: selected.currency,
        mappingStatus: MappingStatus.MAPPED,
        mappingError: null,
        lastMappedAt: new Date()
      }
    });

    logMap("SELECT", "chosen candidate", {
      ...context,
      listingId: listing.id,
      selectedEodhdCode: selected.eodhdCode
    });

    await ensurePrimaryListing(isin);
    return listing;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown listing mapping error";
    logMap("FAIL", "listing mapping threw an error", { ...context, error: message }, "error");

    await markListingFailed(
      isin,
      targetExchangeCode,
      beursCode,
      mic,
      `Automatic mapping failed: ${message}`
    );

    return null;
  }
}

// Resolves a listing from an explicitly selected EODHD exchange code instead of the DeGiro beurs mapping path.
export async function resolveOrCreateListingForSelectedExchange(
  params: ResolveSelectedExchangeParams
) {
  const { userId, isin, productName, eodhdExchangeCode, transactionCurrency } = params;
  const exchangeCode = normalizeValue(eodhdExchangeCode) || "UNKNOWN";

  const exchangeRow = await prisma.eodhdExchange.findUnique({
    where: { code: exchangeCode },
    select: {
      code: true,
      name: true,
      country: true,
      currency: true,
      operatingMICs: true
    }
  });

  const context: MappingContext = {
    userId,
    isin,
    productName,
    degiroBeursCode: exchangeCode,
    mic: firstOperatingMic(exchangeRow?.operatingMICs),
    targetExchangeCode: exchangeCode,
    candidates: []
  };

  if (!exchangeRow) {
    const error = `Selected EODHD exchange ${exchangeCode} was not found in the local exchange directory`;
    logMap("FAIL", "selected exchange missing from directory", { ...context, error }, "error");
    await markListingFailed(isin, exchangeCode, exchangeCode, null, error);
    return null;
  }

  const existing = await prisma.instrumentListing.findFirst({
    where: {
      isin,
      exchangeCode,
      mappingStatus: MappingStatus.MAPPED,
      eodhdCode: { not: null }
    }
  });

  if (existing) {
    logMap("SELECT", "reused existing mapped listing from selected exchange", {
      ...context,
      listingId: existing.id,
      eodhdCode: existing.eodhdCode
    });
    return existing;
  }

  try {
    const candidates = await eodhdClient.searchByIsin(isin);
    context.candidates = candidates.map((candidate) => candidate.eodhdCode).slice(0, 20);

    logMap("EODHD", "manual candidates received", {
      ...context,
      candidateCount: candidates.length
    });

    if (!candidates.length) {
      const error = `No EODHD candidates returned for ISIN ${isin}`;
      logMap("FAIL", "no EODHD candidates returned", { ...context, error }, "error");
      await markListingFailed(isin, exchangeCode, exchangeCode, context.mic, error);
      return null;
    }

    const selection = selectBestEodhdCandidate({
      candidates,
      expectedSuffix: exchangeCode,
      listingCountry: normalizeValue(exchangeRow.country),
      listingCurrency: normalizeValue(transactionCurrency) || normalizeValue(exchangeRow.currency),
      exchangeDirectory: buildExchangeDirectoryMap([
        {
          code: exchangeRow.code,
          country: exchangeRow.country,
          currency: exchangeRow.currency
        }
      ])
    });

    const selected = selection.candidate;
    const selectedExchangeCode = selected ? candidateExchangeCode(selected) : null;

    if (!selected || selection.reason !== "EXACT" || selectedExchangeCode !== exchangeCode) {
      const error = `No EODHD candidate matched selected exchange ${exchangeCode} for ISIN ${isin}`;
      logMap(
        "FAIL",
        "selected exchange could not be matched exactly",
        {
          ...context,
          error,
          selectionReason: selection.reason,
          selectedEodhdCode: selected?.eodhdCode || null,
          selectedExchangeCode
        },
        "warn"
      );
      await markListingFailed(isin, exchangeCode, exchangeCode, context.mic, error);
      return null;
    }

    const listing = await prisma.instrumentListing.upsert({
      where: {
        isin_exchangeCode: {
          isin,
          exchangeCode
        }
      },
      update: {
        exchangeName: selected.exchangeName || exchangeRow.name || exchangeCode,
        exchangeMic: context.mic,
        degiroBeursCode: null,
        eodhdCode: selected.eodhdCode,
        currency: selected.currency || exchangeRow.currency,
        mappingStatus: MappingStatus.MAPPED,
        mappingError: null,
        lastMappedAt: new Date()
      },
      create: {
        isin,
        exchangeName: selected.exchangeName || exchangeRow.name || exchangeCode,
        exchangeCode,
        exchangeMic: context.mic,
        degiroBeursCode: null,
        eodhdCode: selected.eodhdCode,
        currency: selected.currency || exchangeRow.currency,
        mappingStatus: MappingStatus.MAPPED,
        mappingError: null,
        lastMappedAt: new Date()
      }
    });

    logMap("SELECT", "manual exchange candidate chosen", {
      ...context,
      listingId: listing.id,
      selectedEodhdCode: selected.eodhdCode
    });

    await ensurePrimaryListing(isin);
    return listing;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown listing mapping error";
    logMap("FAIL", "manual listing mapping threw an error", { ...context, error: message }, "error");

    await markListingFailed(
      isin,
      exchangeCode,
      exchangeCode,
      context.mic,
      `Manual exchange mapping failed: ${message}`
    );

    return null;
  }
}

export const __testables = {
  buildFailedExchangeKey,
  selectBestEodhdCandidate,
  buildExchangeDirectoryMap,
  candidateExchangeCode
};
