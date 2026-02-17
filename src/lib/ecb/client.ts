const ECB_BASE_URL = process.env.ECB_BASE_URL || "https://data-api.ecb.europa.eu/service/data";
const ECB_FLOW_REF = "EXR";
const MAX_RETRIES = 3;

export type EcbDailyFxPoint = {
  date: string;
  rate: number;
};

type EcbSeries = {
  observations?: Record<string, unknown[]>;
};

type EcbPayload = {
  dataSets?: Array<{
    series?: Record<string, EcbSeries>;
  }>;
  structure?: {
    dimensions?: {
      observation?: Array<{
        id?: string;
        values?: Array<{ id?: string }>;
      }>;
    };
  };
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeCurrency(value: string) {
  return value.trim().toUpperCase();
}

// ECB SDMX key format used here: EXR.D.{QUOTE}.EUR.SP00.A
// - D: daily frequency
// - {QUOTE}: quote currency (e.g. USD)
// - EUR: base currency
// - SP00/A: spot series attributes
function buildSeriesKey(quoteCurrency: string) {
  return `D.${normalizeCurrency(quoteCurrency)}.EUR.SP00.A`;
}

export function parseEcbFxSeriesPayload(payload: unknown): EcbDailyFxPoint[] {
  const typed = payload as EcbPayload;
  const series = typed?.dataSets?.[0]?.series;
  const observationDims = typed?.structure?.dimensions?.observation || [];
  const timeDim = observationDims.find((dim) => (dim.id || "").toUpperCase() === "TIME_PERIOD") || observationDims[0];
  const timeValues = timeDim?.values || [];

  if (!series || !timeValues.length) {
    return [];
  }

  const pointsByDate = new Map<string, number>();
  for (const row of Object.values(series)) {
    const observations = row?.observations || {};
    for (const [idx, raw] of Object.entries(observations)) {
      const value = Array.isArray(raw) ? Number(raw[0]) : Number.NaN;
      const date = timeValues[Number(idx)]?.id;
      if (!date || !Number.isFinite(value) || value <= 0) continue;
      pointsByDate.set(date, value);
    }
  }

  return Array.from(pointsByDate.entries())
    .map(([date, rate]) => ({ date, rate }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchEcbFxSeries(
  quoteCurrency: string,
  start: string,
  end: string
): Promise<EcbDailyFxPoint[]> {
  const quote = normalizeCurrency(quoteCurrency);
  const key = buildSeriesKey(quote);
  const url = new URL(`${ECB_BASE_URL}/${ECB_FLOW_REF}/${key}`);
  url.searchParams.set("startPeriod", start);
  url.searchParams.set("endPeriod", end);
  url.searchParams.set("detail", "dataonly");

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url.toString(), {
        cache: "no-store",
        headers: {
          // ECB often defaults to SDMX-XML unless an explicit JSON Accept header is sent.
          Accept: "application/vnd.sdmx.data+json;version=1.0.0-wd"
        }
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`ECB FX request failed (${response.status}): ${body || "no response body"}`);
      }

      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      if (!contentType.includes("json")) {
        const body = await response.text();
        throw new Error(
          `ECB FX response was not JSON (content-type: ${contentType || "unknown"}): ${body.slice(0, 160)}`
        );
      }

      const payload = (await response.json()) as unknown;
      return parseEcbFxSeriesPayload(payload);
    } catch (error) {
      lastError = error;
      if (attempt >= MAX_RETRIES) break;
      await sleep(250 * 2 ** (attempt - 1));
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Unable to fetch ECB FX series for ${quote} after ${MAX_RETRIES} attempts: ${message}`);
}

export const __testables = {
  buildSeriesKey,
  parseEcbFxSeriesPayload
};
