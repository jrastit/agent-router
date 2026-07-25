import { z } from "zod";

import {
  challengeSchema,
  hbarAmountSchema,
  type Challenge,
} from "../domain/schema";

const HBAR_DECIMALS = 8;
const TINYBARS_PER_HBAR = BigInt(100_000_000);
const hederaAccountSchema = z.string().regex(/^\d+\.\d+\.\d+$/);

export const paymentChallengeResponseSchema = z.strictObject({
  type: z.literal("hedera-hbar"),
  challenge: challengeSchema,
});

export type ChallengeExpectation = {
  quoteId: string;
  payerAccount: string;
  recipientAccount: string;
  network: "testnet";
  asset: "HBAR";
  amount: string;
  memo: string;
};

export class PaymentChallengeError extends Error {
  constructor(
    readonly code: "PAYMENT_CHALLENGE_EXPIRED" | "PAYMENT_CHALLENGE_MISMATCH",
    message: string,
  ) {
    super(message);
    this.name = "PaymentChallengeError";
  }
}

export function hbarToTinybars(amount: string): bigint {
  const parsed = hbarAmountSchema.parse(amount);
  const [whole, fraction = ""] = parsed.split(".");
  return (
    BigInt(whole) * TINYBARS_PER_HBAR +
    BigInt(fraction.padEnd(HBAR_DECIMALS, "0"))
  );
}

export function tinybarsToHbar(tinybars: bigint): string {
  if (tinybars < BigInt(0)) {
    throw new RangeError("tinybar amount cannot be negative");
  }
  const whole = tinybars / TINYBARS_PER_HBAR;
  const fraction = (tinybars % TINYBARS_PER_HBAR)
    .toString()
    .padStart(HBAR_DECIMALS, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function validatePaymentChallenge(
  input: unknown,
  expected: ChallengeExpectation,
  now = new Date(),
): Challenge {
  const challenge = challengeSchema.parse(input);
  if (new Date(challenge.expiresAt).getTime() <= now.getTime()) {
    throw new PaymentChallengeError(
      "PAYMENT_CHALLENGE_EXPIRED",
      "payment challenge has expired",
    );
  }

  hederaAccountSchema.parse(challenge.payerAccount);
  hederaAccountSchema.parse(challenge.recipientAccount);

  const mismatches: string[] = [];
  for (const field of [
    "quoteId",
    "payerAccount",
    "recipientAccount",
    "network",
    "asset",
    "memo",
  ] as const) {
    if (challenge[field] !== expected[field]) mismatches.push(field);
  }
  if (hbarToTinybars(challenge.amount) !== hbarToTinybars(expected.amount)) {
    mismatches.push("amount");
  }
  if (mismatches.length > 0) {
    throw new PaymentChallengeError(
      "PAYMENT_CHALLENGE_MISMATCH",
      `payment challenge mismatch: ${mismatches.join(", ")}`,
    );
  }
  return challenge;
}

export function createPaymentRequiredResponse(challenge: Challenge) {
  return {
    status: 402 as const,
    body: paymentChallengeResponseSchema.parse({
      type: "hedera-hbar",
      challenge,
    }),
  };
}
