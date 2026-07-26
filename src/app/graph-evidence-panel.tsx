"use client";

import { useMemo, useState } from "react";
import { z } from "zod";

import {
  findPaymentOutputSchema,
  listAgentTransactionsOutputSchema,
  verifyReceiptHistoryOutputSchema,
} from "../mcp/graph-evidence/contracts";
import styles from "./graph-evidence-panel.module.css";

const recordedSourceEventId =
  "0xdb3a831451eedd88f68ff90d2d2a6343283b6164282cd600540babb673183a65";

const toolNames = [
  "find_payment",
  "list_agent_transactions",
  "verify_receipt_history",
] as const;
type ToolName = (typeof toolNames)[number];

const webResponseSchema = z.strictObject({
  protocol: z.literal("mcp"),
  toolCall: z.strictObject({
    name: z.enum(toolNames),
    arguments: z.record(z.string(), z.unknown()),
  }),
  result: z.union([
    findPaymentOutputSchema,
    listAgentTransactionsOutputSchema,
    verifyReceiptHistoryOutputSchema,
  ]),
});
type WebResponse = z.infer<typeof webResponseSchema>;
type PaymentEvidence =
  | z.infer<typeof findPaymentOutputSchema>["matches"][number]
  | z.infer<typeof verifyReceiptHistoryOutputSchema>["entries"][number];

const toolCopy: Record<
  ToolName,
  { label: string; field: string; hint: string }
> = {
  find_payment: {
    label: "Find payment",
    field: "Transaction or receipt reference",
    hint: "A bytes32 source-event ID, Hedera hash, or destination transaction hash.",
  },
  list_agent_transactions: {
    label: "List agent transactions",
    field: "Pseudonymous account or relayer",
    hint: "A public 20-byte address. Private application identities are never queried.",
  },
  verify_receipt_history: {
    label: "Verify receipt history",
    field: "Receipt references",
    hint: "One to twenty bytes32 references separated by commas.",
  },
};

