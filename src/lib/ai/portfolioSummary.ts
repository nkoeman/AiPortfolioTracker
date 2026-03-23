import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getRecentPerformance, RecentPerformanceResult } from "@/lib/dashboard/recentPerformance";

export type PortfolioAiSummaryJson = {
  oneLiner: string;
  bullets: string[];
};

export type PortfolioAiFactsPayload = {
  window: {
    startWeekEndDate: string | null;
    endWeekEndDate: string | null;
    weeksCount: number;
  };
  portfolio: {
    changeEur: number | null;
    changePct: number | null;
  };
  contributors: {
    topGainers: Array<{
      isin: string;
      instrumentName: string;
      contributionEur: number;
      securityType: string | null;
      securityType2: string | null;
      marketSector: string | null;
    }>;
    topLosers: Array<{
      isin: string;
      instrumentName: string;
      contributionEur: number;
      securityType: string | null;
      securityType2: string | null;
      marketSector: string | null;
    }>;
  };
};

export type PortfolioAiSummaryState = {
  status: "EMPTY" | "READY" | "FAILED";
  summary: {
    summaryJson: PortfolioAiSummaryJson | null;
    summaryMarkdown: string | null;
    updatedAt: Date | null;
    model: string | null;
    temperature: number | null;
    promptVersion: string | null;
  } | null;
  window: RecentPerformanceResult["window"];
  errorMessage?: string | null;
};

type InstrumentMeta = {
  isin: string;
  securityType: string | null;
  securityType2: string | null;
  marketSector: string | null;
};

const PROMPT_VERSION = "v5";
const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TEMPERATURE = 0.2;

function toIsoDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function parseTemperature(input: string | undefined) {
  if (!input) return DEFAULT_TEMPERATURE;
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return DEFAULT_TEMPERATURE;
  return Math.max(0, parsed);
}

