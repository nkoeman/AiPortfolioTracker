import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RecentPerformanceResult } from "@/lib/dashboard/recentPerformance";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  instrumentFindMany: vi.fn(),
  getRecentPerformance: vi.fn(),
  fetch: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    portfolioAiSummary: {
      findUnique: mocks.findUnique,
      upsert: mocks.upsert
    },
    instrument: {
      findMany: mocks.instrumentFindMany
    }
  }
}));

vi.mock("@/lib/dashboard/recentPerformance", () => ({
  getRecentPerformance: mocks.getRecentPerformance
}));

import {
  buildFactsPayload,
  computeInputHash,
  getOrCreatePortfolioAiSummary,
  renderSummaryMarkdown,
  __testables
} from "@/lib/ai/portfolioSummary";

function buildRecentPerformance(): RecentPerformanceResult {
  return {
    window: {
      startWeekEndDate: new Date("2026-01-12T00:00:00.000Z"),
      endWeekEndDate: new Date("2026-02-02T00:00:00.000Z"),
      weeksCount: 4,
      points: [
        { weekEndDate: new Date("2026-01-12T00:00:00.000Z"), valueEur: 100 },
        { weekEndDate: new Date("2026-01-19T00:00:00.000Z"), valueEur: 104 },
        { weekEndDate: new Date("2026-01-26T00:00:00.000Z"), valueEur: 107 },
        { weekEndDate: new Date("2026-02-02T00:00:00.000Z"), valueEur: 110 }
      ]
    },
    portfolio: {
      startValueEur: 100,
      endValueEur: 110,
      changeEur: 10,
      changePct: 0.1,
      netFlowEur: 6,
      valueGainedEur: 4,
      valueGainedPct: 0.04
    },
    contributors: {
      topGainers: [
        {
          instrumentId: "inst_1",
          isin: "ISIN-1",
          instrumentName: "Winner",
          contributionEur: 5,
          contributionPctOfMove: 0.5,
          localReturnPct: 0.08
        }
      ],
      topLosers: [
        {
          instrumentId: "inst_2",
          isin: "ISIN-2",
          instrumentName: "Loser",
          contributionEur: -3,
          contributionPctOfMove: -0.3,
          localReturnPct: -0.05
        }
      ]
    },
    notes: [],
    approximationNote: null
  };
}

