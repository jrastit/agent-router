import { describe, expect, it } from "vitest";

import { createHederaSourceEventId } from "./anchor";
import { createDepositProjectionAnchor } from "./deposit-worker";

const payload = {
  version: "1" as const,
  depositId: "deposit-1",
  userPseudonym: "private-pseudonym-digest",
  transactionHash: "0.0.1001@1785000000.000000001",
  amountTinybars: "500000",
  verifiedAt: "2026-07-26T01:00:00.000Z",
};

describe("deposit projection worker", () => {
  it("creates a privacy-safe native-transfer anchor", () => {
    const anchor = createDepositProjectionAnchor({
      treasuryAccount: "0.0.2002",
      consensusTimestamp: "1785000001.000000001",
      payload,
    });

    expect(anchor).toMatchObject({
      sourceType: "native_transfer",
      sourceId: "0.0.2002",
      sourceIndex: 0,
      eventKind: "deposit.credited",
    });
    expect(anchor.transactionHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(anchor.payloadDigest).toMatch(/^0x[a-f0-9]{64}$/);
    expect(JSON.stringify(anchor)).not.toContain(payload.userPseudonym);
    expect(JSON.stringify(anchor)).not.toContain(payload.transactionHash);
    expect(createHederaSourceEventId(anchor)).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it("binds amount changes into the payload digest", () => {
    const first = createDepositProjectionAnchor({
      treasuryAccount: "0.0.2002",
      consensusTimestamp: "1785000001.000000001",
      payload,
    });
    const second = createDepositProjectionAnchor({
      treasuryAccount: "0.0.2002",
      consensusTimestamp: "1785000001.000000001",
      payload: { ...payload, amountTinybars: "500001" },
    });
    expect(second.payloadDigest).not.toBe(first.payloadDigest);
  });
});
