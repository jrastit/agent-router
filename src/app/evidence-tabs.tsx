"use client";

import { useEffect, useState } from "react";

import type { GraphActivity } from "../lib/projection/activity";
import styles from "./evidence-tabs.module.css";
import WorkflowTimeline from "./workflow-timeline";

const publicGraphUrl =
  "https://graph.router.fexhu.com/subgraphs/name/agent-router/hedera-projection";

function shortHash(hash: string) {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

function indexedTime(timestamp: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(Number(timestamp) * 1000));
}

function indexedIsoTime(timestamp: string) {
  return new Date(Number(timestamp) * 1000).toISOString();
}

export default function EvidenceTabs() {
  const [activeTab, setActiveTab] = useState<"run" | "graph">("run");
  const [activity, setActivity] = useState<GraphActivity>();
  const [error, setError] = useState("");

  useEffect(() => {
    if (activeTab !== "graph" || activity || error) return;
    const controller = new AbortController();
    fetch("/api/graph/latest", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        setActivity((await response.json()) as GraphActivity);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") {
          return;
        }
        setError("Latest Graph activity is temporarily unavailable.");
      });
    return () => controller.abort();
  }, [activeTab, activity, error]);

  return (
    <>
      <div className={styles.tabs} role="tablist" aria-label="Public evidence">
        <button
          className={styles.tab}
          type="button"
          role="tab"
          aria-selected={activeTab === "run"}
          onClick={() => setActiveTab("run")}
        >
          Run timeline
        </button>
        <button
          className={styles.tab}
          type="button"
          role="tab"
          aria-selected={activeTab === "graph"}
          onClick={() => setActiveTab("graph")}
        >
          Latest Graph activity
        </button>
      </div>

      {activeTab === "run" ? (
        <WorkflowTimeline />
      ) : (
        <section className={styles.graphPanel} aria-live="polite">
          <div className={styles.graphHeader}>
            <div>
              <h3>Latest indexed evidence</h3>
              <p>Public monitoring data from the AgentRouter Graph Node.</p>
            </div>
            <a
              className={styles.source}
              href={publicGraphUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open Graph endpoint ↗
            </a>
          </div>

          {!activity && !error && <p className={styles.empty}>Loading…</p>}
          {error && <p className={styles.empty}>{error}</p>}
          {activity && (
            <>
              <div className={styles.summary}>
                <div>
                  <span>Indexed block</span>
                  <strong>{activity._meta.block.number}</strong>
                </div>
                <div>
                  <span>Projection anchors</span>
                  <strong>{activity.hederaEventAnchors.length}</strong>
                </div>
                <div>
                  <span>Indexing errors</span>
                  <strong>No</strong>
                </div>
              </div>
              <div className={styles.eventList}>
                {activity.hederaEventAnchors.length === 0 && (
                  <p className={styles.empty}>No indexed anchors yet.</p>
                )}
                {activity.hederaEventAnchors.map((anchor) => (
                  <article className={styles.event} key={anchor.id}>
                    <div>
                      <span>
                        Projection anchor · destination block{" "}
                        {anchor.destinationBlockNumber}
                      </span>
                      <strong>
                        Hedera consensus {anchor.consensusTimestamp}
                      </strong>
                    </div>
                    <code title={anchor.destinationTransactionHash}>
                      EVM {shortHash(anchor.destinationTransactionHash)}
                    </code>
                    <time
                      dateTime={indexedIsoTime(
                        anchor.consensusTimestamp.split(".")[0],
                      )}
                    >
                      {indexedTime(anchor.consensusTimestamp.split(".")[0])} UTC
                    </time>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </>
  );
}
