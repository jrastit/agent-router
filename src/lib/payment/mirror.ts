import { z } from "zod";

import type { Challenge } from "../domain/schema";
import { hbarToTinybars } from "./challenge";

const mirrorTransferSchema = z.strictObject({
  account: z.string(),
  amount: z.number().int().safe(),
  is_approval: z.boolean().optional(),
});

const mirrorTransactionSchema = z
  .object({
    consensus_timestamp: z.string().regex(/^\d+\.\d+$/),
    memo_base64: z.string(),
    name: z.string(),
    result: z.string(),
    transaction_id: z.string(),
    transfers: z.array(mirrorTransferSchema),
  })
  .passthrough();

const mirrorResponseSchema = z
  .object({ transactions: z.array(mirrorTransactionSchema) })
  .passthrough();

export type VerifiedMirrorProof = {
  transactionId: string;
  consensusTimestamp: string;
  payerAccount: string;
  recipientAccount: string;
  amountTinybars: string;
  memo: string;
  type: "CRYPTOTRANSFER";
  result: "SUCCESS";
};

export class MirrorVerificationError extends Error {
  constructor(
    readonly code:
      | "MIRROR_PENDING"
      | "MIRROR_UNAVAILABLE"
      | "PAYMENT_CHALLENGE_MISMATCH"
      | "PAYMENT_PROOF_REPLAYED",
    message: string,
  ) {
    super(message);
    this.name = "MirrorVerificationError";
  }
}

export function normalizeTransactionId(transactionId: string): string {
  const [account, validStart] = transactionId.split("@");
  if (!account || !validStart) return transactionId;
  const [seconds, nanos] = validStart.includes(".")
    ? validStart.split(".")
    : validStart.split("-");
  return seconds && nanos ? `${account}-${seconds}-${nanos}` : transactionId;
}

export function verifyMirrorResponse(
  input: unknown,
  challenge: Challenge,
  transactionId: string,
): VerifiedMirrorProof {
  const response = mirrorResponseSchema.parse(input);
  const normalizedId = normalizeTransactionId(transactionId);
  const transaction = response.transactions.find(
    (candidate) => candidate.transaction_id === normalizedId,
  );
  if (!transaction) {
    throw new MirrorVerificationError(
      "MIRROR_PENDING",
      "transaction is not indexed by the mirror node",
    );
  }

  const amountTinybars = hbarToTinybars(challenge.amount);
  const recipientCredit = transaction.transfers
    .filter(({ account }) => account === challenge.recipientAccount)
    .reduce((sum, { amount }) => sum + BigInt(amount), BigInt(0));
  const payerDebit = transaction.transfers
    .filter(({ account }) => account === challenge.payerAccount)
    .reduce((sum, { amount }) => sum + BigInt(amount), BigInt(0));
  const memo = Buffer.from(transaction.memo_base64, "base64").toString("utf8");

  const valid =
    transaction.name === "CRYPTOTRANSFER" &&
    transaction.result === "SUCCESS" &&
    recipientCredit === amountTinybars &&
    payerDebit <= -amountTinybars &&
    memo === challenge.memo;
  if (!valid) {
    throw new MirrorVerificationError(
      "PAYMENT_CHALLENGE_MISMATCH",
      "mirror transaction does not match the bound payment challenge",
    );
  }

  return {
    transactionId,
    consensusTimestamp: transaction.consensus_timestamp,
    payerAccount: challenge.payerAccount,
    recipientAccount: challenge.recipientAccount,
    amountTinybars: amountTinybars.toString(),
    memo,
    type: "CRYPTOTRANSFER",
    result: "SUCCESS",
  };
}

export async function fetchAndVerifyMirrorProof(
  mirrorNodeUrl: string,
  transactionId: string,
  challenge: Challenge,
  fetcher: typeof fetch = fetch,
  timeoutMs = 10_000,
): Promise<VerifiedMirrorProof> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetcher(
      `${mirrorNodeUrl.replace(/\/$/, "")}/api/v1/transactions/${encodeURIComponent(
        normalizeTransactionId(transactionId),
      )}`,
      {
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      },
    );
  } catch {
    throw new MirrorVerificationError(
      "MIRROR_UNAVAILABLE",
      controller.signal.aborted
        ? "mirror node verification timed out"
        : "mirror node verification request failed",
    );
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 404) {
    throw new MirrorVerificationError(
      "MIRROR_PENDING",
      "transaction is not indexed by the mirror node",
    );
  }
  if (!response.ok) {
    throw new MirrorVerificationError(
      "MIRROR_UNAVAILABLE",
      `mirror node returned HTTP ${response.status}`,
    );
  }
  return verifyMirrorResponse(await response.json(), challenge, transactionId);
}

export function assertUnusedProof(
  transactionId: string,
  usedTransactionIds: ReadonlySet<string>,
): void {
  if (usedTransactionIds.has(transactionId)) {
    throw new MirrorVerificationError(
      "PAYMENT_PROOF_REPLAYED",
      "transaction proof was already used",
    );
  }
}
