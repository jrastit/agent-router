import { describe, expect, it } from "vitest";

import {
  digestAuditValue,
  encodeAuditAnchor,
  hashscanTopicUrl,
  hashscanTransactionUrl,
} from "./audit";

describe("public Hedera audit anchors", () => {
  it("hashes canonical values deterministically", () => {
    expect(digestAuditValue({ b: 2, a: 1 })).toBe(
      digestAuditValue({ a: 1, b: 2 }),
    );
  });

  it("encodes only the strict compact decision contract", () => {
    const encoded = encodeAuditAnchor({
      version: "1",
      kind: "decision",
      jobId: "job-1",
      decisionId: "decision-1",
      quoteId: "quote-1",
      policyDigest: digestAuditValue({ budgetMinor: 100 }),
      decisionDigest: digestAuditValue({ selectedProviderId: "provider-1" }),
      occurredAt: "2026-07-25T12:00:00.000Z",
    });
    expect(JSON.parse(Buffer.from(encoded).toString("utf8"))).toEqual(
      expect.not.objectContaining({
        prompt: expect.anything(),
        input: expect.anything(),
        artifact: expect.anything(),
        rationale: expect.anything(),
      }),
    );
  });

  it("rejects confidential or narrative fields", () => {
    expect(() =>
      encodeAuditAnchor({
        version: "1",
        kind: "receipt",
        jobId: "job-1",
        receiptId: "receipt-1",
        transactionId: "0.0.1001@1.000000001",
        receiptDigest: digestAuditValue({ amountTinybars: "10000000" }),
        occurredAt: "2026-07-25T12:00:00.000Z",
        prompt: "secret",
      } as never),
    ).toThrow();
  });

  it("creates testnet HashScan evidence links", () => {
    expect(hashscanTransactionUrl("0.0.1@2.3")).toContain(
      "/testnet/transaction/",
    );
    expect(hashscanTopicUrl("0.0.456")).toBe(
      "https://hashscan.io/testnet/topic/0.0.456",
    );
  });
});
