import type { Challenge } from "../domain/schema";
import {
  type ChallengeExpectation,
  validatePaymentChallenge,
} from "./challenge";
import {
  type HederaPaymentState,
  type HederaTransferTransport,
  submitHbarPayment,
} from "./hedera";

export type PaymentBudgetReservation = {
  reservationId: string;
  quoteId: string;
};

export async function settleReservedHbarPayment(input: {
  challenge: unknown;
  expected: ChallengeExpectation;
  idempotencyKey: string;
  reserveBudget: (request: {
    quoteId: string;
    idempotencyKey: string;
  }) => Promise<PaymentBudgetReservation>;
  transport: HederaTransferTransport;
  onState?: (state: HederaPaymentState) => Promise<void> | void;
  now?: () => Date;
}): Promise<{
  challenge: Challenge;
  reservation: PaymentBudgetReservation;
  consensus: Extract<HederaPaymentState, { status: "consensus_confirmed" }>;
}> {
  const now = input.now ?? (() => new Date());
  const challenge = validatePaymentChallenge(
    input.challenge,
    input.expected,
    now(),
  );
  const reservation = await input.reserveBudget({
    quoteId: challenge.quoteId,
    idempotencyKey: input.idempotencyKey,
  });
  if (reservation.quoteId !== challenge.quoteId) {
    throw new Error("budget reservation does not match payment quote");
  }
  const consensus = await submitHbarPayment(
    challenge,
    input.transport,
    input.onState,
    now,
  );
  return { challenge, reservation, consensus };
}
