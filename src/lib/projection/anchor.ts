import { createHash } from "node:crypto";

import { z } from "zod";

const bytes32Schema = z.string().regex(/^0x[a-fA-F0-9]{64}$/);
const consensusTimestampSchema = z.string().regex(/^\d+\.\d{1,9}$/);
const hederaEntityIdSchema = z.string().regex(/^\d+\.\d+\.\d+$/);

const commonAnchorFields = {
  version: z.literal("1"),
  network: z.literal("hedera-testnet"),
  transactionHash: bytes32Schema,
  consensusTimestamp: consensusTimestampSchema,
  eventKind: z.string().regex(/^[a-z][a-z0-9._-]{0,63}$/),
  payloadDigest: bytes32Schema,
};

const contractLogAnchorSchema = z.strictObject({
  ...commonAnchorFields,
  sourceType: z.literal("contract_log"),
  sourceId: hederaEntityIdSchema,
  sourceIndex: z.number().int().nonnegative(),
});

const hcsMessageAnchorSchema = z.strictObject({
  ...commonAnchorFields,
  sourceType: z.literal("hcs_message"),
  sourceId: hederaEntityIdSchema,
  sourceIndex: z.number().int().nonnegative(),
});

export const hederaEventAnchorSchema = z.discriminatedUnion("sourceType", [
  contractLogAnchorSchema,
  hcsMessageAnchorSchema,
]);

export type HederaEventAnchor = z.infer<typeof hederaEventAnchorSchema>;

function encodeIdentityPart(value: string | number): string {
  const text = String(value);
  return `${Buffer.byteLength(text, "utf8")}:${text}`;
}

/**
 * Produces the bytes32 replay key shared by the durable relay and destination
 * contract. Every field identifying the Hedera source event is included.
 */
export function createHederaSourceEventId(raw: unknown): `0x${string}` {
  const anchor = hederaEventAnchorSchema.parse(raw);
  const identity = [
    anchor.version,
    anchor.network,
    anchor.sourceType,
    anchor.sourceId,
    anchor.transactionHash.toLowerCase(),
    anchor.consensusTimestamp,
    anchor.sourceIndex,
  ]
    .map(encodeIdentityPart)
    .join("|");

  return `0x${createHash("sha256").update(identity).digest("hex")}`;
}

export function createProjectionIdempotencyKey(raw: unknown): string {
  return `hedera-anchor:${createHederaSourceEventId(raw)}`;
}
