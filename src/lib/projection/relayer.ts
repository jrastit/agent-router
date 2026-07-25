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
  destinationNonce?: number;
  destinationBlockNumber?: string;
  destinationBlockHash?: string;
};

export type ProjectionReceipt =
  | { state: "pending" }
  | {
      state: "confirmed";
      blockNumber: bigint;
      blockHash: string;
      confirmations: number;
    }
  | { state: "reverted"; blockNumber: bigint; blockHash: string }
  | {
      state: "reorged";
      previousBlockNumber: bigint;
      previousBlockHash: string;
    }
  | { state: "unknown" };

export type ProjectionStore = {
  load(sourceEventId: string): Promise<ProjectionRecord>;
  startAttempt(input: {
    sourceEventId: string;
    idempotencyKey: string;
    destinationChainId: string;
    nonce: number;
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
    blockHash?: string;
  }): Promise<ProjectionRecord>;
  recordRetry(input: {
    sourceEventId: string;
    code: string;
    message: string;
    clearDestinationTransaction?: boolean;
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
  findTransactionByNonce(nonce: number): Promise<{
    transactionHash: string;
    receipt: ProjectionReceipt;
  } | null>;
  getNextNonce(): Promise<number>;
  submit(input: {
    sourceEventId: string;
    anchor: HederaEventAnchor;
    nonce: number;
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
  destinationChainId: bigint;
  maxAttempts: number;
  maxFeePerGasWei: bigint;
  gasLimit: bigint;
  minimumConfirmations?: number;
}): Promise<ProjectionRecord> {
  const minimumConfirmations = input.minimumConfirmations ?? 1;
  if (
    !Number.isSafeInteger(input.maxAttempts) ||
    input.maxAttempts < 1 ||
    input.maxAttempts > 10 ||
    input.destinationChainId <= BigInt(0) ||
    input.maxFeePerGasWei <= BigInt(0) ||
    input.gasLimit <= BigInt(0) ||
    !Number.isSafeInteger(minimumConfirmations) ||
    minimumConfirmations < 1
  ) {
    throw new Error("invalid bounded projection policy");
  }

  let record = await input.store.load(input.sourceEventId);
  if (record.state === "failed_terminal") {
    return record;
  }

  if (record.destinationTransactionHash) {
    const receipt = await input.chain.getReceipt(
      record.destinationTransactionHash,
    );
    if (receipt.state === "confirmed") {
      if (receipt.confirmations < minimumConfirmations) return record;
      return input.store.recordConfirmed({
        sourceEventId: input.sourceEventId,
        transactionHash: record.destinationTransactionHash,
        blockNumber: receipt.blockNumber.toString(),
        blockHash: receipt.blockHash,
      });
    }
    if (receipt.state === "pending" || receipt.state === "unknown") {
      return record;
    }
    const reorged = receipt.state === "reorged";
    record = await input.store.recordRetry({
      sourceEventId: input.sourceEventId,
      code: reorged ? "DESTINATION_REORGED" : "DESTINATION_REVERTED",
      message: reorged
        ? `transaction left canonical block ${receipt.previousBlockNumber}`
        : `transaction reverted in block ${receipt.blockNumber}`,
      clearDestinationTransaction: true,
    });
  }

  let nonce: number | undefined;
  if (
    record.state === "submitting" &&
    record.destinationTransactionHash === undefined &&
    record.destinationNonce !== undefined
  ) {
    nonce = record.destinationNonce;
    const recovered = await input.chain.findTransactionByNonce(nonce);
    if (recovered) {
      record = await input.store.recordSubmitted({
        sourceEventId: input.sourceEventId,
        transactionHash: recovered.transactionHash,
        nonce,
      });
      if (
        recovered.receipt.state === "confirmed" &&
        recovered.receipt.confirmations >= minimumConfirmations
      ) {
        return input.store.recordConfirmed({
          sourceEventId: input.sourceEventId,
          transactionHash: recovered.transactionHash,
          blockNumber: recovered.receipt.blockNumber.toString(),
          blockHash: recovered.receipt.blockHash,
        });
      }
      if (
        recovered.receipt.state === "pending" ||
        recovered.receipt.state === "unknown" ||
        (recovered.receipt.state === "confirmed" &&
          recovered.receipt.confirmations < minimumConfirmations)
      ) {
        return record;
      }
      record = await input.store.recordRetry({
        sourceEventId: input.sourceEventId,
        code:
          recovered.receipt.state === "reorged"
            ? "DESTINATION_REORGED"
            : "DESTINATION_REVERTED",
        message: "recovered transaction is not canonical",
        clearDestinationTransaction: true,
      });
      nonce = undefined;
    }
  }

  if (await input.chain.isAnchored(input.sourceEventId)) {
    return input.store.recordConfirmed({
      sourceEventId: input.sourceEventId,
      blockNumber: "0",
    });
  }
  if (nonce === undefined) {
    if (record.attemptCount >= input.maxAttempts) {
      return input.store.recordTerminalFailure({
        sourceEventId: input.sourceEventId,
        code: "PROJECTION_ATTEMPTS_EXHAUSTED",
        message: "bounded projection attempts exhausted",
      });
    }
    nonce = await input.chain.getNextNonce();
    if (!Number.isSafeInteger(nonce) || nonce < 0) {
      throw new Error("destination returned an invalid nonce");
    }
    record = await input.store.startAttempt({
      sourceEventId: input.sourceEventId,
      idempotencyKey: `hedera-anchor:${input.sourceEventId}`,
      destinationChainId: input.destinationChainId.toString(),
      nonce,
      maxFeePerGasWei: input.maxFeePerGasWei.toString(),
      gasLimit: input.gasLimit.toString(),
    });
    if (record.destinationNonce !== nonce) {
      return input.store.recordTerminalFailure({
        sourceEventId: input.sourceEventId,
        code: "DESTINATION_NONCE_RESERVATION_MISMATCH",
        message: "durable nonce reservation did not match the requested nonce",
      });
    }
  }

  try {
    const submitted = await input.chain.submit({
      sourceEventId: input.sourceEventId,
      anchor: input.anchor,
      nonce,
      maxFeePerGasWei: input.maxFeePerGasWei,
      gasLimit: input.gasLimit,
    });
    if (submitted.nonce !== nonce) {
      return input.store.recordTerminalFailure({
        sourceEventId: input.sourceEventId,
        code: "DESTINATION_NONCE_MISMATCH",
        message: "destination submission used an unexpected nonce",
      });
    }
    return input.store.recordSubmitted({
      sourceEventId: input.sourceEventId,
      ...submitted,
    });
  } catch (error) {
    if (error instanceof AmbiguousProjectionSubmissionError) {
      if (error.nonce !== nonce) {
        return input.store.recordTerminalFailure({
          sourceEventId: input.sourceEventId,
          code: "DESTINATION_NONCE_MISMATCH",
          message: "ambiguous submission reported an unexpected nonce",
        });
      }
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
