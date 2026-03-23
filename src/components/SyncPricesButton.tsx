"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Renders a manual trigger for protected listing-level price synchronization.
export function SyncPricesButton() {
  const router = useRouter();
  const [recentLoading, setRecentLoading] = useState(false);
  const [fullLoading, setFullLoading] = useState(false);
  const [isharesLoading, setIsharesLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = useState<Date | null>(null);

  // Calls the sync endpoint and reports sync status feedback in the UI.
  async function runSync(
    endpoint: string,
    payload: Record<string, unknown>,
    setLoading: (value: boolean) => void,
    successMessage: string
  ) {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error || "Price sync failed.");
      } else {
        // Refresh server-rendered dashboard data in-place without a full page reload.
        router.refresh();
        setMessage(successMessage);
        setLastRunAt(new Date());
      }
    } catch {
      setMessage("Price sync failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="row row-start">
      <button
        type="button"
        onClick={() =>
          runSync(
            "/api/sync-prices/recent",
            {},
            setRecentLoading,
            "Sync last 4 weeks completed."
          )
        }
        disabled={recentLoading || fullLoading || isharesLoading}
      >
        {recentLoading ? "Syncing..." : "Sync last 4 weeks"}
      </button>
      <button
        type="button"
        onClick={() => runSync("/api/sync-prices/full", {}, setFullLoading, "Full sync completed.")}
        disabled={recentLoading || fullLoading || isharesLoading}
      >
        {fullLoading ? "Syncing..." : "Full sync"}
      </button>
      <button
        type="button"
        onClick={() =>
          runSync(
            "/api/admin/enrich-ishares",
            {},
            setIsharesLoading,
            "Exposure enrichment and normalization completed."
          )
        }
        disabled={recentLoading || fullLoading || isharesLoading}
      >
        {isharesLoading ? "Syncing..." : "Sync iShares enrichment"}
      </button>
      {message ? <small>{message}</small> : null}
      {lastRunAt ? <small>Last run: {lastRunAt.toISOString().slice(0, 19).replace("T", " ")}</small> : null}
    </div>
  );
}
