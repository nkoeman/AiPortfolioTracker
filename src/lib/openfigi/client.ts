const OPENFIGI_BASE_URL = process.env.OPENFIGI_BASE_URL || "https://api.openfigi.com/v3/mapping";
const MAX_RETRIES = 3;

export type OpenFigiCandidate = {
  name?: string;
  figi?: string;
  compositeFIGI?: string;
  securityType?: string;
  securityType2?: string;
  marketSector?: string;
  assetClass?: string;
  issuer?: string;
  country?: string;
  ticker?: string;
  exchCode?: string;
  micCode?: string;
  [key: string]: unknown;
};

export type OpenFigiMappingItem = {
  data?: OpenFigiCandidate[];
  error?: string;
  warning?: string;
};

export type OpenFigiMappingResult = {
  isin: string;
  candidates: OpenFigiCandidate[];
  error: string | null;
  warning: string | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeValue(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase();
}

// OpenFIGI mapping endpoint accepts batched requests:
// [{ idType: "ID_ISIN", idValue: "<ISIN>" }, ...]
function buildPayload(isins: string[]) {
  return isins.map((isin) => ({
    idType: "ID_ISIN",
    idValue: isin
  }));
}

export function selectOpenFigiCandidate(
  candidates: OpenFigiCandidate[],
  preferredMic: string | null
): { candidate: OpenFigiCandidate | null; warning: string | null } {
  if (!candidates.length) {
    return { candidate: null, warning: null };
  }

  const normalizedMic = normalizeValue(preferredMic);
  if (normalizedMic) {
    const micMatches = candidates.filter(
      (candidate) => normalizeValue(candidate.micCode as string | undefined) === normalizedMic
    );
    if (micMatches.length > 0) {
      const warning = micMatches.length > 1 ? `Multiple OpenFIGI candidates matched MIC ${normalizedMic}` : null;
      return { candidate: micMatches[0], warning };
    }
  }

  const warning = candidates.length > 1 ? "Multiple OpenFIGI candidates returned; using first result" : null;
  return { candidate: candidates[0], warning };
}

export async function mapIsins(isins: string[]): Promise<OpenFigiMappingResult[]> {
  if (!isins.length) return [];

  const apiKey = process.env.OPENFIGI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENFIGI_API_KEY is not configured.");
  }

  const payload = buildPayload(isins);
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(OPENFIGI_BASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-OPENFIGI-APIKEY": apiKey
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`OpenFIGI request failed (${response.status}): ${body || "no response body"}`);
      }

      const raw = (await response.json()) as OpenFigiMappingItem[];
      return raw.map((item, idx) => ({
        isin: isins[idx],
        candidates: Array.isArray(item?.data) ? item.data : [],
        error: item?.error || null,
        warning: item?.warning || null
      }));
    } catch (error) {
      lastError = error;
      if (attempt >= MAX_RETRIES) break;
      await sleep(250 * 2 ** (attempt - 1));
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Unable to fetch OpenFIGI results after ${MAX_RETRIES} attempts: ${message}`);
}

export const __testables = {
  buildPayload,
  selectOpenFigiCandidate
};
