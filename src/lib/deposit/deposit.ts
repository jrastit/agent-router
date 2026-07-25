import { createHash } from "node:crypto";

import { z } from "zod";

import {
  normalizeTransactionId,
  type VerifiedMirrorProof,
} from "../payment/mirror";

const accountIdSchema = z.string().regex(/^\d+\.\d+\.\d+$/);
const positiveTinybarsSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .refine((value) => BigInt(value) <= BigInt("9223372036854775807"), {
    message: "tinybars exceed signed bigint range",
  });

export const depositIntentSchema = z.strictObject({
  version: z.literal("1"),
  id: z.string().min(1),
  userId: z.string().uuid(),
  payerAccount: accountIdSchema,
  treasuryAccount: accountIdSchema,
  network: z.literal("testnet"),
  amountTinybars: positiveTinybarsSchema,
  memo: z.string().min(1).max(100),
  expiresAt: z.iso.datetime(),
  idempotencyKey: z.string().min(1).max(200),
});

export type DepositIntent = z.infer<typeof depositIntentSchema>;

export const depositStateSchema = z.enum([
  "intent_created",
  "submitted",
  "consensus_confirmed",
  "mirror_pending",
  "mirror_verified",
  "credited",
  "reconciliation_required",
  "rejected",
]);

export const projectionStateSchema = z.enum([
  "not_ready",
  "pending",
  "projected",
  "failed",
]);

export const graphIndexingStateSchema = z.enum([
  "not_ready",
  "pending",
  "indexed",
  "stale",
  "mismatched",
]);

export const depositObservedSchema = z.strictObject({
  version: z.literal("1"),
  depositId: z.string().min(1),
  userPseudonym: z.string().regex(/^[a-f0-9]{64}$/),
  transactionHash: z.string().min(1),
  amountTinybars: positiveTinybarsSchema,
  verifiedAt: z.iso.datetime(),
});

export type DepositObserved = z.infer<typeof depositObservedSchema>;

export class DepositVerificationError extends Error {
  constructor(
    readonly code:
      | "DEPOSIT_INTENT_EXPIRED"
      | "DEPOSIT_PROOF_MISMATCH"
      | "DEPOSIT_PROOF_OUTSIDE_INTENT_WINDOW",
    message: string,
  ) {
    super(message);
    this.name = "DepositVerificationError";
  }
}

function consensusTimestampToMilliseconds(timestamp: string): number {
  const [seconds] = timestamp.split(".");
  return Number(BigInt(seconds) * BigInt(1000));
}

export function verifyDepositProof(
  rawIntent: unknown,
  proof: VerifiedMirrorProof,
  transactionId: string,
  now = new Date(),
): DepositIntent {
  const intent = depositIntentSchema.parse(rawIntent);
  const expiresAt = new Date(intent.expiresAt);
  if (expiresAt.getTime() <= now.getTime()) {
    throw new DepositVerificationError(
      "DEPOSIT_INTENT_EXPIRED",
      "deposit intent has expired",
    );
  }

  const mismatches: string[] = [];
  if (proof.transactionId !== transactionId) mismatches.push("transactionId");
  if (proof.payerAccount !== intent.payerAccount) mismatches.push("payer");
  if (proof.recipientAccount !== intent.treasuryAccount)
    mismatches.push("recipient");
  if (proof.amountTinybars !== intent.amountTinybars)
    mismatches.push("amountTinybars");
  if (proof.memo !== intent.memo) mismatches.push("memo");
  if (proof.type !== "CRYPTOTRANSFER") mismatches.push("type");
  if (proof.result !== "SUCCESS") mismatches.push("result");
  if (
    normalizeTransactionId(proof.transactionId) !==
    normalizeTransactionId(transactionId)
  ) {
    mismatches.push("normalizedTransactionId");
  }
  if (mismatches.length > 0) {
    throw new DepositVerificationError(
      "DEPOSIT_PROOF_MISMATCH",
      `deposit proof mismatch: ${mismatches.join(", ")}`,
    );
  }
  if (
    consensusTimestampToMilliseconds(proof.consensusTimestamp) >
    expiresAt.getTime()
  ) {
    throw new DepositVerificationError(
      "DEPOSIT_PROOF_OUTSIDE_INTENT_WINDOW",
      "deposit reached consensus after the intent expired",
    );
  }
  return intent;
}

export function createDepositObserved(input: {
  intent: DepositIntent;
  transactionHash: string;
  verifiedAt: Date;
  pseudonymSalt: string;
}): DepositObserved {
  return depositObservedSchema.parse({
    version: "1",
    depositId: input.intent.id,
    userPseudonym: createHash("sha256")
      .update(`${input.pseudonymSalt}:${input.intent.userId}`)
      .digest("hex"),
    transactionHash: input.transactionHash,
    amountTinybars: input.intent.amountTinybars,
    verifiedAt: input.verifiedAt.toISOString(),
  });
}
