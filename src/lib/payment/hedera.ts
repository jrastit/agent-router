import type { Challenge } from "../domain/schema";
import { hbarToTinybars } from "./challenge";

export type HederaPaymentState =
  | {
      status: "submitted";
      transactionId: string;
      submittedAt: string;
    }
  | {
      status: "consensus_confirmed";
      transactionId: string;
      submittedAt: string;
      consensusConfirmedAt: string;
    }
  | {
      status: "reconciliation_required";
      transactionId?: string;
      submittedAt?: string;
      reason: string;
    };

export interface HederaTransferTransport {
  submit(input: {
    payerAccount: string;
    recipientAccount: string;
    amountTinybars: bigint;
    memo: string;
  }): Promise<{
    transactionId: string;
    waitForConsensus(): Promise<{ status: string }>;
  }>;
}

export class HederaPaymentError extends Error {
  constructor(
    readonly state: Extract<
      HederaPaymentState,
      { status: "reconciliation_required" }
    >,
  ) {
    super(state.reason);
    this.name = "HederaPaymentError";
  }
}

export async function submitHbarPayment(
  challenge: Challenge,
  transport: HederaTransferTransport,
  onState: (state: HederaPaymentState) => Promise<void> | void = () => {},
  now: () => Date = () => new Date(),
): Promise<Extract<HederaPaymentState, { status: "consensus_confirmed" }>> {
  let transactionId: string | undefined;
  let submittedAt: string | undefined;
  try {
    const response = await transport.submit({
      payerAccount: challenge.payerAccount,
      recipientAccount: challenge.recipientAccount,
      amountTinybars: hbarToTinybars(challenge.amount),
      memo: challenge.memo,
    });
    transactionId = response.transactionId;
    submittedAt = now().toISOString();
    await onState({ status: "submitted", transactionId, submittedAt });

    const receipt = await response.waitForConsensus();
    if (receipt.status !== "SUCCESS") {
      throw new Error(`Hedera consensus status was ${receipt.status}`);
    }
    const confirmed = {
      status: "consensus_confirmed" as const,
      transactionId,
      submittedAt,
      consensusConfirmedAt: now().toISOString(),
    };
    await onState(confirmed);
    return confirmed;
  } catch (error) {
    const state = {
      status: "reconciliation_required" as const,
      transactionId,
      submittedAt,
      reason: error instanceof Error ? error.message : "unknown Hedera outcome",
    };
    await onState(state);
    throw new HederaPaymentError(state);
  }
}