describe("portfolio AI summary", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.findUnique.mockReset();
    mocks.upsert.mockReset();
    mocks.instrumentFindMany.mockReset().mockResolvedValue([]);
    mocks.getRecentPerformance.mockReset();
    mocks.fetch.mockReset();
    globalThis.fetch = mocks.fetch;
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_MODEL = "gpt-test";
    process.env.OPENAI_TEMPERATURE = "0.2";
  });

  it("builds facts payload from recent performance results", () => {
    const recent = buildRecentPerformance();
    const facts = buildFactsPayload(recent, new Map());

    expect(facts.window.weeksCount).toBe(4);
    expect(facts.window.startWeekEndDate).toBe("2026-01-12");
    expect(facts.window.endWeekEndDate).toBe("2026-02-02");
    expect(facts.portfolio.changeEur).toBe(recent.portfolio.changeEur);
    expect(facts.portfolio.changePct).toBe(recent.portfolio.changePct);
    expect(facts.contributors.topGainers[0].instrumentName).toBe("Winner");
    expect(facts.contributors.topGainers[0].contributionEur).toBe(
      recent.contributors.topGainers[0].contributionEur
    );
  });

  it("hash is stable for identical inputs and changes with temperature", () => {
    const recent = buildRecentPerformance();
    const facts = buildFactsPayload(recent, new Map());

    const hash1 = computeInputHash(facts, 0.2);
    const hash2 = computeInputHash(facts, 0.2);
    const hash3 = computeInputHash(facts, 0.25);

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });

  it("returns cached summary when hash matches", async () => {
    const recent = buildRecentPerformance();
    const facts = buildFactsPayload(recent, new Map());
    const inputHash = computeInputHash(facts, 0.2);

    mocks.getRecentPerformance.mockResolvedValue(recent);
    mocks.findUnique.mockResolvedValue({
      status: "READY",
      inputHash,
      summaryJson: {
        oneLiner: "Portfolio trends appear focused and measured.",
        bullets: ["Moves look concentrated among a few positions."]
      },
      summaryMarkdown: "Cached",
      updatedAt: new Date("2026-02-03T00:00:00.000Z"),
      model: "gpt-test",
      temperature: 0.2,
      promptVersion: "v4"
    });

    const result = await getOrCreatePortfolioAiSummary("user_1", recent, 4);

    expect(result.status).toBe("READY");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("derives summaries from getRecentPerformance when no result is provided", async () => {
    const recent = buildRecentPerformance();
    const facts = buildFactsPayload(recent, new Map());
    const inputHash = computeInputHash(facts, 0.2);

    mocks.getRecentPerformance.mockResolvedValue(recent);
    mocks.findUnique.mockResolvedValue({
      status: "READY",
      inputHash,
      summaryJson: {
        oneLiner: "Portfolio trends appear focused and measured.",
        bullets: ["Moves look concentrated among a few positions."]
      },
      summaryMarkdown: "Cached",
      updatedAt: new Date("2026-02-03T00:00:00.000Z"),
      model: "gpt-test",
      temperature: 0.2,
      promptVersion: "v4"
    });

    const result = await getOrCreatePortfolioAiSummary("user_1");

    expect(mocks.getRecentPerformance).toHaveBeenCalledWith("user_1", 4);
    expect(result.status).toBe("READY");
  });

  it("persists a generated summary when no cache exists", async () => {
    const recent = buildRecentPerformance();
    const summaryJson = {
      oneLiner: "Portfolio trends appear focused and measured.",
      bullets: ["Moves look concentrated among a few positions."]
    };

    mocks.getRecentPerformance.mockResolvedValue(recent);
    mocks.findUnique.mockResolvedValue(null);
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(summaryJson) } }]
      })
    });
    mocks.upsert.mockResolvedValue({
      summaryJson,
      summaryMarkdown: renderSummaryMarkdown(summaryJson),
      updatedAt: new Date("2026-02-03T00:00:00.000Z"),
      model: "gpt-test",
      temperature: 0.2,
      promptVersion: "v4"
    });

    const result = await getOrCreatePortfolioAiSummary("user_1", recent, 4);

    expect(result.status).toBe("READY");
    expect(mocks.upsert).toHaveBeenCalled();
  });

  it("validates the short schema requirements", async () => {
    const recent = buildRecentPerformance();
    mocks.getRecentPerformance.mockResolvedValue(recent);
    mocks.findUnique.mockResolvedValue(null);

    const summaryJson = {
      oneLiner: "Portfolio trends appear focused and measured.",
      bullets: ["Moves look concentrated among a few positions."]
    };

    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(summaryJson) } }]
      })
    });
    mocks.upsert.mockResolvedValue({
      summaryJson,
      summaryMarkdown: renderSummaryMarkdown(summaryJson),
      updatedAt: new Date("2026-02-03T00:00:00.000Z"),
      model: "gpt-test",
      temperature: 0.2,
      promptVersion: "v4"
    });

    const result = await getOrCreatePortfolioAiSummary("user_1", recent, 4);

    expect(result.status).toBe("READY");
    expect((result.summary?.summaryJson as any)?.oneLiner).toBe(summaryJson.oneLiner);
    expect((result.summary?.summaryJson as any)?.bullets.length).toBe(1);
  });

  it("rejects invalid one-liner or bullet lengths", () => {
    const invalid = {
      oneLiner: "Too long.".repeat(30),
      bullets: ["This bullet is fine."]
    };

    expect(() => __testables.validateSummary(invalid)).toThrow();
  });

  it("sanitizes overly long one-liners into a single sentence", () => {
    const raw = {
      oneLiner: "This is sentence one. This is sentence two with extra text that should be ignored.",
      bullets: ["A bullet."]
    };

    const sanitized = __testables.sanitizeSummary(raw);
    expect(sanitized.oneLiner).toBe("This is sentence one.");
    expect(() => __testables.validateSummary(sanitized)).not.toThrow();
  });

  it("changes hash when prompt version changes", () => {
    const recent = buildRecentPerformance();
    const facts = buildFactsPayload(recent, new Map());
    const hash1 = __testables.computeInputHashWithVersion(facts, 0.2, "v4");
    const hash2 = __testables.computeInputHashWithVersion(facts, 0.2, "v5");

    expect(hash1).not.toBe(hash2);
  });
});
