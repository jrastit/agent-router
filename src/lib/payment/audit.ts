import { createHash } from "node:crypto";

import { z } from "zod";

const timestamp = z.string().datetime({ offset: true });
const digest = z.string().regex(/^[a-f0-9]{64}$/);

export const auditAnchorSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    version: z.literal("1"),
    kind: z.literal("decision"),
    jobId: z.string().min(1),
    decisionId: z.string().min(1),
    quoteId: z.string().min(1),
    policyDigest: digest,
    decisionDigest: digest,
    occurredAt: timestamp,
  }),
  z.strictObject({
    version: z.literal("1"),
    kind: z.literal("receipt"),
    jobId: z.string().min(1),
    receiptId: z.string().min(1),
    transactionId: z.string().min(1),
    receiptDigest: digest,
    occurredAt: timestamp,
  }),
]);

export type AuditAnchor = z.infer<typeof auditAnchorSchema>;

export function digestAuditValue(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function encodeAuditAnchor(anchor: AuditAnchor): Uint8Array {
  return Buffer.from(JSON.stringify(auditAnchorSchema.parse(anchor)), "utf8");
}

export function hashscanTransactionUrl(
  transactionId: string,
  network = "testnet",
): string {
  return `https://hashscan.io/${network}/transaction/${encodeURIComponent(
    transactionId,
  )}`;
}

export function hashscanTopicUrl(topicId: string, network = "testnet"): string {
  return `https://hashscan.io/${network}/topic/${encodeURIComponent(topicId)}`;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(",")}}`;
}
