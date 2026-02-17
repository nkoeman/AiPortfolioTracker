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

  return (
    <div className="card stack">
      <div className="row">
        <div>
          <div className="section-title">Monthly Briefing</div>
          <h2>AI Portfolio insights</h2>
          <small>Pattern-based analysis of recent performance. Not financial advice.</small>
        </div>
        <div className="text-right">
          <small>
            Window: {windowStart} to {windowEnd}
          </small>
          {state.summary?.updatedAt ? (
            <>
              <br />
              <small>Last updated: {formatDate(state.summary.updatedAt)}</small>
            </>
          ) : null}
        </div>
      </div>

      {state.status === "EMPTY" ? (
        <p>Not enough history yet to generate AI insights.</p>
      ) : state.status === "FAILED" ? (
        <p>AI insights unavailable.</p>
      ) : state.summary?.summaryJson && isSummaryJson(state.summary.summaryJson) ? (
        renderSummaryBlocks(state.summary.summaryJson)
      ) : state.summary?.summaryMarkdown ? (
        <div className="preline">{state.summary.summaryMarkdown}</div>
      ) : (
        <p>AI insights unavailable.</p>
      )}
    </div>
  );
}
