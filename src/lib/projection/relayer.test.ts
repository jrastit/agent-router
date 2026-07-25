import { describe, expect, it, vi } from "vitest";

import type { HederaEventAnchor } from "./anchor";
import {
  AmbiguousProjectionSubmissionError,
  projectHederaEvent,
  type ProjectionRecord,
  type ProjectionStore,
} from "./relayer";

const sourceEventId = `0x${"ab".repeat(32)}` as const;
const anchor = {
  version: "1",
  network: "hedera-testnet",
  sourceType: "contract_log",
  sourceId: "0.0.7001",
  transactionHash: `0x${"cd".repeat(32)}`,
  consensusTimestamp: "1721234567.123456789",
  sourceIndex: 1,
  eventKind: "deposit.observed",
  payloadDigest: `0x${"ef".repeat(32)}`,
} satisfies HederaEventAnchor;

function store(initial: ProjectionRecord): ProjectionStore {
  let current = initial;
  const set = (change: Partial<ProjectionRecord>) =>
    (current = { ...current, ...change });
  return {
    async load() {
      return current;
    },
    async startAttempt() {
      return set({
        state: "submitting",
        attemptCount: current.attemptCount + 1,
      });
    },
    async recordSubmitted(value) {
      return set({
        state: "submitted",
        destinationTransactionHash: value.transactionHash,
      });
    },
    async recordConfirmed() {
      return set({ state: "confirmed" });
    },
    async recordRetry() {
      return set({ state: "retry_wait" });
    },
    async recordTerminalFailure() {
      return set({ state: "failed_terminal" });
    },
  };
}

const policy = {
  anchor,
  sourceEventId,
  maxAttempts: 3,
  maxFeePerGasWei: BigInt(100),
  gasLimit: BigInt(200_000),
};

describe("projectHederaEvent", () => {
  it("submits once with bounded fees and persists the transaction identity", async () => {
    const submit = vi.fn().mockResolvedValue({
      transactionHash: `0x${"11".repeat(32)}`,
      nonce: 4,
    });
    const result = await projectHederaEvent({
      ...policy,
      store: store({ sourceEventId, state: "verified", attemptCount: 0 }),
      chain: {
        isAnchored: async () => false,
        getReceipt: vi.fn(),
        submit,
      },
    });
    expect(result.state).toBe("submitted");
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        maxFeePerGasWei: BigInt(100),
        gasLimit: BigInt(200_000),
      }),
    );
  });

  it("reconciles pending and ambiguous transactions without resubmitting", async () => {
    const submit = vi.fn();
    const pending = await projectHederaEvent({
      ...policy,
      store: store({
        sourceEventId,
        state: "submitted",
        attemptCount: 1,
        destinationTransactionHash: `0x${"22".repeat(32)}`,
      }),
      chain: {
        isAnchored: vi.fn(),
        getReceipt: async () => ({ state: "unknown" }),
        submit,
      },
    });
    expect(pending.state).toBe("submitted");
    expect(submit).not.toHaveBeenCalled();

    const ambiguousSubmit = vi
      .fn()
      .mockRejectedValue(
        new AmbiguousProjectionSubmissionError(
          "RPC disconnected",
          `0x${"33".repeat(32)}`,
          5,
        ),
      );
    const ambiguous = await projectHederaEvent({
      ...policy,
      store: store({ sourceEventId, state: "verified", attemptCount: 0 }),
      chain: {
        isAnchored: async () => false,
        getReceipt: vi.fn(),
        submit: ambiguousSubmit,
      },
    });
    expect(ambiguous.destinationTransactionHash).toBe(`0x${"33".repeat(32)}`);
  });

  it("fails closed after the bounded attempt count", async () => {
    const submit = vi.fn();
    const result = await projectHederaEvent({
      ...policy,
      store: store({
        sourceEventId,
        state: "retry_wait",
        attemptCount: 3,
      }),
      chain: {
        isAnchored: async () => false,
        getReceipt: vi.fn(),
        submit,
      },
    });
    expect(result.state).toBe("failed_terminal");
    expect(submit).not.toHaveBeenCalled();
  });
});