export default function GraphEvidencePanel() {
  const [tool, setTool] = useState<ToolName>("find_payment");
  const [reference, setReference] = useState(recordedSourceEventId);
  const [response, setResponse] = useState<WebResponse>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const evidence = useMemo(() => {
    if (!response) return [];
    if (response.result.tool === "find_payment") {
      return response.result.matches;
    }
    if (response.result.tool === "verify_receipt_history") {
      return response.result.entries;
    }
    return response.result.anchors;
  }, [response]);

  async function submit() {
    setBusy(true);
    setError("");
    setResponse(undefined);
    try {
      const input =
        tool === "find_payment"
          ? { reference: reference.trim() }
          : tool === "list_agent_transactions"
            ? { account: reference.trim(), limit: 10 }
            : {
                references: reference
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean),
              };
      const result = await fetch("/api/graph-evidence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tool, input }),
      });
      const payload: unknown = await result.json();
      if (!result.ok) {
        throw new Error(
          isErrorPayload(payload)
            ? payload.error
            : "Graph evidence request failed",
        );
      }
      setResponse(webResponseSchema.parse(payload));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Graph evidence request failed",
      );
    } finally {
      setBusy(false);
    }
  }

  const provenance = response && primaryProvenance(response.result);

  return (
    <section
      className={styles.panel}
      id="graph-evidence-mcp"
      aria-labelledby="graph-evidence-title"
    >
      <div className={styles.heading}>
        <div>
          <p className="eyebrow">Reusable Graph payment-evidence MCP</p>
          <h2 id="graph-evidence-title">Inspect public agent transactions</h2>
        </div>
        <span>Read-only monitoring</span>
      </div>
      <p className={styles.intro}>
        Run the same MCP tools exposed to Claude, Cursor, ChatGPT, and generic
        MCP clients. Hedera Mirror verification and Postgres remain payment and
        credit authority.
      </p>

      <div className={styles.workspace}>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label>
            MCP tool
            <select
              value={tool}
              onChange={(event) => {
                const next = event.target.value as ToolName;
                setTool(next);
                setResponse(undefined);
                setError("");
                setReference(
                  next === "find_payment" ? recordedSourceEventId : "",
                );
              }}
            >
              {toolNames.map((name) => (
                <option key={name} value={name}>
                  {toolCopy[name].label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {toolCopy[tool].field}
            <textarea
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              spellCheck={false}
            />
            <small>{toolCopy[tool].hint}</small>
          </label>
          <button
            disabled={busy || reference.trim().length === 0}
            type="submit"
          >
            {busy ? "Querying MCP…" : "Run MCP tool"}
          </button>
          {error && <p className={styles.error}>{error}</p>}
        </form>

        <div className={styles.result} aria-live="polite">
          {!response && !error && (
            <p>
              Submit the recorded reference for a quick live Graph lookup. No
              Graph key, database credential, or Hedera key reaches the browser.
            </p>
          )}
          {response && (
            <>
              <div className={styles.toolCall}>
                <span>Structured MCP tool call</span>
                <code>{response.toolCall.name}</code>
                <pre>
                  {JSON.stringify(response.toolCall.arguments, null, 2)}
                </pre>
              </div>
              <div className={styles.provenance}>
                <div>
                  <span>Indexing status</span>
                  <strong>
                    {provenance?.completeness ?? "unavailable"} · block{" "}
                    {provenance?.indexedBlock ?? "—"}
                  </strong>
                </div>
                <div>
                  <span>Chains</span>
                  <strong>Hedera Testnet → Ganache 1337</strong>
                </div>
                <small>{provenance?.authority}</small>
                {provenance?.lagBlocks === null && (
                  <small>
                    Chain-head lag unknown: this Subgraph response exposes its
                    indexed block but no chain head.
                  </small>
                )}
              </div>
              {evidence.length === 0 && (
                <p className={styles.empty}>
                  The live Subgraph returned no matching evidence.
                </p>
              )}
              <div className={styles.cards}>
                {evidence.map((entry) => (
                  <EvidenceCard key={entry.sourceEventId} entry={entry} />
                ))}
              </div>
              {response.result.tool === "list_agent_transactions" &&
                response.result.economicEvents.length > 0 && (
                  <div className={styles.economic}>
                    <h3>Economic monitoring events</h3>
                    {response.result.economicEvents.map((event) => (
                      <div key={event.id}>
                        <code>{event.referenceId}</code>
                        <span>
                          type {event.eventType} · {event.amountTinybars}{" "}
                          tinybar
                        </span>
                      </div>
                    ))}
                  </div>
                )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function EvidenceCard({ entry }: { entry: PaymentEvidence }) {
  return (
    <article className={styles.card}>
      <div>
        <span>{entry.eventKind}</span>
        <strong>Destination block {entry.destinationBlockNumber}</strong>
      </div>
      <code>{entry.sourceEventId}</code>
      <dl>
        <div>
          <dt>Hedera consensus</dt>
          <dd>{entry.consensusTimestamp}</dd>
        </div>
        <div>
          <dt>Destination transaction</dt>
          <dd>{compact(entry.destinationTransactionHash)}</dd>
        </div>
      </dl>
      <a
        href={entry.links.hashScanTransaction}
        target="_blank"
        rel="noreferrer"
      >
        HashScan transaction ↗
      </a>
    </article>
  );
}

function compact(value: string) {
  return `${value.slice(0, 12)}…${value.slice(-8)}`;
}

function primaryProvenance(
  result: WebResponse["result"],
): z.infer<typeof findPaymentOutputSchema>["provenance"] | undefined {
  if (result.tool === "list_agent_transactions") {
    return result.provenance.projection;
  }
  return result.provenance;
}

function isErrorPayload(value: unknown): value is { error: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  );
}
