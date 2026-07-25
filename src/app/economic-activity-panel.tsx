"use client";

import { useEffect, useState } from "react";

import type {
  EconomicActivity,
  EconomicEvent,
} from "../lib/projection/economic-activity";

const eventLabels: Record<number, string> = {
  1: "Deposit observed",
  2: "Deposit credited",
  3: "Balance debited",
  4: "Funds reserved",
  5: "Provider spend",
  6: "Refund",
  7: "Reconciliation opened",
};

function hbar(tinybars: string) {
  const value = BigInt(tinybars);
  const sign = value < BigInt(0) ? "-" : "";
  const absolute = value < BigInt(0) ? -value : value;
  const tinybarsPerHbar = BigInt(100_000_000);
  const whole = absolute / tinybarsPerHbar;
  const fractional = (absolute % tinybarsPerHbar)
    .toString()
    .padStart(8, "0")
    .replace(/0+$/, "");
  return `${sign}${whole}${fractional ? `.${fractional}` : ""} HBAR`;
}

function shortDigest(value: string) {
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function eventDirection(event: EconomicEvent) {
  return event.eventType === 2 || event.eventType === 6 ? "+" : "−";
}

export default function EconomicActivityPanel() {
  const [activity, setActivity] = useState<EconomicActivity>();
  const [error, setError] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/graph/economic-activity", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        const result = (await response.json()) as EconomicActivity;
        setActivity(result);
        setSelectedSubject(result.users[0]?.subject ?? "");
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError")
          return;
        setError("Live user fund activity is temporarily unavailable.");
      });
    return () => controller.abort();
  }, []);

  const selected =
    activity?.users.find((user) => user.subject === selectedSubject) ??
    activity?.users[0];

  return (
    <section className="fund-activity" aria-labelledby="fund-activity-title">
      <div className="fund-activity-heading">
        <div>
          <p className="eyebrow">Live indexed account activity</p>
          <h3 id="fund-activity-title">User deposits and spending</h3>
          <p>
            Exact HBAR amounts projected from public Hedera economic events.
            Users are shown by a privacy-preserving account digest.
          </p>
        </div>
        {activity && (
          <a href={activity.sourceUrl} target="_blank" rel="noreferrer">
            Graph block {activity.indexedBlock} ↗
          </a>
        )}
      </div>

      {!activity && !error && <p className="fund-empty">Loading live data…</p>}
      {error && <p className="fund-empty">{error}</p>}
      {activity?.users.length === 0 && (
        <p className="fund-empty">No indexed user fund events yet.</p>
      )}

      {selected && (
        <>
          <label className="account-picker">
            User
            <select
              value={selected.subject}
              onChange={(event) => setSelectedSubject(event.target.value)}
            >
              {activity?.users.map((user, index) => (
                <option value={user.subject} key={user.subject}>
                  User {index + 1} · {shortDigest(user.subject)}
                </option>
              ))}
            </select>
          </label>

          <dl className="fund-summary">
            <div>
              <dt>Available</dt>
              <dd>{hbar(selected.availableTinybars)}</dd>
            </div>
            <div>
              <dt>Deposited</dt>
              <dd>{hbar(selected.depositedTinybars)}</dd>
            </div>
            <div>
              <dt>Spent</dt>
              <dd>{hbar(selected.spentTinybars)}</dd>
            </div>
            <div>
              <dt>Refunded</dt>
              <dd>{hbar(selected.refundedTinybars)}</dd>
            </div>
          </dl>

          <div className="fund-history">
            <div className="fund-history-heading">
              <h4>Account history</h4>
              <span>{selected.events.length} indexed events</span>
            </div>
            {selected.events.map((event) => (
              <article key={event.id}>
                <div>
                  <strong>{eventLabels[event.eventType]}</strong>
                  <span>
                    {new Date(
                      Number(event.blockTimestamp) * 1000,
                    ).toLocaleString("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                <code title={event.transactionHash}>
                  {shortDigest(event.transactionHash)}
                </code>
                <b>
                  {eventDirection(event)}
                  {hbar(
                    BigInt(event.amountTinybars) < BigInt(0)
                      ? (-BigInt(event.amountTinybars)).toString()
                      : event.amountTinybars,
                  )}
                </b>
              </article>
            ))}
          </div>
          <p className="fund-disclaimer">
            Graph data is a public monitoring view. Mirror-verified Hedera
            payment proofs and the application ledger remain authoritative.
          </p>
        </>
      )}
    </section>
  );
}
