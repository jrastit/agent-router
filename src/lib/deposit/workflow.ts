import { randomUUID } from "node:crypto";

import { tinybarsToHbar } from "../payment/challenge";
import {
  fetchAndVerifyMirrorProof,
  type VerifiedMirrorProof,
} from "../payment/mirror";
import {
  createDepositObserved,
  type DepositIntent,
  depositIntentSchema,
  verifyDepositProof,
} from "./deposit";

export type DepositStore = {
  createIntent(intent: DepositIntent): Promise<DepositIntent>;
  submitProof(depositId: string, transactionId: string): Promise<void>;
  creditVerified(input: {
    intent: DepositIntent;
    proof: VerifiedMirrorProof;
    observed: ReturnType<typeof createDepositObserved>;
    idempotencyKey: string;
  }): Promise<{ availableTinybars: string; credited: boolean }>;
};

export type UserSigningRequest = {
  type: "hedera-hbar-user-deposit";
  network: "testnet";
  payerAccount: string;
  recipientAccount: string;
  amountTinybars: string;
  memo: string;
  expiresAt: string;
};

export function createUserSigningRequest(
  intent: DepositIntent,
): UserSigningRequest {
  return {
    type: "hedera-hbar-user-deposit",
    network: intent.network,
    payerAccount: intent.payerAccount,
    recipientAccount: intent.treasuryAccount,
    amountTinybars: intent.amountTinybars,
    memo: intent.memo,
    expiresAt: intent.expiresAt,
  };
}

export async function createUserDeposit(input: {
  store: DepositStore;
  userId: string;
  payerAccount: string;
  treasuryAccount: string;
  amountTinybars: string;
  idempotencyKey: string;
  now?: Date;
  ttlMilliseconds?: number;
  id?: string;
}): Promise<{ intent: DepositIntent; signingRequest: UserSigningRequest }> {
  const now = input.now ?? new Date();
  const id = input.id ?? randomUUID();
  const intent = depositIntentSchema.parse({
    version: "1",
    id,
    userId: input.userId,
    payerAccount: input.payerAccount,
    treasuryAccount: input.treasuryAccount,
    network: "testnet",
    amountTinybars: input.amountTinybars,
    memo: `agent-router:deposit:${id}`,
    expiresAt: new Date(
      now.getTime() + (input.ttlMilliseconds ?? 5 * 60_000),
    ).toISOString(),
    idempotencyKey: input.idempotencyKey,
  });
  const saved = await input.store.createIntent(intent);
  return { intent: saved, signingRequest: createUserSigningRequest(saved) };
}

export async function verifyAndCreditUserDeposit(input: {
  store: DepositStore;
  intent: DepositIntent;
  transactionId: string;
  mirrorNodeUrl: string;
  pseudonymSalt: string;
  fetcher?: typeof fetch;
  now?: Date;
}): Promise<{ availableTinybars: string; credited: boolean }> {
  await input.store.submitProof(input.intent.id, input.transactionId);
  const challenge = {
    version: "1" as const,
    id: input.intent.id,
    quoteId: input.intent.id,
    payerAccount: input.intent.payerAccount,
    recipientAccount: input.intent.treasuryAccount,
    network: input.intent.network,
    asset: "HBAR" as const,
    amount: tinybarsToHbar(BigInt(input.intent.amountTinybars)),
    memo: input.intent.memo,
    expiresAt: input.intent.expiresAt,
  };
  const proof = await fetchAndVerifyMirrorProof(
    input.mirrorNodeUrl,
    input.transactionId,
    challenge,
    input.fetcher,
  );
  const verifiedAt = input.now ?? new Date();
  verifyDepositProof(input.intent, proof, input.transactionId);
  return input.store.creditVerified({
    intent: input.intent,
    proof,
    observed: createDepositObserved({
      intent: input.intent,
      transactionHash: input.transactionId,
      verifiedAt,
      pseudonymSalt: input.pseudonymSalt,
    }),
    idempotencyKey: `credit:${input.intent.id}`,
  });
}

export class TreasuryInventoryError extends Error {
  readonly code = "INSUFFICIENT_0G_TREASURY";
}

export async function executeFromPrefundedOgTreasury<T>(input: {
  requiredOgAmount: bigint;
  availableOgAmount: bigint;
  exchangeRateSnapshot: {
    hbarUsd: string;
    ogUsd: string;
    capturedAt: string;
  };
  treasuryLiabilityTinybars: string;
  execute: () => Promise<T>;
}): Promise<{
  result: T;
  exchangeRateSnapshot: typeof input.exchangeRateSnapshot;
  treasuryLiabilityTinybars: string;
}> {
  if (
    input.requiredOgAmount <= BigInt(0) ||
    input.availableOgAmount < input.requiredOgAmount
  ) {
    throw new TreasuryInventoryError(
      "separately pre-funded 0G treasury balance is insufficient",
    );
  }
  const result = await input.execute();
  return {
    result,
    exchangeRateSnapshot: input.exchangeRateSnapshot,
    treasuryLiabilityTinybars: input.treasuryLiabilityTinybars,
  };
}
