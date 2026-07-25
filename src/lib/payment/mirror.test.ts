import { describe, expect, it } from "vitest";

import type { Challenge } from "../domain/schema";
import {
  assertUnusedProof,
  fetchAndVerifyMirrorProof,
  normalizeTransactionId,
  verifyMirrorResponse,
} from "./mirror";

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
const transactionId = "0.0.1001@1753444800.000000001";
const transaction = {
  consensus_timestamp: "1753444802.000000001",
  memo_base64: Buffer.from(challenge.memo).toString("base64"),
  name: "CRYPTOTRANSFER",
  result: "SUCCESS",
  transaction_id: normalizeTransactionId(transactionId),
  transfers: [
    { account: challenge.payerAccount, amount: -10_010_000 },
    { account: challenge.recipientAccount, amount: 10_000_000 },
    { account: "0.0.3", amount: 10_000 },
  ],
};

describe("Mirror Node proof verification", () => {
  it("verifies success, type, accounts, exact recipient amount, and memo", () => {
    expect(
      verifyMirrorResponse(
        { transactions: [transaction] },
        challenge,
        transactionId,
      ),
    ).toMatchObject({
      transactionId,
      amountTinybars: "10000000",
      type: "CRYPTOTRANSFER",
      result: "SUCCESS",
    });
  });

  it.each([
    ["result", { result: "INSUFFICIENT_ACCOUNT_BALANCE" }],
    ["type", { name: "CONSENSUSSUBMITMESSAGE" }],
    ["memo", { memo_base64: Buffer.from("wrong").toString("base64") }],
    [
      "recipient",
      {
        transfers: [
          { account: challenge.payerAccount, amount: -10_010_000 },
          { account: challenge.recipientAccount, amount: 9_999_999 },
        ],
      },
    ],
  ])("rejects a mismatched %s", (_label, patch) => {
    expect(() =>
      verifyMirrorResponse(
        { transactions: [{ ...transaction, ...patch }] },
        challenge,
        transactionId,
      ),
    ).toThrow(/does not match/);
  });

  it("rejects replayed transaction IDs", () => {
    expect(() =>
      assertUnusedProof(transactionId, new Set([transactionId])),
    ).toThrow(/already used/);
  });

  it("keeps indexing delay recoverable and reports outages stably", async () => {
    await expect(
      fetchAndVerifyMirrorProof(
        "https://mirror.example",
        transactionId,
        challenge,
        async () => new Response(null, { status: 404 }),
      ),
    ).rejects.toMatchObject({ code: "MIRROR_PENDING" });
    await expect(
      fetchAndVerifyMirrorProof(
        "https://mirror.example",
        transactionId,
        challenge,
        async () => new Response(null, { status: 504 }),
      ),
    ).rejects.toMatchObject({ code: "MIRROR_UNAVAILABLE" });
  });

  it("turns a mirror timeout into a stable recoverable error", async () => {
    await expect(
      fetchAndVerifyMirrorProof(
        "https://mirror.example",
        transactionId,
        challenge,
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
        1,
      ),
    ).rejects.toMatchObject({
      code: "MIRROR_UNAVAILABLE",
      message: "mirror node verification timed out",
    });
  });
});
