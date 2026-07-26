"use client";

import { useEffect, useMemo, useState } from "react";

import {
  runnableLlmInstancesSchema,
  type RunnableLlmInstance,
} from "../lib/llm-jobs/catalog";
import { estimateMaximumLlmCharge } from "../lib/llm-jobs/pricing";
import {
  llmJobSnapshotSchema,
  type LlmJobSnapshot,
} from "../lib/llm-jobs/snapshot";
import styles from "./llm-job-panel.module.css";

const storedJobKey = "agent-router.last-llm-job.v1";

export default function LlmJobPanel({ accessToken }: { accessToken?: string }) {
  const [instances, setInstances] = useState<RunnableLlmInstance[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [instanceId, setInstanceId] = useState("");
  const [prompt, setPrompt] = useState(
    "Summarize why durable, exact accounting matters for autonomous agents.",
  );
  const [maximumInputTokens, setMaximumInputTokens] = useState(512);
  const [maximumOutputTokens, setMaximumOutputTokens] = useState(128);
  const [spendCeilingTinybars, setSpendCeilingTinybars] = useState("1000000");
  const [snapshot, setSnapshot] = useState<LlmJobSnapshot>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/llm-job-instances", { cache: "no-store" })
      .then(async (response) => {
        const payload: unknown = await response.json();
        if (!response.ok) {
          throw new Error(runnableCatalogMessage(payload));
        }
        return runnableLlmInstancesSchema.parse(payload);
      })
      .then((catalog) => {
        setInstances(catalog);
        setInstanceId((current) => current || catalog[0]?.id || "");
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Runnable LLM instances are unavailable.",
        ),
      )
      .finally(() => setCatalogLoaded(true));
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    const savedJob = window.localStorage.getItem(storedJobKey);
    if (savedJob) void restore(savedJob, accessToken, setSnapshot, setError);
  }, [accessToken]);

  const selected = instances.find((instance) => instance.id === instanceId);
  const maximumCharge = useMemo(() => {
    if (!selected) return "0";
    return estimateMaximumLlmCharge({
      maximumInputTokens,
      maximumOutputTokens,
      inputTinybarsPerMillionTokens: selected.input_price_tinybar_per_million,
      outputTinybarsPerMillionTokens: selected.output_price_tinybar_per_million,
    });
  }, [maximumInputTokens, maximumOutputTokens, selected]);
  const ceilingCoversMaximum =
    /^(0|[1-9]\d*)$/.test(spendCeilingTinybars) &&
    BigInt(spendCeilingTinybars) >= BigInt(maximumCharge);

  async function runJob() {
    if (!accessToken || !selected) return;
    setBusy(true);
    setError("");
    setSnapshot(undefined);
    try {
      const idempotencyKey = `llm-ui-${crypto.randomUUID()}`;
      const submission = await fetch("/api/llm-jobs", {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          instanceId: selected.id,
          prompt,
          capability: "chat",
          privacy: selected.privacy,
          maximumInputTokens,
          maximumOutputTokens,
          spendCeilingTinybars,
        }),
      });
      const submitted = (await submission.json()) as {
        id?: string;
        error?: string;
      };
      if (!submission.ok || !submitted.id) {
        throw new Error(submitted.error ?? "Job submission failed");
      }
      window.localStorage.setItem(storedJobKey, submitted.id);

      const execution = await fetch(
        `/api/llm-jobs/${encodeURIComponent(submitted.id)}/execute`,
        {
          method: "POST",
          headers: { authorization: `Bearer ${accessToken}` },
        },
      );
      if (!execution.ok) throw new Error("Job execution failed");
      await restore(submitted.id, accessToken, setSnapshot, setError);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "LLM job failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.panel} id="llm-jobs" aria-live="polite">
      <div className={styles.heading}>
        <div>
          <p className="eyebrow">Balance-backed agent execution</p>
          <h2>Run a real LLM instance</h2>
        </div>
        <span>{accessToken ? "Signed in" : "Connect your account first"}</span>
      </div>

      <div className={styles.workspace}>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            void runJob();
          }}
        >
          <label>
            Instance
            <select
              value={instanceId}
              onChange={(event) => setInstanceId(event.target.value)}
            >
              {instances.map((instance) => (
                <option key={instance.id} value={instance.id}>
                  {instance.provider} · {instance.model_id} · {instance.privacy}
                  {" · "}
                  {instance.performance_score}/100
                </option>
              ))}
            </select>
          </label>
          {catalogLoaded && instances.length === 0 && !error && (
            <p className={styles.error}>
              No enabled chat instances currently have fresh execution prices.
            </p>
          )}
          <label>
            Private prompt
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
          </label>
          <div className={styles.limits}>
            <label>
              Max input tokens
              <input
                type="number"
                min="1"
                value={maximumInputTokens}
                onChange={(event) =>
                  setMaximumInputTokens(Number(event.target.value))
                }
              />
            </label>
            <label>
              Max output tokens
              <input
                type="number"
                min="1"
                value={maximumOutputTokens}
                onChange={(event) =>
                  setMaximumOutputTokens(Number(event.target.value))
                }
              />
            </label>
            <label>
              Spend ceiling (tinybar)
              <input
                inputMode="numeric"
                value={spendCeilingTinybars}
                onChange={(event) =>
                  setSpendCeilingTinybars(event.target.value)
                }
              />
            </label>
          </div>
          <div className={styles.review}>
            <span>Maximum reservation</span>
            <strong>{maximumCharge} tinybar</strong>
            <small>
              {selected?.privacy ?? "—"} · exact price snapshot · unused credit
              refunded
            </small>
          </div>
          <button
            type="submit"
            disabled={
              busy || !accessToken || !selected || !ceilingCoversMaximum
            }
          >
            {busy ? "Executing once…" : "Reserve credit and run"}
          </button>
          {error && <p className={styles.error}>{error}</p>}
        </form>

        <div className={styles.result}>
          {!snapshot && (
            <p>
              The authoritative result will appear here. Refreshing restores the
              persisted job without repeating inference or charging again.
            </p>
          )}
          {snapshot && (
            <>
              <div className={styles.state}>
                <span>{snapshot.state.replaceAll("_", " ")}</span>
                <strong>{snapshot.selectedInstance.name}</strong>
                <small>{snapshot.selectedInstance.model}</small>
              </div>
              {snapshot.output && (
                <pre className={styles.output}>{snapshot.output}</pre>
              )}
              <dl>
                <div>
                  <dt>Token usage</dt>
                  <dd>
                    {snapshot.usage
                      ? `${snapshot.usage.promptTokens} + ${snapshot.usage.completionTokens} = ${snapshot.usage.totalTokens}`
                      : "Pending"}
                  </dd>
                </div>
                <div>
                  <dt>Reserved / charged / refunded</dt>
                  <dd>
                    {snapshot.accounting
                      ? `${snapshot.accounting.reservedTinybars} / ${snapshot.accounting.chargedTinybars} / ${snapshot.accounting.refundedTinybars} tinybar`
                      : "Pending"}
                  </dd>
                </div>
                <div>
                  <dt>Remaining balance</dt>
                  <dd>{snapshot.remainingBalanceTinybars} tinybar</dd>
                </div>
                <div>
                  <dt>Execution evidence</dt>
                  <dd>
                    {snapshot.evidence?.executionId ?? "Pending"}
                    <small>{snapshot.evidence?.verificationLabel ?? "—"}</small>
                  </dd>
                </div>
              </dl>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export function runnableCatalogMessage(payload: unknown) {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("code" in payload) ||
    typeof payload.code !== "string"
  ) {
    return "Runnable LLM instances are unavailable.";
  }
  switch (payload.code) {
    case "configuration_error":
      return "Runnable LLM catalog is not configured on the server.";
    case "catalog_unauthorized":
      return "Runnable LLM catalog authentication failed.";
    case "catalog_query_failed":
      return "Runnable LLM catalog schema or query is unavailable.";
    case "catalog_response_invalid":
      return "Runnable LLM catalog returned invalid data.";
    default:
      return "Runnable LLM instances are unavailable.";
  }
}

async function restore(
  jobId: string,
  accessToken: string,
  setSnapshot: (snapshot: LlmJobSnapshot) => void,
  setError: (message: string) => void,
) {
  try {
    const response = await fetch(`/api/llm-jobs/${encodeURIComponent(jobId)}`, {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Saved LLM job is unavailable");
    setSnapshot(llmJobSnapshotSchema.parse(await response.json()));
  } catch (reason) {
    setError(reason instanceof Error ? reason.message : "Restore failed");
  }
}
