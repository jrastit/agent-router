import { describe, expect, it, vi } from "vitest";

import type { Challenge } from "../domain/schema";
import {
  HederaPaymentError,
  type HederaPaymentState,
  submitHbarPayment,
} from "./hedera";

const challenge: Challenge = {
  version: "1",
  id: "challenge-1",
  quoteId: "quote-1",
  payerAccount: "0.0.1001",
  recipientAccount: "0.0.1002",
  network: "testnet",
  asset: "HBAR",
  amount: "0.1",
  memo: "agent-router:quote-1",
  expiresAt: "2026-07-25T13:00:00.000Z",
};

describe("Hedera payment submission", () => {
  it("publishes submitted and consensus states for one transfer", async () => {
    const states: HederaPaymentState[] = [];
    const submit = vi.fn(async () => ({
      transactionId: "0.0.1001@1.000000001",
      waitForConsensus: async () => ({ status: "SUCCESS" }),
    }));

    await expect(
      submitHbarPayment(challenge, { submit }, (state) => {
        states.push(state);
      }),
    ).resolves.toMatchObject({ status: "consensus_confirmed" });
    expect(submit).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ amountTinybars: BigInt(10_000_000) }),
    );
    expect(states.map(({ status }) => status)).toEqual([
      "submitted",
      "consensus_confirmed",
    ]);
  });

  it("requires reconciliation and never resubmits an ambiguous transfer", async () => {
    const submit = vi.fn(async () => ({
      transactionId: "0.0.1001@1.000000001",
      waitForConsensus: async () => {
        throw new Error("receipt timeout");
      },
    }));

    await expect(submitHbarPayment(challenge, { submit })).rejects.toEqual(
      expect.objectContaining<Partial<HederaPaymentError>>({
        state: expect.objectContaining({
          status: "reconciliation_required",
          transactionId: "0.0.1001@1.000000001",
        }),
      }),
    );
    expect(submit).toHaveBeenCalledOnce();
  });
});
