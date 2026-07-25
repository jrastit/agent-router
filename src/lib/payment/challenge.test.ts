import { describe, expect, it } from "vitest";

import {
  createPaymentRequiredResponse,
  hbarToTinybars,
  tinybarsToHbar,
  validatePaymentChallenge,
} from "./challenge";

const challenge = {
  version: "1" as const,
  id: "challenge-1",
  quoteId: "quote-1",
  payerAccount: "0.0.1001",
  recipientAccount: "0.0.1002",
  network: "testnet",
  asset: "HBAR",
  amount: "1.23000000",
  memo: "agent-router:quote-1",
  expiresAt: "2026-07-25T13:00:00.000Z",
};

const expected = {
  quoteId: "quote-1",
  payerAccount: "0.0.1001",
  recipientAccount: "0.0.1002",
  network: "testnet" as const,
  asset: "HBAR" as const,
  amount: "1.23",
  memo: "agent-router:quote-1",
};

describe("payment challenge", () => {
  it("uses exact tinybar arithmetic", () => {
    expect(hbarToTinybars("1.23000000")).toBe(BigInt(123_000_000));
    expect(tinybarsToHbar(BigInt(123_000_001))).toBe("1.23000001");
  });

  it("accepts a valid challenge and creates a versioned 402 response", () => {
    expect(
      validatePaymentChallenge(
        challenge,
        expected,
        new Date("2026-07-25T12:00:00.000Z"),
      ),
    ).toEqual(challenge);
    expect(createPaymentRequiredResponse(challenge)).toMatchObject({
      status: 402,
      body: { type: "hedera-hbar", challenge: { version: "1" } },
    });
  });

  it("rejects expiry", () => {
    expect(() =>
      validatePaymentChallenge(
        challenge,
        expected,
        new Date("2026-07-25T13:00:00.000Z"),
      ),
    ).toThrow(/expired/);
  });

  it.each([
    ["network", { network: "mainnet" }],
    ["asset", { asset: "USDC" }],
    ["recipient", { recipientAccount: "0.0.9999" }],
    ["memo", { memo: "different" }],
    ["quote", { quoteId: "quote-2" }],
    ["amount", { amount: "1.23000001" }],
  ])("rejects a mismatched %s", (_label, patch) => {
    expect(() =>
      validatePaymentChallenge(
        { ...challenge, ...patch },
        expected,
        new Date("2026-07-25T12:00:00.000Z"),
      ),
    ).toThrow(/mismatch/);
  });
});