export function computeInputHashWithVersion(
  factsPayload: PortfolioAiFactsPayload,
  temperature: number,
  promptVersion: string
) {
  const payload = `${promptVersion}${temperature}${JSON.stringify(factsPayload)}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

export function computeInputHash(factsPayload: PortfolioAiFactsPayload, temperature: number) {
  return computeInputHashWithVersion(factsPayload, temperature, PROMPT_VERSION);
}

export function buildFactsPayload(
  recent: RecentPerformanceResult,
  metadataByIsin: Map<string, InstrumentMeta>
): PortfolioAiFactsPayload {
  const enrich = (items: RecentPerformanceResult["contributors"]["topGainers"]) =>
    items.map((row) => {
      const meta = metadataByIsin.get(row.isin) || null;
      return {
        isin: row.isin,
        instrumentName: row.instrumentName,
        contributionEur: row.contributionEur,
        securityType: meta?.securityType ?? null,
        securityType2: meta?.securityType2 ?? null,
        marketSector: meta?.marketSector ?? null
      };
    });

  return {
    window: {
      startWeekEndDate: toIsoDate(recent.window.startWeekEndDate),
      endWeekEndDate: toIsoDate(recent.window.endWeekEndDate),
      weeksCount: recent.window.weeksCount
    },
    portfolio: {
      changeEur: recent.portfolio.changeEur,
      changePct: recent.portfolio.changePct
    },
    contributors: {
      topGainers: enrich(recent.contributors.topGainers),
      topLosers: enrich(recent.contributors.topLosers)
    }
  };
}

export function renderSummaryMarkdown(summary: PortfolioAiSummaryJson) {
  const lines: string[] = [];
  lines.push(`> ${summary.oneLiner}`);
  if (summary.bullets.length) {
    lines.push("");
    for (const item of summary.bullets) lines.push(`- ${item}`);
  }
  return lines.join("\n");
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

const COMMON_ABBREVIATIONS = new Set([
  "mr.",
  "mrs.",
  "ms.",
  "dr.",
  "prof.",
  "sr.",
  "jr.",
  "st.",
  "vs.",
  "etc.",
  "e.g.",
  "i.e.",
  "u.s.",
  "u.k."
]);

function isAbbreviationDot(text: string, index: number) {
  if (text[index] !== ".") return false;
  const before = text.slice(0, index + 1);
  if (/\b(?:[A-Za-z]\.){2,}$/.test(before)) return true;

  const tokenMatch = before.match(/([A-Za-z.]+)$/);
  const token = tokenMatch?.[1]?.toLowerCase() ?? "";
  if (token && COMMON_ABBREVIATIONS.has(token)) return true;

  const prev = text[index - 1] ?? "";
  const next = text[index + 1] ?? "";
  if (/\d/.test(prev) && /\d/.test(next)) return true;
  if (/[A-Z]/.test(prev) && /[A-Z]/.test(next)) return true;
  return false;
}

function isSentenceTerminator(text: string, index: number) {
  const ch = text[index];
  if (ch !== "." && ch !== "!" && ch !== "?") return false;

  const rest = text.slice(index + 1).trimStart();
  if (!rest) return true;
  if (ch === "." && isAbbreviationDot(text, index)) return false;
  if (ch === "!" || ch === "?") return true;

  const first = rest[0];
  return /[A-Z"'([{]/.test(first);
}

function extractFirstSentence(value: string) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return "";
  for (let i = 0; i < normalized.length; i += 1) {
    if (!isSentenceTerminator(normalized, i)) continue;
    const rest = normalized.slice(i + 1).trimStart();
    if (rest) return normalized.slice(0, i + 1).trim();
    return normalized;
  }
  return normalized;
}

function clampOneLiner(value: string) {
  let sentence = extractFirstSentence(value);
  if (!sentence.endsWith(".") && !sentence.endsWith("!") && !sentence.endsWith("?")) {
    sentence = `${sentence}.`;
  }
  if (sentence.length > 180) {
    const clipped = sentence.slice(0, 180).trimEnd();
    const lastPunct = Math.max(clipped.lastIndexOf("."), clipped.lastIndexOf("!"), clipped.lastIndexOf("?"));
    if (lastPunct >= 80) {
      sentence = clipped.slice(0, lastPunct + 1).trim();
    } else {
      const lastSpace = clipped.lastIndexOf(" ");
      const base = (lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped).trimEnd();
      sentence = base.endsWith(".") || base.endsWith("!") || base.endsWith("?") ? base : `${base}.`;
    }
  }
  return sentence;
}

function clampBullets(items: string[]) {
  return items
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean)
    .slice(0, 5)
    .map((item) => (item.length > 120 ? item.slice(0, 120).trimEnd() : item));
}

function isSingleSentence(value: string) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return false;
  let terminators = 0;
  let lastTerminatorIndex = -1;
  for (let i = 0; i < normalized.length; i += 1) {
    if (!isSentenceTerminator(normalized, i)) continue;
    terminators += 1;
    lastTerminatorIndex = i;
    if (terminators > 1) return false;
  }
  if (terminators !== 1) return false;
  const tail = normalized.slice(lastTerminatorIndex + 1).trim();
  return tail.length === 0;
}

function validateSummary(summary: PortfolioAiSummaryJson) {
  const oneLiner = normalizeWhitespace(summary.oneLiner);
  if (!oneLiner || oneLiner.length > 180 || !isSingleSentence(oneLiner)) {
    throw new Error("AI summary oneLiner must be a single sentence under 180 characters.");
  }
  if (!Array.isArray(summary.bullets) || summary.bullets.length < 1 || summary.bullets.length > 5) {
    throw new Error("AI summary bullets must contain 1 to 5 items.");
  }
  for (const bullet of summary.bullets) {
    const normalized = normalizeWhitespace(bullet);
    if (!normalized || normalized.length > 120) {
      throw new Error("AI summary bullets must be non-empty and under 120 characters.");
    }
  }
}

function sanitizeSummary(summary: PortfolioAiSummaryJson): PortfolioAiSummaryJson {
  const oneLiner = clampOneLiner(summary.oneLiner);
  const bullets = clampBullets(summary.bullets);
  return { oneLiner, bullets };
}

async function fetchPortfolioSummary(
  factsPayload: PortfolioAiFactsPayload,
  model: string,
  temperature: number
): Promise<PortfolioAiSummaryJson> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      oneLiner: { type: "string" },
      bullets: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 }
    },
    required: ["oneLiner", "bullets"]
  };

  const systemPrompt = [
    "You are a portfolio insights assistant.",
    "Return ONLY the JSON fields specified by the schema.",
    "Return exactly one sentence in oneLiner (max 180 characters).",
    "Return 1 to 5 bullets; each bullet max 120 characters.",
    "Do NOT restate total EUR or % performance recap.",
    "Do NOT include numeric recap of total portfolio change.",
    "Use only the provided facts payload.",
    "Refer to recent performance without repeating numeric summaries.",
    "Do not compute returns; do not recompute any performance numbers.",
    "No financial advice.",
    "No specific event claims.",
    "No mention of data sources.",
    "No hallucinated macro events.",
    "Use cautious phrasing: appears, may reflect, suggests, could be consistent with.",
    "Keep the tone analytical, concise, and professional.",
    "Avoid verbosity and extra sections."
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "portfolio_insights",
          schema,
          strict: true
        }
      },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Facts payload (JSON):\n${JSON.stringify(factsPayload)}`
        }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI response missing content");
  }

  const parsed = JSON.parse(content) as PortfolioAiSummaryJson;
  const sanitized = sanitizeSummary(parsed);
  validateSummary(sanitized);
  return sanitized;
}

