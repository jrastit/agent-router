"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import {
  authenticatedUserId,
  loadFundActivity,
  subscribeToFundActivity,
  type FundActivity,
  type FundActivityEntry,
  type FundRealtimeClient,
} from "../lib/funds/activity";

const entryLabels: Record<FundActivityEntry["kind"], string> = {
  deposit: "Deposit credited",
  reservation: "Funds reserved",
  charge: "Provider spend",
  refund: "Balance refunded",
  release: "Reservation released",
  reconciliation: "Reconciliation",
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function hbar(tinybars: string) {
  const value = BigInt(tinybars);
  const tinybarsPerHbar = BigInt(100_000_000);
  const whole = value / tinybarsPerHbar;
  const fractional = (value % tinybarsPerHbar)
    .toString()
    .padStart(8, "0")
    .replace(/0+$/, "");
  return `${whole}${fractional ? `.${fractional}` : ""} HBAR`;
}

function hashScanTransaction(transactionId: string) {
  return `https://hashscan.io/testnet/transaction/${encodeURIComponent(
    transactionId,
  )}`;
}

export default function EconomicActivityPanel({
  accessToken,
}: {
  accessToken?: string;
}) {
  const [activity, setActivity] = useState<FundActivity>();
  const [error, setError] = useState("");
  const [realtimeState, setRealtimeState] = useState("Realtime connecting");
  let userId: string | undefined;
  if (accessToken) {
    try {
      userId = authenticatedUserId(accessToken);
    } catch {
      userId = undefined;
    }
  }

  useEffect(() => {
    if (!accessToken || !userId || !supabaseUrl || !supabasePublishableKey) {
      return;
    }

    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let refreshRunning = false;
    let refreshAgain = false;
    const config = {
      url: supabaseUrl,
      publishableKey: supabasePublishableKey,
      accessToken,
    };
    const client = createClient(supabaseUrl, supabasePublishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { authorization: `Bearer ${accessToken}` } },
    });
    client.realtime.setAuth(accessToken);

    async function refresh() {
      if (refreshRunning) {
        refreshAgain = true;
        return;
      }
      refreshRunning = true;
      try {
        const next = await loadFundActivity(config);
        if (active) {
          setActivity(next);
          setError("");
        }
      } catch {
        if (active) {
          setError("Authoritative fund activity is temporarily unavailable.");
        }
      } finally {
        refreshRunning = false;
        if (refreshAgain && active) {
          refreshAgain = false;
          void refresh();
        }
      }
    }

    function scheduleRefresh() {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void refresh(), 75);
    }

    const unsubscribe = subscribeToFundActivity(
      client as unknown as FundRealtimeClient,
      userId,
      scheduleRefresh,
      (status) => {
        if (!active) return;
        setRealtimeState(
          status === "SUBSCRIBED"
            ? "Realtime connected"
            : status === "CHANNEL_ERROR" || status === "TIMED_OUT"
              ? "Realtime reconnecting"
              : "Realtime connecting",
        );
      },
    );

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") void refresh();
    }
    document.addEventListener("visibilitychange", refreshWhenVisible);
    void refresh();

    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      unsubscribe();
    };
  }, [accessToken, userId]);

  const displayedRealtimeState = !accessToken
    ? "Waiting for account"
    : !userId
      ? "Session unavailable"
      : realtimeState;

  return (
    <section className="fund-activity" aria-labelledby="fund-activity-title">
      <div className="fund-activity-heading">
        <div>
          <p className="eyebrow">Authoritative application ledger</p>
          <h3 id="fund-activity-title">User deposits and spending</h3>
          <p>
            Exact HBAR credit from your private Supabase ledger, refreshed after
            every durable account change.
          </p>
        </div>
        <span className="fund-source-status">{displayedRealtimeState}</span>
      </div>

      {!accessToken && (
        <p className="fund-empty">
          Connect your AgentRouter account to load your private fund activity.
        </p>
      )}
      {accessToken && !userId && (
        <p className="fund-empty">
          Your account session is invalid. Connect again.
        </p>
      )}
      {accessToken && userId && !activity && !error && (
        <p className="fund-empty">Loading authoritative fund activity…</p>
      )}
      {accessToken && userId && error && <p className="fund-empty">{error}</p>}

      {accessToken && userId && activity && (
        <>
          <dl className="fund-summary">
            <div>
              <dt>Available</dt>
              <dd>{hbar(activity.availableTinybars)}</dd>
            </div>
            <div>
              <dt>Reserved</dt>
              <dd>{hbar(activity.reservedTinybars)}</dd>
            </div>
            <div>
              <dt>Spent</dt>
              <dd>{hbar(activity.spentTinybars)}</dd>
            </div>
            <div>
              <dt>Refunded</dt>
              <dd>{hbar(activity.refundedTinybars)}</dd>
            </div>
          </dl>

          <div className="fund-history">
            <div className="fund-history-heading">
              <h4>Account history</h4>
              <span>{activity.entries.length} durable entries</span>
            </div>
            {activity.entries.length === 0 && (
              <p className="fund-empty">No application fund events yet.</p>
            )}
            {activity.entries.map((entry) => (
              <article key={entry.id}>
                <div>
                  <strong>{entryLabels[entry.kind]}</strong>
                  <span>
                    {new Date(entry.createdAt).toLocaleString("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                {entry.transactionId ? (
                  <a
                    href={hashScanTransaction(entry.transactionId)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    HashScan proof ↗
                  </a>
                ) : (
                  <code>{entry.kind}</code>
                )}
                <b>{hbar(entry.amountTinybars)}</b>
              </article>
            ))}
          </div>
          <p className="fund-disclaimer">
            Hedera Mirror verification and this durable ledger are
            authoritative. The Graph audit projection below is independent
            monitoring evidence.
          </p>
        </>
      )}
    </section>
  );
}
