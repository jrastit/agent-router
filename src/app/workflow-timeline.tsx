"use client";

import { useEffect, useMemo, useState } from "react";

import type { Event } from "../lib/domain/schema";
import {
  demoJobId,
  demoRunSummary,
  demoWorkflowEvents,
} from "../lib/workflow/demo-run";

type StreamState = "connecting" | "live" | "retryable" | "complete";

const labels: Record<Event["type"], string> = {
  "job.created": "Request",
  "requirements.ready": "Requirements",
  "providers.discovered": "Discover",
  "quotes.evaluated": "Compare",
  "provider.selected": "Select",
  "execution.requested": "Execute",
  "payment.required": "Payment",
  "payment.submitted": "Submitted",
  "payment.consensus_confirmed": "Consensus",
  "payment.mirror_verified": "Verify",
  "execution.completed": "Deliver",
  "receipt.recorded": "Record",
  "job.failed": "Failed",
};

function eventDetail(event: Event) {
  return typeof event.payload.detail === "string"
    ? event.payload.detail
    : labels[event.type];
}

export default function WorkflowTimeline() {
  const [events, setEvents] = useState<Event[]>(demoWorkflowEvents);
  const [streamState, setStreamState] = useState<StreamState>("connecting");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const lastSequence = events.at(-1)?.sequence ?? -1;
    const source = new EventSource(
      `/api/workflows/${demoJobId}/events?after=${lastSequence}`,
    );
    source.onopen = () => setStreamState("live");
    source.addEventListener("workflow", (message) => {
      const event = JSON.parse((message as MessageEvent).data) as Event;
      setEvents((current) =>
        current.some((item) => item.sequence === event.sequence)
          ? current
          : [...current, event].sort((a, b) => a.sequence - b.sequence),
      );
    });
    source.addEventListener("complete", () => {
      setStreamState("complete");
      source.close();
    });
    source.onerror = () => {
      setStreamState("retryable");
      source.close();
    };
    return () => source.close();
    // Reconnect only when the observer explicitly retries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const mirrorPending = useMemo(() => {
    const confirmed = events.some(
      (event) => event.type === "payment.consensus_confirmed",
    );
    const verified = events.some(
      (event) => event.type === "payment.mirror_verified",
    );
    return confirmed && !verified;
  }, [events]);
  const failure = events.find((event) => event.type === "job.failed");
  const delivery = events.find((event) => event.type === "execution.completed")
    ?.payload.delivery;

  return (
    <>
      <div
        className={`stream-state ${failure ? "terminal" : ""}`}
        role="status"
        aria-live="polite"
      >
        <span>
          {failure
            ? `Run ended: ${eventDetail(failure)}`
            : mirrorPending
              ? "Payment confirmed; verifying public record"
              : streamState === "connecting"
                ? "Restored persisted timeline · reconnecting"
                : streamState === "retryable"
                  ? "Timeline paused · safe to retry"
                  : streamState === "live"
                    ? "Timeline connected"
                    : "Complete persisted run"}
        </span>
        {streamState === "retryable" && (
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry timeline
          </button>
        )}
      </div>

      {events.length === 0 ? (
        <div className="empty-state">
          No workflow events have been recorded.
        </div>
      ) : (
        <ol className="timeline">
          {events.map((event) => (
            <li key={event.id}>
              <span>{String(event.sequence + 1).padStart(2, "0")}</span>
              <div>
                <strong>{labels[event.type]}</strong>
                <p>{eventDetail(event)}</p>
                <time dateTime={event.occurredAt}>
                  {new Date(event.occurredAt).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    timeZone: "UTC",
                  })}{" "}
                  UTC
                </time>
              </div>
            </li>
          ))}
        </ol>
      )}

      {typeof delivery === "string" && (
        <section className="delivery" aria-labelledby="delivery-title">
          <div>
            <span>Delivered result</span>
            <strong id="delivery-title">Summarization complete</strong>
          </div>
          <p>{delivery}</p>
        </section>
      )}

      <div className="receipt">
        <div>
          <span>Settlement receipt</span>
          <strong>Mirror verified</strong>
          <small>{demoRunSummary.receiptId}</small>
        </div>
        <dl>
          <div>
            <dt>Total spend</dt>
            <dd>${(demoRunSummary.totalSpendMinor / 100).toFixed(2)}</dd>
          </div>
          <div>
            <dt>Remaining budget</dt>
            <dd>${(demoRunSummary.remainingBudgetMinor / 100).toFixed(2)}</dd>
          </div>
          <div>
            <dt>Settlement</dt>
            <dd>{demoRunSummary.amountTinybars} tinybars</dd>
          </div>
        </dl>
        <a
          href={demoRunSummary.transactionUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open receipt ↗
        </a>
      </div>
    </>
  );
}
