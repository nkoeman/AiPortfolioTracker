"use client";

import React, { useEffect, useMemo, useState } from "react";
import { PortfolioAiSummaryCard } from "@/components/PortfolioAiSummaryCard";
import type { PortfolioAiSummaryState } from "@/lib/ai/portfolioSummary";

type LoadState = {
  loading: boolean;
  error: string | null;
  data: PortfolioAiSummaryState | null;
};

const emptyState: PortfolioAiSummaryState = {
  status: "EMPTY",
  summary: null,
  window: {
    startWeekEndDate: null,
    endWeekEndDate: null,
    weeksCount: 0,
    points: []
  }
};

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function normalizeSummaryState(raw: PortfolioAiSummaryState): PortfolioAiSummaryState {
  return {
    ...raw,
    summary: raw.summary
      ? {
          ...raw.summary,
          updatedAt: toDate(raw.summary.updatedAt)
        }
      : null,
    window: {
      ...raw.window,
      startWeekEndDate: toDate(raw.window.startWeekEndDate),
      endWeekEndDate: toDate(raw.window.endWeekEndDate),
      points: raw.window.points.map((point) => ({
        ...point,
        weekEndDate: toDate(point.weekEndDate) ?? new Date(0)
      }))
    }
  };
}

function Spinner() {
  return (
    <div className="spinner">
      <span className="spinner-dot" />
      <small>Generating AI insights...</small>
    </div>
  );
}

export function PortfolioAiSummaryCardClient() {
  const [state, setState] = useState<LoadState>({
    loading: true,
    error: null,
    data: null
  });

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const response = await fetch("/api/ai-summary");
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "AI summary request failed");
        }
        const data = normalizeSummaryState((await response.json()) as PortfolioAiSummaryState);
        if (mounted) {
          setState({ loading: false, error: null, data });
        }
      } catch (error) {
        if (mounted) {
          const message = error instanceof Error ? error.message : "AI summary request failed";
          setState({ loading: false, error: message, data: emptyState });
        }
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  const content = useMemo(() => {
    if (state.loading) {
      return (
        <div className="card stack">
          <div className="row">
            <div>
              <div className="section-title">Monthly Briefing</div>
              <h2>AI Portfolio insights</h2>
              <small>Pattern-based analysis of recent performance. Not financial advice.</small>
            </div>
          </div>
          <Spinner />
        </div>
      );
    }

    if (state.error) {
      return (
        <div className="card stack">
          <div className="section-title">Monthly Briefing</div>
          <h2>AI Portfolio insights</h2>
          <small>Pattern-based analysis of recent performance. Not financial advice.</small>
          <p>AI insights currently unavailable.</p>
        </div>
      );
    }

    return <PortfolioAiSummaryCard state={state.data ?? emptyState} />;
  }, [state]);

  return content;
}
