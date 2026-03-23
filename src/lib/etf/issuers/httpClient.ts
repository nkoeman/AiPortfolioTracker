const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_DELAY_MS = 350;
const RETRY_BACKOFF_MS = [400, 900, 1800];
const DEFAULT_MAX_REDIRECTS = 15;

export type RequestContext = {
  cookieJar?: Map<string, string>;
};

export type RequestOptions = {
  method?: "GET" | "POST";
  body?: string;
  headers?: Record<string, string>;
};

let lastRequestAt = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(ms: number) {
  return Math.round(ms + Math.random() * 175);
}

async function rateLimit() {
  const minDelay = Number(process.env.ETF_ENRICH_MIN_DELAY_MS || DEFAULT_DELAY_MS);
  const now = Date.now();
  const waitMs = Math.max(0, minDelay - (now - lastRequestAt));
  if (waitMs > 0) await sleep(waitMs);
  lastRequestAt = Date.now();
}

function buildCookieHeader(cookieJar: Map<string, string>) {
  if (cookieJar.size === 0) return null;
  return Array.from(cookieJar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function updateCookieJar(response: Response, cookieJar: Map<string, string>) {
  const headerBag = response.headers as unknown as { getSetCookie?: () => string[] };
  const setCookies = typeof headerBag.getSetCookie === "function" ? headerBag.getSetCookie() : [];
  for (const setCookie of setCookies) {
    const firstPart = setCookie.split(";")[0]?.trim();
    if (!firstPart || !firstPart.includes("=")) continue;
    const equalsIndex = firstPart.indexOf("=");
    const key = firstPart.slice(0, equalsIndex).trim();
    const value = firstPart.slice(equalsIndex + 1).trim();
    if (!key || !value) continue;
    cookieJar.set(key, value);
  }
}

function isRetriable(status: number) {
  return status === 429 || status >= 500;
}

function getHeaders(cookieHeader: string | null, extraHeaders?: Record<string, string>) {
  return {
    Accept: "*/*",
    "User-Agent": process.env.ETF_ENRICH_USER_AGENT || process.env.ISHARES_USER_AGENT || "PortfolioTracker/1.0",
    ...(extraHeaders || {}),
    ...(cookieHeader ? { Cookie: cookieHeader } : {})
  };
}

function isRedirectStatus(status: number) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function toAbsoluteRedirectUrl(currentUrl: string, location: string) {
  try {
    return new URL(location, currentUrl).toString();
  } catch {
    return location;
  }
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  cookieJar: Map<string, string>,
  options?: RequestOptions
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: options?.method || "GET",
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
      headers: getHeaders(buildCookieHeader(cookieJar), options?.headers),
      body: options?.body
    });
  } finally {
    clearTimeout(timeout);
  }
}

function toAbsoluteUrl(baseUrl: string, pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return new URL(pathOrUrl, `${baseUrl}/`).toString();
}

export async function requestWithRetry(
  url: string,
  context?: RequestContext,
  options?: RequestOptions
): Promise<Response> {
  const timeoutMs = Number(process.env.ETF_ENRICH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const maxRedirects = Number(process.env.ETF_ENRICH_MAX_REDIRECTS || DEFAULT_MAX_REDIRECTS);
  const cookieJar = context?.cookieJar ?? new Map<string, string>();
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt += 1) {
    await rateLimit();
    try {
      let currentUrl = url;
      let currentMethod = options?.method || "GET";
      let currentBody = options?.body;
      let redirectCount = 0;
      let response: Response | null = null;

      while (redirectCount <= maxRedirects) {
        response = await fetchWithTimeout(currentUrl, timeoutMs, cookieJar, {
          method: currentMethod,
          body: currentBody,
          headers: options?.headers
        });
        updateCookieJar(response, cookieJar);

        if (isRedirectStatus(response.status)) {
          const location = response.headers.get("location");
          if (!location) {
            throw new Error(`Redirect (${response.status}) without Location header`);
          }

          currentUrl = toAbsoluteRedirectUrl(currentUrl, location);
          redirectCount += 1;

          if (response.status === 303 || ((response.status === 301 || response.status === 302) && currentMethod === "POST")) {
            currentMethod = "GET";
            currentBody = undefined;
          }
          continue;
        }

        break;
      }

      if (!response) {
        throw new Error("Empty response while requesting issuer endpoint");
      }

      if (redirectCount > maxRedirects) {
        throw new Error(`Redirect count exceeded (${maxRedirects})`);
      }

      if (response.ok) return response;
      if (!isRetriable(response.status)) {
        const body = await response.text();
        throw new Error(`Request failed (${response.status}): ${body || "empty body"}`);
      }
      lastError = new Error(`Request failed (${response.status})`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < RETRY_BACKOFF_MS.length) {
      await sleep(jitter(RETRY_BACKOFF_MS[attempt]));
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Request failed after retries: ${message}`);
}

export async function getText(url: string, context?: RequestContext) {
  const response = await requestWithRetry(url, context);
  return response.text();
}

export async function getJson<T>(url: string, context?: RequestContext): Promise<T> {
  const response = await requestWithRetry(url, context);
  return (await response.json()) as T;
}

export async function postJson<T>(
  url: string,
  payload: unknown,
  context?: RequestContext,
  headers?: Record<string, string>
): Promise<T> {
  const response = await requestWithRetry(
    url,
    context,
    {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        ...(headers || {})
      }
    }
  );
  return (await response.json()) as T;
}

export async function getBytes(url: string, context?: RequestContext) {
  const response = await requestWithRetry(url, context);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export const __testables = {
  toAbsoluteUrl
};
