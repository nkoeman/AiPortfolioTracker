import { prisma } from "@/lib/prisma";
import { logMap } from "@/lib/logging/mapping";

// Splits provider MIC strings on common separators and normalizes them for token-boundary matching.
function splitMicTokens(operatingMICs: string) {
  return operatingMICs
    .split(/[\s,;|]+/)
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean);
}

// Resolves an ISO MIC to a single EODHD exchange code using strict token matches to avoid substring false positives.
export async function resolveEodhdExchangeFromMic(mic: string | null | undefined): Promise<string | null> {
  const normalizedMic = String(mic || "").trim().toUpperCase();

  logMap("MIC", "resolving MIC -> EODHD exchange", { mic: normalizedMic || null });

  if (!normalizedMic) {
    return null;
  }

  const candidates = await prisma.eodhdExchange.findMany({
    where: {
      operatingMICs: {
        contains: normalizedMic
      }
    },
    orderBy: { code: "asc" }
  });

  const exactMatches = candidates.filter((candidate) => splitMicTokens(candidate.operatingMICs).includes(normalizedMic));

  if (!exactMatches.length) {
    logMap("MIC", "no EODHD exchange match for MIC", { mic: normalizedMic }, "warn");
    return null;
  }

  if (exactMatches.length > 1) {
    logMap(
      "MIC",
      "ambiguous MIC -> EODHD exchange mapping; refusing automatic resolution",
      {
        mic: normalizedMic,
        candidateExchangeCodes: exactMatches.map((row) => row.code)
      },
      "error"
    );
    return null;
  }

  return exactMatches[0].code;
}

export const __testables = {
  splitMicTokens
};