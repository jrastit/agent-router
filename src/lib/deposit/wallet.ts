import { z } from "zod";

import type { UserSigningRequest } from "./workflow";

const hederaAccountIdSchema = z.string().regex(/^\d+\.\d+\.\d+$/);
const transactionIdSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+@(\d+\.\d+|\d+-\d+)$/);

export const depositWalletReviewSchema = z.strictObject({
  payer: hederaAccountIdSchema,
  treasury: hederaAccountIdSchema,
  network: z.literal("testnet"),
  amountTinybars: z.string().regex(/^[1-9]\d*$/),
  memo: z.string().min(1).max(100),
  expiresAt: z.string().datetime(),
});

export type DepositWalletReview = z.infer<typeof depositWalletReviewSchema>;

export function createDepositWalletReview(
  signingRequest: UserSigningRequest,
  now = new Date(),
): DepositWalletReview {
  const review = depositWalletReviewSchema.parse({
    payer: signingRequest.payerAccount,
    treasury: signingRequest.recipientAccount,
    network: signingRequest.network,
    amountTinybars: signingRequest.amountTinybars,
    memo: signingRequest.memo,
    expiresAt: signingRequest.expiresAt,
  });

  if (new Date(review.expiresAt).getTime() <= now.getTime()) {
    throw new Error("Deposit intent has expired");
  }

  return review;
}

export function assertWalletCanSign(
  review: DepositWalletReview,
  connectedAccount: string,
  now = new Date(),
): void {
  if (connectedAccount !== review.payer) {
    throw new Error("Connected wallet does not match the bound payer");
  }
  if (new Date(review.expiresAt).getTime() <= now.getTime()) {
    throw new Error("Deposit intent has expired");
  }
}

export function parseWalletTransactionId(result: unknown): string {
  const parsed = z
    .object({ transactionId: transactionIdSchema })
    .safeParse(result);
  if (!parsed.success) {
    throw new Error(
      "The wallet responded, but AgentRouter could not read the Hedera transaction ID. Check your wallet activity before retrying so you do not submit the payment twice.",
    );
  }
  return parsed.data.transactionId;
}
