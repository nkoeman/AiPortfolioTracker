import React from "react";
import type { PortfolioAiSummaryJson, PortfolioAiSummaryState } from "@/lib/ai/portfolioSummary";

function formatDate(value: Date | null) {
  if (!value) return "-";
  return value.toISOString().slice(0, 10);
}

function isSummaryJson(value: unknown): value is PortfolioAiSummaryJson {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.oneLiner === "string" && Array.isArray(record.bullets);
}

function parseSummaryMarkdown(markdown: string): PortfolioAiSummaryJson | null {
  const lines = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return null;
  const oneLinerRaw = lines.find((line) => line.startsWith(">")) ?? "";
  const oneLiner = oneLinerRaw.replace(/^>\s?/, "").trim();
  const bullets = lines
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean);

  if (!oneLiner && !bullets.length) return null;
  return {
    oneLiner: oneLiner || "Portfolio insights",
    bullets
  };
}

function renderSummaryBlocks(summary: PortfolioAiSummaryJson) {
  return (
    <div className="stack">
      <blockquote className="summary-quote">{summary.oneLiner}</blockquote>
      {summary.bullets.length ? (
        <ul className="summary-list">
          {summary.bullets.map((item, idx) => (
            <li key={`bullet-${idx}`}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type PortfolioAiSummaryCardProps = {
  state: PortfolioAiSummaryState;
};

export function PortfolioAiSummaryCard({ state }: PortfolioAiSummaryCardProps) {
  const windowStart = formatDate(state.window.startWeekEndDate);
  const windowEnd = formatDate(state.window.endWeekEndDate);
  const markdownSummary =
    state.summary?.summaryMarkdown ? parseSummaryMarkdown(state.summary.summaryMarkdown) : null;

  return (
    <div className="card stack">
      <div className="row">
        <div>
          <div className="section-title">Monthly Briefing</div>
          <h2>What happend in your portfolio</h2>          
        </div>        
      </div>

      {state.status === "EMPTY" ? (
        <p>Not enough history yet to generate AI insights.</p>
      ) : state.status === "FAILED" ? (
        <p>AI insights unavailable.</p>
      ) : state.summary?.summaryJson && isSummaryJson(state.summary.summaryJson) ? (
        renderSummaryBlocks(state.summary.summaryJson)
      ) : markdownSummary ? (
        renderSummaryBlocks(markdownSummary)
      ) : state.summary?.summaryMarkdown ? (
        <div className="preline">{state.summary.summaryMarkdown}</div>
      ) : (
        <p>AI insights unavailable.</p>
      )}
    </div>
  );
}
