"use client";

import { useEffect, useState } from "react";

import type { LlmInstanceCatalog } from "../lib/llm-instances/schema";
import styles from "./llm-instances-panel.module.css";

export default function LlmInstancesPanel() {
  const [catalog, setCatalog] = useState<LlmInstanceCatalog>();
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetchCatalog(controller.signal)
      .then(setCatalog)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") {
          return;
        }
        setError("The LLM instance catalog is temporarily unavailable.");
      });
    return () => controller.abort();
  }, []);

  function exportCatalog() {
    if (!catalog) return;
    const blob = new Blob([`${JSON.stringify(catalog, null, 2)}\n`], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "llm-instances.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className={styles.panel} aria-live="polite">
      <div className={styles.header}>
        <div>
          <h3>LLM instances</h3>
          <p>
            Server-owned routing metadata. Credentials remain in environment
            variables and are never included here.
          </p>
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={exportCatalog} disabled={!catalog}>
            Export JSON
          </button>
        </div>
      </div>

      {!catalog && !error && <p className={styles.notice}>Loading…</p>}
      {error && <p className={`${styles.notice} ${styles.error}`}>{error}</p>}

      {catalog && (
        <>
          <div className={styles.summary}>
            <span>Schema v{catalog.version}</span>
            <span>{catalog.instances.length} configured instances</span>
            <code>Supabase · live catalog</code>
          </div>
          <div className={styles.grid}>
            {catalog.instances.map((instance) => (
              <article className={styles.instance} key={instance.id}>
                <div className={styles.instanceTitle}>
                  <div>
                    <span>{instance.provider}</span>
                    <h4>{instance.name}</h4>
                  </div>
                  <b data-enabled={instance.enabled}>
                    {instance.enabled ? "Enabled" : "Disabled"}
                  </b>
                </div>
                <dl>
                  <div>
                    <dt>Model</dt>
                    <dd>{instance.model}</dd>
                  </div>
                  <div>
                    <dt>Privacy</dt>
                    <dd>{instance.privacy}</dd>
                  </div>
                  <div>
                    <dt>Expected latency</dt>
                    <dd>{instance.expectedLatencyMs} ms</dd>
                  </div>
                  <div>
                    <dt>Capabilities</dt>
                    <dd>{instance.capabilities.join(", ")}</dd>
                  </div>
                  <div>
                    <dt>Input / output price</dt>
                    <dd>
                      {instance.inputPriceEurPerMillionTokens ?? "—"} /{" "}
                      {instance.outputPriceEurPerMillionTokens ?? "—"} EUR / 1M
                      tokens
                    </dd>
                  </div>
                </dl>
                <code className={styles.url}>{instance.baseUrl}</code>
                {instance.providerAddress && (
                  <code className={styles.url}>{instance.providerAddress}</code>
                )}
                {instance.notes && <p>{instance.notes}</p>}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

async function fetchCatalog(signal: AbortSignal) {
  const response = await fetch("/api/llm-instances", { signal });
  if (!response.ok) throw new Error("Catalog unavailable");
  return (await response.json()) as LlmInstanceCatalog;
}
