import { describe, expect, it, vi } from "vitest";

import { ZgChainProvenanceAdapter, type ZgChainClient } from "./0g-chain";

const receiptHash = `0x${"12".repeat(32)}`;
const otherHash = `0x${"34".repeat(32)}`;
const transactionHash = `0x${"ab".repeat(32)}`;
const evidence = {
  receiptHash,
  transactionHash,
  blockNumber: "42",
};

function client(overrides: Partial<ZgChainClient> = {}): ZgChainClient {
  return {
    anchor: vi.fn().mockResolvedValue(evidence),
    inspect: vi.fn().mockResolvedValue(evidence),
    isAnchored: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe("ZgChainProvenanceAdapter", () => {
  it("anchors a receipt and returns finalized transaction evidence", async () => {
    const adapter = new ZgChainProvenanceAdapter(
      client({ isAnchored: vi.fn().mockResolvedValue(false) }),
    );

    await expect(
      adapter.anchor({
        receiptHash,
        network: "0g-galileo-testnet",
        idempotencyKey: "receipt-1",
      }),
    ).resolves.toEqual({ transactionHash, blockNumber: "42" });
  });

  it("independently checks the transaction event and contract state", async () => {
    const adapter = new ZgChainProvenanceAdapter(client());

    await expect(
      adapter.verify({
        receiptHash,
        network: "0g-galileo-testnet",
        transactionHash,
      }),
    ).resolves.toEqual({
      verified: true,
      anchoredReceiptHash: receiptHash,
      blockNumber: "42",
    });
  });

  it("detects a transaction event bound to another receipt", async () => {
    const adapter = new ZgChainProvenanceAdapter(
      client({
        inspect: vi.fn().mockResolvedValue({
          ...evidence,
          receiptHash: otherHash,
        }),
      }),
    );

    await expect(
      adapter.verify({
        receiptHash,
        network: "0g-galileo-testnet",
        transactionHash,
      }),
    ).resolves.toMatchObject({ verified: false });
  });

  it("fails closed while a transaction is absent or unfinalized", async () => {
    const adapter = new ZgChainProvenanceAdapter(
      client({ inspect: vi.fn().mockResolvedValue(null) }),
    );

    await expect(
      adapter.verify({
        receiptHash,
        network: "0g-galileo-testnet",
        transactionHash,
      }),
    ).rejects.toMatchObject({ code: "TRANSACTION_NOT_FINAL" });
  });
});