export async function getOrCreatePortfolioAiSummary(
  userId: string,
  recentPerformance?: RecentPerformanceResult,
  windowWeeks = 4
): Promise<PortfolioAiSummaryState> {
  const recent = recentPerformance ?? (await getRecentPerformance(userId, windowWeeks));
  const endWeek = recent.window.endWeekEndDate;

  if (recent.window.weeksCount < 2 || !endWeek) {
    return {
      status: "EMPTY",
      summary: null,
      window: recent.window
    };
  }

  const contributorIsins = Array.from(
    new Set([
      ...recent.contributors.topGainers.map((row) => row.isin),
      ...recent.contributors.topLosers.map((row) => row.isin)
    ])
  );

  const instruments = contributorIsins.length
    ? await prisma.instrument.findMany({
        where: { isin: { in: contributorIsins } },
        select: { isin: true, securityType: true, securityType2: true, marketSector: true }
      })
    : [];

  const metadataByIsin = new Map<string, InstrumentMeta>();
  for (const instrument of instruments) {
    metadataByIsin.set(instrument.isin, {
      isin: instrument.isin,
      securityType: instrument.securityType || null,
      securityType2: instrument.securityType2 || null,
      marketSector: instrument.marketSector || null
    });
  }

  const factsPayload = buildFactsPayload(recent, metadataByIsin);
  const temperature = parseTemperature(process.env.OPENAI_TEMPERATURE);
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const inputHash = computeInputHash(factsPayload, temperature);

  const existing = await prisma.portfolioAiSummary.findUnique({
    where: {
      userId_weekEndDate_windowWeeks: {
        userId,
        weekEndDate: endWeek,
        windowWeeks
      }
    }
  });

  if (existing && existing.status === "READY" && existing.inputHash === inputHash) {
    console.info("[AI][SUMMARY] cache_hit", {
      userId,
      endWeek: toIsoDate(endWeek),
      hash: inputHash
    });
    return {
      status: "READY",
      summary: {
        summaryJson: existing.summaryJson as PortfolioAiSummaryJson,
        summaryMarkdown: existing.summaryMarkdown || null,
        updatedAt: existing.updatedAt,
        model: existing.model,
        temperature: existing.temperature,
        promptVersion: existing.promptVersion
      },
      window: recent.window
    };
  }

  console.info("[AI][SUMMARY] generating", {
    userId,
    endWeek: toIsoDate(endWeek),
    weeksCount: recent.window.weeksCount,
    temperature
  });

  try {
    const summaryJson = await fetchPortfolioSummary(factsPayload, model, temperature);
    const summaryMarkdown = renderSummaryMarkdown(summaryJson);

    const saved = await prisma.portfolioAiSummary.upsert({
      where: {
        userId_weekEndDate_windowWeeks: {
          userId,
          weekEndDate: endWeek,
          windowWeeks
        }
      },
      create: {
        userId,
        weekEndDate: endWeek,
        windowWeeks,
        inputHash,
        summaryJson,
        summaryMarkdown,
        model,
        temperature,
        promptVersion: PROMPT_VERSION,
        status: "READY"
      },
      update: {
        inputHash,
        summaryJson,
        summaryMarkdown,
        model,
        temperature,
        promptVersion: PROMPT_VERSION,
        status: "READY",
        errorMessage: null
      }
    });

    return {
      status: "READY",
      summary: {
        summaryJson: saved.summaryJson as PortfolioAiSummaryJson,
        summaryMarkdown: saved.summaryMarkdown || null,
        updatedAt: saved.updatedAt,
        model: saved.model,
        temperature: saved.temperature,
        promptVersion: saved.promptVersion
      },
      window: recent.window
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[AI][SUMMARY] failed", { userId, endWeek: toIsoDate(endWeek), error: message });

    const failed = await prisma.portfolioAiSummary.upsert({
      where: {
        userId_weekEndDate_windowWeeks: {
          userId,
          weekEndDate: endWeek,
          windowWeeks
        }
      },
      create: {
        userId,
        weekEndDate: endWeek,
        windowWeeks,
        inputHash,
        summaryJson: {},
        summaryMarkdown: null,
        model,
        temperature,
        promptVersion: PROMPT_VERSION,
        status: "FAILED",
        errorMessage: message
      },
      update: {
        inputHash,
        summaryJson: {},
        summaryMarkdown: null,
        model,
        temperature,
        promptVersion: PROMPT_VERSION,
        status: "FAILED",
        errorMessage: message
      }
    });

    return {
      status: "FAILED",
      summary: {
        summaryJson: null,
        summaryMarkdown: failed.summaryMarkdown || null,
        updatedAt: failed.updatedAt,
        model: failed.model,
        temperature: failed.temperature,
        promptVersion: failed.promptVersion
      },
      window: recent.window,
      errorMessage: message
    };
  }
}

export const __testables = {
  fetchPortfolioSummary,
  parseTemperature,
  validateSummary,
  computeInputHashWithVersion,
  sanitizeSummary
};


