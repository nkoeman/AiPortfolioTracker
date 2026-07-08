"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { PortfolioSetupStatus, PortfolioSetupStepStatus } from "@/lib/portfolio/setupStatus";

type PortfolioSetupScreenProps = {
  initialStatus: PortfolioSetupStatus;
  mode?: "takeover" | "banner";
};

function StepIcon({ status }: { status: PortfolioSetupStepStatus }) {
  if (status === "complete") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 12.5l5 5.5L20 6" />
      </svg>
    );
  }
  if (status === "running") return <span className="ob-spin" aria-hidden="true" />;
  if (status === "error") return <span className="ob-step-error" aria-hidden="true">!</span>;
  return null;
}

function formatPeriod(start: string | null, end: string | null) {
  if (!start && !end) return "-";
  if (start && end) return `${start} - ${end}`;
  return start || end || "-";
}

function statValue(value: string | number | null) {
  if (value === null || value === undefined || value === "") return "-";
  return value;
}

export function PortfolioSetupScreen({ initialStatus, mode = "takeover" }: PortfolioSetupScreenProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [retrying, setRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    if (status.state !== "preparing") return;

    const interval = window.setInterval(async () => {
      try {
        const response = await fetch("/api/portfolio/setup-status", { cache: "no-store" });
        if (!response.ok) return;
        const next = (await response.json()) as PortfolioSetupStatus;
        setStatus(next);
        if (next.state === "ready") router.refresh();
      } catch {
        // Polling is best-effort; keep the current UI state if a poll fails.
      }
    }, 3000);

    return () => window.clearInterval(interval);
  }, [router, status.state]);

  const activeIndex = useMemo(
    () => Math.max(0, status.steps.findIndex((step) => step.id === status.currentStep)),
    [status.currentStep, status.steps]
  );
  const isReady = status.state === "ready";
  const isError = status.state === "error";
  const title = isReady
    ? "Your portfolio is ready"
    : status.state === "empty"
      ? "Import your portfolio"
      : "Preparing your portfolio";
  const subtitle = isReady
    ? "We've reconstructed your full investment history from your DeGiro transactions."
    : status.state === "empty"
      ? "Upload your DeGiro CSV to start building performance, exposure, and insight analytics."
      : "We're downloading historical market prices and calculating your complete portfolio history. This usually only happens once.";

  const retrySync = async () => {
    setRetrying(true);
    setRetryMessage(null);
    try {
      const response = await fetch("/api/sync-prices/full", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || "Unable to retry full sync.");
      }
      setRetryMessage("Full sync started. This page will update automatically.");
      const next = await fetch("/api/portfolio/setup-status", { cache: "no-store" });
      if (next.ok) setStatus((await next.json()) as PortfolioSetupStatus);
    } catch (error) {
      setRetryMessage(error instanceof Error ? error.message : "Unable to retry full sync.");
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className={mode === "banner" ? "ob-dashboard-state" : "ob-takeover"}>
      <div className="ob-card">
        {isReady ? (
          <div className="ob-success-wrap">
            <div className="ob-success-burst" />
            <div className="ob-success-circle">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 12.5l5 5.5L20 6" />
              </svg>
            </div>
          </div>
        ) : (
          <div className="ob-mark-wrap">
            <div className="ob-mark-ring" />
            <div className="ob-mark-ring" />
            <div className="ob-mark-ring" />
            <div className="ob-mark">E</div>
          </div>
        )}

        <div className="ob-eyebrow">{isReady ? "Setup complete" : "Setting up ETFMinded"}</div>
        <h1 className="ob-title">{title}</h1>
        <p className="ob-subtitle">{subtitle}</p>
        {!isReady && status.state !== "empty" ? (
          <span className="ob-eta">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3.5 2" />
            </svg>
            You can keep this page open.
          </span>
        ) : null}

        {status.state !== "empty" ? (
          <>
            <div className="ob-progress-wrap">
              <div className="ob-progress-top">
                <span>
                  Step {Math.min(activeIndex + 1, status.steps.length)} of {status.steps.length}
                </span>
                <span className="ob-progress-pct">{status.progressPct}%</span>
              </div>
              <div className="ob-progress-track">
                <div
                  className={`ob-progress-fill${status.state === "preparing" ? " ob-progress-active" : ""}`}
                  style={{ width: `${status.progressPct}%` }}
                />
              </div>
            </div>

            <div className="ob-checklist">
              {status.steps.map((step) => (
                <div className={`ob-step ${step.status}`} key={step.id}>
                  <div className="ob-step-icon">
                    <StepIcon status={step.status} />
                  </div>
                  <div>
                    <div className="ob-step-label">{step.label}</div>
                    {step.detail ? <div className="ob-step-detail">{step.detail}</div> : null}
                  </div>
                  <div className="ob-step-tag">
                    {step.status === "complete"
                      ? "Done"
                      : step.status === "running"
                        ? "In progress"
                        : step.status === "error"
                          ? "Action"
                          : "Queued"}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        <div className="ob-stats">
          <div className="ob-stat">
            <div className="ob-stat-label">Transactions</div>
            <div className="ob-stat-value">{statValue(status.stats.transactionsImported)}</div>
          </div>
          <div className="ob-stat">
            <div className="ob-stat-label">Investments</div>
            <div className="ob-stat-value">{statValue(status.stats.assetsFound)}</div>
          </div>
          <div className="ob-stat">
            <div className="ob-stat-label">History</div>
            <div className="ob-stat-value">{formatPeriod(status.stats.firstTransactionDate, status.stats.lastValuationDate)}</div>
          </div>
        </div>

        <p className={`ob-message${isError ? " warning-text" : ""}`}>{retryMessage || status.message}</p>

        <div className="ob-actions">
          {isReady ? (
            <Link className="btn btn-primary" href="/app">
              View dashboard
            </Link>
          ) : status.state === "empty" ? (
            <Link className="btn btn-primary" href="/app/import">
              Import DeGiro CSV
            </Link>
          ) : isError ? (
            <>
              <button className="btn btn-primary" type="button" onClick={retrySync} disabled={retrying}>
                {retrying ? "Retrying..." : "Retry full sync"}
              </button>
              <Link className="btn" href="/app/import">
                Go to import
              </Link>
            </>
          ) : (
            <Link className="btn" href="/app/import">
              View import page
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
