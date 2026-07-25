import { describe, expect, it } from "vitest";

import type { UserSigningRequest } from "./workflow";
import {
  assertWalletCanSign,
  createDepositWalletReview,
  parseWalletTransactionId,
} from "./wallet";

const request: UserSigningRequest = {
  type: "hedera-hbar-user-deposit",
  network: "testnet",
  payerAccount: "0.0.1001",
  recipientAccount: "0.0.2002",
  amountTinybars: "100000",
  memo: "agent-router:deposit:deposit-1",
  expiresAt: "2026-07-25T20:05:00.000Z",
};

describe("external wallet deposit contract", () => {
  it("keeps every intent binding visible in the approval review", () => {
    expect(
      createDepositWalletReview(request, new Date("2026-07-25T20:00:00Z")),
    ).toEqual({
      payer: "0.0.1001",
      treasury: "0.0.2002",
      network: "testnet",
      amountTinybars: "100000",
      memo: "agent-router:deposit:deposit-1",
      expiresAt: "2026-07-25T20:05:00.000Z",
    });
  });

  it("rejects an expired intent and a connected-account mismatch", () => {
    expect(() =>
      createDepositWalletReview(request, new Date("2026-07-25T20:05:00Z")),
    ).toThrow("expired");

    const review = createDepositWalletReview(
      request,
      new Date("2026-07-25T20:00:00Z"),
    );
    expect(() =>
      assertWalletCanSign(review, "0.0.9999", new Date("2026-07-25T20:01:00Z")),
    ).toThrow("does not match");
  });

  it("accepts only a Hedera transaction ID from the wallet", () => {
    expect(
      parseWalletTransactionId({
        transactionId: "0.0.1001@1785012345.123456789",
      }),
    ).toBe("0.0.1001@1785012345.123456789");
    expect(() =>
      parseWalletTransactionId({
        transactionId: "0xprivate-transaction-payload",
      }),
    ).toThrow("transaction ID");
  });
});
