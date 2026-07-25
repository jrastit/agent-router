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
        destinationNonce: 4,
      });
    },
    async recordSubmitted(value) {
      return set({
        state: "submitted",
        destinationTransactionHash: value.transactionHash,
        destinationNonce: value.nonce,
      });
    },
    async recordConfirmed(value) {
      return set({
        state: "confirmed",
        destinationTransactionHash:
          value.transactionHash ?? current.destinationTransactionHash,
        destinationBlockNumber: value.blockNumber,
        destinationBlockHash: value.blockHash,
      });
    },
    async recordRetry(value) {
      return set({
        state: "retry_wait",
        destinationTransactionHash: value.clearDestinationTransaction
          ? undefined
          : current.destinationTransactionHash,
        destinationNonce: value.clearDestinationTransaction
          ? undefined
          : current.destinationNonce,
      });
    },
    async recordTerminalFailure() {
      return set({ state: "failed_terminal" });
    },
  };
}

const policy = {
  anchor,
  sourceEventId,
  destinationChainId: BigInt(1337),
  maxAttempts: 3,
  maxFeePerGasWei: BigInt(100),
  gasLimit: BigInt(200_000),
};

function chain(
  overrides: Partial<Parameters<typeof projectHederaEvent>[0]["chain"]> = {},
): Parameters<typeof projectHederaEvent>[0]["chain"] {
  return {
    isAnchored: async () => false,
    getReceipt: vi.fn(),
    findTransactionByNonce: async () => null,
    getNextNonce: async () => 4,
    submit: vi.fn(),
    ...overrides,
  };
}

describe("projectHederaEvent", () => {
  it("submits once with bounded fees and persists the transaction identity", async () => {
    const submit = vi.fn().mockResolvedValue({
      transactionHash: `0x${"11".repeat(32)}`,
      nonce: 4,
    });
    const result = await projectHederaEvent({
      ...policy,
      store: store({ sourceEventId, state: "verified", attemptCount: 0 }),
      chain: chain({ submit }),
    });
    expect(result.state).toBe("submitted");
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        maxFeePerGasWei: BigInt(100),
        gasLimit: BigInt(200_000),
        nonce: 4,
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
      chain: chain({
        getReceipt: async () => ({ state: "unknown" }),
        submit,
      }),
    });
    expect(pending.state).toBe("submitted");
    expect(submit).not.toHaveBeenCalled();

    const ambiguousSubmit = vi
      .fn()
      .mockRejectedValue(
        new AmbiguousProjectionSubmissionError(
          "RPC disconnected",
          `0x${"33".repeat(32)}`,
          4,
        ),
      );
    const ambiguous = await projectHederaEvent({
      ...policy,
      store: store({ sourceEventId, state: "verified", attemptCount: 0 }),
      chain: chain({ submit: ambiguousSubmit }),
    });
    expect(ambiguous.destinationTransactionHash).toBe(`0x${"33".repeat(32)}`);
  });

  it("recovers a broadcast transaction after a relayer crash", async () => {
    const submit = vi.fn();
    const transactionHash = `0x${"44".repeat(32)}`;
    const result = await projectHederaEvent({
      ...policy,
      minimumConfirmations: 2,
      store: store({
        sourceEventId,
        state: "submitting",
        attemptCount: 1,
        destinationNonce: 4,
      }),
      chain: chain({
        findTransactionByNonce: async () => ({
          transactionHash,
          receipt: {
            state: "confirmed",
            blockNumber: BigInt(8),
            blockHash: `0x${"55".repeat(32)}`,
            confirmations: 2,
          },
        }),
        submit,
      }),
    });

    expect(result).toMatchObject({
      state: "confirmed",
      destinationTransactionHash: transactionHash,
      destinationBlockNumber: "8",
    });
    expect(submit).not.toHaveBeenCalled();
  });

  it("finishes a reserved final attempt after crashing before broadcast", async () => {
    const submit = vi.fn().mockResolvedValue({
      transactionHash: `0x${"45".repeat(32)}`,
      nonce: 4,
    });
    const result = await projectHederaEvent({
      ...policy,
      store: store({
        sourceEventId,
        state: "submitting",
        attemptCount: 3,
        destinationNonce: 4,
      }),
      chain: chain({ submit }),
    });

    expect(result.state).toBe("submitted");
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ nonce: 4 }));
  });

  it("retries the logical anchor after an explicit EVM reorg", async () => {
    const submit = vi.fn().mockResolvedValue({
      transactionHash: `0x${"66".repeat(32)}`,
      nonce: 4,
    });
    const result = await projectHederaEvent({
      ...policy,
      store: store({
        sourceEventId,
        state: "confirmed",
        attemptCount: 1,
        destinationTransactionHash: `0x${"44".repeat(32)}`,
        destinationNonce: 3,
        destinationBlockNumber: "8",
        destinationBlockHash: `0x${"55".repeat(32)}`,
      }),
      chain: chain({
        getReceipt: async () => ({
          state: "reorged",
          previousBlockNumber: BigInt(8),
          previousBlockHash: `0x${"55".repeat(32)}`,
        }),
        submit,
      }),
    });

    expect(result).toMatchObject({
      state: "submitted",
      destinationTransactionHash: `0x${"66".repeat(32)}`,
      destinationNonce: 4,
    });
    expect(submit).toHaveBeenCalledOnce();
  });

  it("fails closed when a nonce reservation races", async () => {
    const submit = vi.fn();
    const persistence = store({
      sourceEventId,
      state: "verified",
      attemptCount: 0,
    });
    persistence.startAttempt = vi.fn(async (): Promise<ProjectionRecord> => ({
      sourceEventId,
      state: "submitting",
      attemptCount: 1,
      destinationNonce: 5,
    }));

    const result = await projectHederaEvent({
      ...policy,
      store: persistence,
      chain: chain({ submit }),
    });

    expect(result.state).toBe("failed_terminal");
    expect(submit).not.toHaveBeenCalled();
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
      chain: chain({ submit }),
    });
    expect(result.state).toBe("failed_terminal");
    expect(submit).not.toHaveBeenCalled();
  });
});
