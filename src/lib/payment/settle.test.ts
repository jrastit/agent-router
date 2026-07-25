import { describe, expect, it, vi } from "vitest";

import { settleReservedHbarPayment } from "./settle";

const challenge = {
  version: "1" as const,
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
const expected = {
  quoteId: "quote-1",
  payerAccount: "0.0.1001",
  recipientAccount: "0.0.1002",
  network: "testnet" as const,
  asset: "HBAR" as const,
  amount: "0.1",
  memo: "agent-router:quote-1",
};

describe("reserved settlement", () => {
  it("reserves the bound quote before submitting one transfer", async () => {
    const order: string[] = [];
    const reserveBudget = vi.fn(async () => {
      order.push("reserve");
      return { reservationId: "reservation-1", quoteId: "quote-1" };
    });
    const submit = vi.fn(async () => {
      order.push("submit");
      return {
        transactionId: "0.0.1001@1.000000001",
        waitForConsensus: async () => ({ status: "SUCCESS" }),
      };
    });

    await settleReservedHbarPayment({
      challenge,
      expected,
      idempotencyKey: "settlement-1",
      reserveBudget,
      transport: { submit },
      now: () => new Date("2026-07-25T12:00:00.000Z"),
    });
    expect(order).toEqual(["reserve", "submit"]);
  });

  it("does not reserve or submit an invalid challenge", async () => {
    const reserveBudget = vi.fn();
    const submit = vi.fn();
    await expect(
      settleReservedHbarPayment({
        challenge: { ...challenge, amount: "0.2" },
        expected,
        idempotencyKey: "settlement-1",
        reserveBudget,
        transport: { submit },
        now: () => new Date("2026-07-25T12:00:00.000Z"),
      }),
    ).rejects.toThrow(/mismatch/);
    expect(reserveBudget).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });
});
