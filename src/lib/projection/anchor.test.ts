import { describe, expect, it } from "vitest";

import {
  createHederaSourceEventId,
  createProjectionIdempotencyKey,
  hederaEventAnchorSchema,
} from "./anchor";

const anchor = {
  version: "1" as const,
  network: "hedera-testnet" as const,
  sourceType: "contract_log" as const,
  sourceId: "0.0.7001",
  transactionHash: `0x${"ab".repeat(32)}`,
  consensusTimestamp: "1721234567.123456789",
  sourceIndex: 2,
  eventKind: "deposit.observed",
  payloadDigest: `0x${"cd".repeat(32)}`,
};

describe("HederaEventAnchor", () => {
  it("accepts a native HBAR transfer as a distinct source type", () => {
    expect(
      hederaEventAnchorSchema.parse({
        ...anchor,
        sourceType: "native_transfer",
        sourceIndex: 0,
      }),
    ).toMatchObject({ sourceType: "native_transfer", sourceIndex: 0 });
  });

  it("accepts the complete, public Hedera source evidence", () => {
    expect(hederaEventAnchorSchema.parse(anchor)).toEqual(anchor);
  });

  it("rejects omitted identity and unrecognized private payload fields", () => {
    expect(() =>
      hederaEventAnchorSchema.parse({
        ...anchor,
        transactionHash: undefined,
      }),
    ).toThrow();
    expect(() =>
      hederaEventAnchorSchema.parse({ ...anchor, prompt: "do not publish" }),
    ).toThrow();
  });

  it("uses every source identity field in a stable bytes32 replay key", () => {
    const first = createHederaSourceEventId(anchor);
    expect(first).toMatch(/^0x[a-f0-9]{64}$/);
    expect(createHederaSourceEventId({ ...anchor })).toBe(first);

    for (const change of [
      { version: "1", network: "hedera-testnet", sourceType: "hcs_message" },
      { sourceId: "0.0.7002" },
      { transactionHash: `0x${"ef".repeat(32)}` },
      { consensusTimestamp: "1721234567.123456788" },
      { sourceIndex: 3 },
    ]) {
      expect(createHederaSourceEventId({ ...anchor, ...change })).not.toBe(
        first,
      );
    }
  });

  it("uses the source-event ID as the relayer idempotency key", () => {
    expect(createProjectionIdempotencyKey(anchor)).toBe(
      `hedera-anchor:${createHederaSourceEventId(anchor)}`,
    );
  });

  it("does not let monitoring content alter source identity", () => {
    expect(
      createHederaSourceEventId({
        ...anchor,
        eventKind: "balance.credited",
        payloadDigest: `0x${"ef".repeat(32)}`,
      }),
    ).toBe(createHederaSourceEventId(anchor));
  });
});
