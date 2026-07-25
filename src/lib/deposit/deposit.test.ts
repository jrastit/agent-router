import { describe, expect, it } from "vitest";

import type { VerifiedMirrorProof } from "../payment/mirror";
import {
  createDepositObserved,
  depositIntentSchema,
  verifyDepositProof,
} from "./deposit";

const intent = depositIntentSchema.parse({
  version: "1",
  id: "deposit-1",
  userId: "00000000-0000-4000-8000-000000000001",
  payerAccount: "0.0.1001",
  treasuryAccount: "0.0.2001",
  network: "testnet",
  amountTinybars: "10000000",
  memo: "agent-router:deposit-1",
  expiresAt: "2026-07-25T13:00:00.000Z",
  idempotencyKey: "deposit-request-1",
});
const transactionId = "0.0.1001@1784984399.000000001";
const proof: VerifiedMirrorProof = {
  transactionId,
  consensusTimestamp: "1784984399.000000001",
  payerAccount: intent.payerAccount,
  recipientAccount: intent.treasuryAccount,
  amountTinybars: intent.amountTinybars,
  memo: intent.memo,
  type: "CRYPTOTRANSFER",
  result: "SUCCESS",
};

describe("user deposit contracts", () => {
  it("binds a successful proof to every authoritative intent field", () => {
    expect(
      verifyDepositProof(
        intent,
        proof,
        transactionId,
        new Date("2026-07-25T12:00:00Z"),
      ),
    ).toEqual(intent);
  });

  it.each([
    ["payer", { payerAccount: "0.0.9999" }],
    ["recipient", { recipientAccount: "0.0.9999" }],
    ["amount", { amountTinybars: "9999999" }],
    ["memo", { memo: "wrong" }],
    ["transaction", { transactionId: "0.0.1001@1.000000001" }],
  ])("rejects a mismatched %s", (_name, patch) => {
    expect(() =>
      verifyDepositProof(
        intent,
        { ...proof, ...patch },
        transactionId,
        new Date("2026-07-25T12:00:00Z"),
      ),
    ).toThrow(/mismatch/);
  });

  it("rejects verification after expiry and consensus outside the window", () => {
    expect(() =>
      verifyDepositProof(
        intent,
        proof,
        transactionId,
        new Date("2026-07-25T13:00:00Z"),
      ),
    ).toThrow(/expired/);
    expect(() =>
      verifyDepositProof(
        intent,
        { ...proof, consensusTimestamp: "1784984401.000000001" },
        transactionId,
        new Date("2026-07-25T12:00:00Z"),
      ),
    ).toThrow(/after the intent expired/);
  });

  it("emits only the versioned privacy-minimal monitoring payload", () => {
    const observed = createDepositObserved({
      intent,
      transactionHash: "0xabc",
      verifiedAt: new Date("2026-07-25T12:01:00Z"),
      pseudonymSalt: "test-only-salt",
    });
    expect(Object.keys(observed).sort()).toEqual(
      [
        "amountTinybars",
        "depositId",
        "transactionHash",
        "userPseudonym",
        "verifiedAt",
        "version",
      ].sort(),
    );
    expect(JSON.stringify(observed)).not.toContain(intent.userId);
    expect(observed.userPseudonym).toMatch(/^[a-f0-9]{64}$/);
  });
});
