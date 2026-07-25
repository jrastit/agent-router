import { describe, expect, it } from "vitest";

import { evaluateProjectionAuthority } from "./status";

const hash = `0x${"ab".repeat(32)}`;
const credited = {
  creditState: "credited",
  hedera: {
    state: "mirror_verified",
    transactionHash: "0.0.1000@1.000000001",
    evidenceUrl: "https://hashscan.io/testnet/transaction/0.0.1000@1.000000001",
  },
  evm: {
    state: "confirmed",
    chainId: "1337",
    transactionHash: hash,
    evidenceUrl: null,
  },
  graph: {
    state: "indexed",
    entityId: hash,
    evidenceUrl: "http://127.0.0.1:8000/subgraphs/name/agent-router/test",
  },
  trust: "allowlisted-relayer-monitoring-only",
} as const;

describe("projection monitoring authority", () => {
  it("keeps credited funds spendable when projection monitoring fails", () => {
    const result = evaluateProjectionAuthority({
      ...credited,
      evm: {
        ...credited.evm,
        state: "failed_terminal",
        transactionHash: null,
      },
      graph: {
        ...credited.graph,
        state: "not_ready",
        entityId: null,
        evidenceUrl: null,
      },
    });

    expect(result).toMatchObject({
      spendable: true,
      authority: "hedera-mirror-and-postgres",
      projectionCanAffectCredit: false,
    });
  });

  it("does not create spendable credit from complete monitoring evidence", () => {
    const result = evaluateProjectionAuthority({
      ...credited,
      creditState: "unverified",
    });

    expect(result.spendable).toBe(false);
    expect(result.projectionCanAffectCredit).toBe(false);
  });

  it("rejects monitoring that advances before Mirror verification", () => {
    expect(() =>
      evaluateProjectionAuthority({
        ...credited,
        creditState: "unverified",
        hedera: {
          state: "awaiting_mirror",
          transactionHash: null,
          evidenceUrl: null,
        },
      }),
    ).toThrow("monitoring cannot advance before Hedera Mirror verification");
  });

  it("rejects indexed entities without confirmed destination provenance", () => {
    expect(() =>
      evaluateProjectionAuthority({
        ...credited,
        evm: {
          ...credited.evm,
          state: "submitted",
        },
      }),
    ).toThrow("Graph evidence requires a confirmed destination transaction");
  });
});
