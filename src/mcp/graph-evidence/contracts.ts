import { z } from "zod";

export const bytes32Schema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

export const accountReferenceSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);

export const findPaymentInputSchema = z.strictObject({
  reference: bytes32Schema.describe(
    "Source-event ID, Hedera transaction hash, or destination transaction hash",
  ),
});

export const listAgentTransactionsInputSchema = z.strictObject({
  account: accountReferenceSchema.describe(
    "Pseudonymous economic subject or destination relayer address",
  ),
  limit: z.number().int().min(1).max(50).default(10),
});

export const verifyReceiptHistoryInputSchema = z.strictObject({
  references: z.array(bytes32Schema).min(1).max(20),
});

export const graphProvenanceSchema = z.strictObject({
  endpoint: z.string().url(),
  subgraph: z.string(),
  indexedBlock: z.number().int().nonnegative(),
  hasIndexingErrors: z.boolean(),
  completeness: z.enum(["indexed", "lagging", "unavailable"]),
  chainHeadBlock: z.number().int().nonnegative().nullable(),
  lagBlocks: z.number().int().nonnegative().nullable(),
  chain: z.strictObject({
    source: z.literal("hedera-testnet"),
    destination: z.literal("ganache-local"),
    destinationChainId: z.literal("1337"),
  }),
  authority: z.literal(
    "monitoring-only; Hedera Mirror and Postgres remain authoritative",
  ),
});

export const paymentEvidenceSchema = z.strictObject({
  sourceEventId: bytes32Schema,
  sourceType: z.number().int().nonnegative(),
  sourceId: z.string(),
  hederaTransactionHash: bytes32Schema,
  consensusTimestamp: z.string(),
  sourceIndex: z.string().regex(/^(0|[1-9]\d*)$/),
  eventKind: z.string(),
  payloadDigest: bytes32Schema,
  schemaVersion: z.number().int().positive(),
  relayer: accountReferenceSchema,
  destinationContract: accountReferenceSchema,
  destinationTransactionHash: bytes32Schema,
  destinationBlockNumber: z.string().regex(/^(0|[1-9]\d*)$/),
  destinationBlockTimestamp: z.string().regex(/^(0|[1-9]\d*)$/),
  links: z.strictObject({
    hashScanTransaction: z.string().url(),
    destinationExplorer: z.string().url().nullable(),
  }),
});

export const economicEvidenceSchema = z.strictObject({
  id: bytes32Schema,
  subject: accountReferenceSchema,
  eventType: z.number().int().min(1).max(7),
  amountTinybars: z.string().regex(/^-?(0|[1-9]\d*)$/),
  referenceId: bytes32Schema,
  payloadDigest: bytes32Schema,
  transactionHash: bytes32Schema,
  blockNumber: z.string().regex(/^(0|[1-9]\d*)$/),
  blockTimestamp: z.string().regex(/^(0|[1-9]\d*)$/),
});

export const findPaymentOutputSchema = z.strictObject({
  tool: z.literal("find_payment"),
  reference: bytes32Schema,
  matches: z.array(paymentEvidenceSchema),
  provenance: graphProvenanceSchema,
});

export const listAgentTransactionsOutputSchema = z.strictObject({
  tool: z.literal("list_agent_transactions"),
  account: accountReferenceSchema,
  anchors: z.array(paymentEvidenceSchema),
  economicEvents: z.array(economicEvidenceSchema),
  provenance: z.strictObject({
    projection: graphProvenanceSchema,
    economic: graphProvenanceSchema,
  }),
});

export const verifyReceiptHistoryOutputSchema = z.strictObject({
  tool: z.literal("verify_receipt_history"),
  verified: z.boolean(),
  missingReferences: z.array(bytes32Schema),
  duplicateDestinationTransactions: z.array(bytes32Schema),
  entries: z.array(paymentEvidenceSchema),
  provenance: graphProvenanceSchema,
});

export type FindPaymentOutput = z.infer<typeof findPaymentOutputSchema>;
export type ListAgentTransactionsOutput = z.infer<
  typeof listAgentTransactionsOutputSchema
>;
export type VerifyReceiptHistoryOutput = z.infer<
  typeof verifyReceiptHistoryOutputSchema
>;
