import type { HederaEventAnchor } from "./anchor";

export type ProjectionRecord = {
  sourceEventId: `0x${string}`;
  state:
    | "verified"
    | "submitting"
    | "submitted"
    | "confirmed"
    | "retry_wait"
    | "failed_terminal";
  attemptCount: number;
  destinationTransactionHash?: string;
};

export type ProjectionReceipt =
  | { state: "pending" }
  | { state: "confirmed"; blockNumber: bigint }
  | { state: "reverted"; blockNumber: bigint }
  | { state: "unknown" };

export type ProjectionStore = {
  load(sourceEventId: string): Promise<ProjectionRecord>;
  startAttempt(input: {
    sourceEventId: string;
    idempotencyKey: string;
    maxFeePerGasWei: string;
    gasLimit: string;
  }): Promise<ProjectionRecord>;
  recordSubmitted(input: {
    sourceEventId: string;
    transactionHash: string;
    nonce: number;
  }): Promise<ProjectionRecord>;
  recordConfirmed(input: {
    sourceEventId: string;
    transactionHash?: string;
    blockNumber: string;
  }): Promise<ProjectionRecord>;
  recordRetry(input: {
    sourceEventId: string;
    code: string;
    message: string;
  }): Promise<ProjectionRecord>;
  recordTerminalFailure(input: {
    sourceEventId: string;
    code: string;
    message: string;
  }): Promise<ProjectionRecord>;
};

export type ProjectionChain = {
  isAnchored(sourceEventId: string): Promise<boolean>;
  getReceipt(transactionHash: string): Promise<ProjectionReceipt>;
  submit(input: {
    sourceEventId: string;
    anchor: HederaEventAnchor;
    maxFeePerGasWei: bigint;
    gasLimit: bigint;
  }): Promise<{ transactionHash: string; nonce: number }>;
};

export class AmbiguousProjectionSubmissionError extends Error {
  constructor(
    message: string,
    readonly transactionHash: string,
    readonly nonce: number,
  ) {
    super(message);
    this.name = "AmbiguousProjectionSubmissionError";
  }
}

export async function projectHederaEvent(input: {
  anchor: HederaEventAnchor;
  sourceEventId: `0x${string}`;
  store: ProjectionStore;
  chain: ProjectionChain;
  maxAttempts: number;
  maxFeePerGasWei: bigint;
  gasLimit: bigint;
}): Promise<ProjectionRecord> {
  if (
    !Number.isSafeInteger(input.maxAttempts) ||
    input.maxAttempts < 1 ||
    input.maxAttempts > 10 ||
    input.maxFeePerGasWei <= BigInt(0) ||
    input.gasLimit <= BigInt(0)
  ) {
    throw new Error("invalid bounded projection policy");
  }

  let record = await input.store.load(input.sourceEventId);
  if (record.state === "confirmed" || record.state === "failed_terminal") {
    return record;
  }

  if (record.destinationTransactionHash) {
    const receipt = await input.chain.getReceipt(
      record.destinationTransactionHash,
    );
    if (receipt.state === "confirmed") {
      return input.store.recordConfirmed({
        sourceEventId: input.sourceEventId,
        transactionHash: record.destinationTransactionHash,
        blockNumber: receipt.blockNumber.toString(),
      });
    }
    if (receipt.state === "pending" || receipt.state === "unknown") {
      return record;
    }
    record = await input.store.recordRetry({
      sourceEventId: input.sourceEventId,
      code: "DESTINATION_REVERTED",
      message: `transaction reverted in block ${receipt.blockNumber}`,
    });
  }

  if (await input.chain.isAnchored(input.sourceEventId)) {
    return input.store.recordConfirmed({
      sourceEventId: input.sourceEventId,
      blockNumber: "0",
    });
  }
  if (record.attemptCount >= input.maxAttempts) {
    return input.store.recordTerminalFailure({
      sourceEventId: input.sourceEventId,
      code: "PROJECTION_ATTEMPTS_EXHAUSTED",
      message: "bounded projection attempts exhausted",
    });
  }

  await input.store.startAttempt({
    sourceEventId: input.sourceEventId,
    idempotencyKey: `hedera-anchor:${input.sourceEventId}`,
    maxFeePerGasWei: input.maxFeePerGasWei.toString(),
    gasLimit: input.gasLimit.toString(),
  });
  try {
    const submitted = await input.chain.submit({
      sourceEventId: input.sourceEventId,
      anchor: input.anchor,
      maxFeePerGasWei: input.maxFeePerGasWei,
      gasLimit: input.gasLimit,
    });
    return input.store.recordSubmitted({
      sourceEventId: input.sourceEventId,
      ...submitted,
    });
  } catch (error) {
    if (error instanceof AmbiguousProjectionSubmissionError) {
      return input.store.recordSubmitted({
        sourceEventId: input.sourceEventId,
        transactionHash: error.transactionHash,
        nonce: error.nonce,
      });
    }
    return input.store.recordRetry({
      sourceEventId: input.sourceEventId,
      code: "DESTINATION_SUBMISSION_FAILED",
      message:
        error instanceof Error ? error.message : "unknown submission error",
    });
  }
}
