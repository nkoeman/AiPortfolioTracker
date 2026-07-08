import React from "react";
import { AppIcon } from "@/components/icons/AppIcon";
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

type PortfolioAiSummaryCardProps = {
  state: PortfolioAiSummaryState;
  onRegenerate?: () => void;
  regenerating?: boolean;
};

function renderSummaryBlocks(summary: PortfolioAiSummaryJson) {
  return (
    <>
      <p className="ai-quote">{summary.oneLiner}</p>
      {summary.bullets.length ? (
        <ul className="ai-bullets">
          {summary.bullets.map((item, idx) => (
            <li key={`bullet-${idx}`}>{item}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

export function PortfolioAiSummaryCard({ state, onRegenerate, regenerating }: PortfolioAiSummaryCardProps) {
  const markdownSummary =
    state.summary?.summaryMarkdown ? parseSummaryMarkdown(state.summary.summaryMarkdown) : null;
  const asOf = state.window.endWeekEndDate || state.summary?.updatedAt || null;
  const dateLabel = formatDate(asOf);

  return (
    <div className="card ai-card stack">
      <div className="card-head">
        <div>
          <div className="ai-badge">AI insight</div>
          <h2 className="card-title" style={{ marginTop: 8 }}>
            What happened in your portfolio
          </h2>
        </div>
        <button type="button" className="btn btn-sm btn-ghost ai-regenerate" onClick={onRegenerate} disabled={regenerating}>
          <AppIcon name="refresh" size={13} />
          <span>{regenerating ? "Regenerating..." : "Regenerate"}</span>
        </button>
      </div>

      {state.status === "EMPTY" ? (
        <p className="tone-muted">Not enough history yet to generate AI insights.</p>
      ) : state.status === "FAILED" ? (
        <p className="warning-text">AI insights are currently unavailable.</p>
      ) : state.summary?.summaryJson && isSummaryJson(state.summary.summaryJson) ? (
        renderSummaryBlocks(state.summary.summaryJson)
      ) : markdownSummary ? (
        renderSummaryBlocks(markdownSummary)
      ) : state.summary?.summaryMarkdown ? (
        <div className="preline">{state.summary.summaryMarkdown}</div>
      ) : (
        <p className="warning-text">AI insights are currently unavailable.</p>
      )}

      <div className="ai-meta">
        <span>As of {dateLabel}</span>
        <span>Window: {formatDate(state.window.startWeekEndDate)} to {formatDate(state.window.endWeekEndDate)}</span>
      </div>
    </div>
  );
}
