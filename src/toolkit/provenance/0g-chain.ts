import type {
  ProvenanceAnchor,
  ProvenanceAnchorRequest,
  ProvenanceAnchorResult,
  ProvenanceVerificationRequest,
  ProvenanceVerificationResult,
  ProvenanceVerifier,
} from "../contracts";

export const zgProvenanceFailureCodes = [
  "INVALID_REQUEST",
  "ANCHOR_FAILED",
  "ANCHOR_TIMEOUT",
  "TRANSACTION_NOT_FINAL",
] as const;

export type ZgProvenanceFailureCode = (typeof zgProvenanceFailureCodes)[number];

export class ZgProvenanceError extends Error {
  constructor(
    readonly code: ZgProvenanceFailureCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ZgProvenanceError";
  }
}

export type ZgChainAnchorEvidence = Readonly<{
  transactionHash: string;
  blockNumber: string;
  receiptHash: string;
}>;

export interface ZgChainClient {
  anchor(receiptHash: string): Promise<ZgChainAnchorEvidence>;
  inspect(transactionHash: string): Promise<ZgChainAnchorEvidence | null>;
  isAnchored(receiptHash: string): Promise<boolean>;
}

export class ZgChainProvenanceAdapter
  implements ProvenanceAnchor, ProvenanceVerifier
{
  constructor(
    private readonly client: ZgChainClient,
    private readonly network = "0g-galileo-testnet",
  ) {}

  async anchor(
    request: ProvenanceAnchorRequest,
  ): Promise<ProvenanceAnchorResult> {
    this.validate(request.receiptHash, request.network);
    if (request.idempotencyKey.trim() === "") {
      throw new ZgProvenanceError(
        "INVALID_REQUEST",
        "Provenance anchor requires an idempotency key",
      );
    }
    if (await this.client.isAnchored(request.receiptHash)) {
      throw new ZgProvenanceError(
        "ANCHOR_FAILED",
        "Receipt hash is already anchored",
      );
    }

    try {
      const result = await this.client.anchor(request.receiptHash);
      if (
        result.receiptHash.toLowerCase() !== request.receiptHash.toLowerCase()
      ) {
        throw new ZgProvenanceError(
          "ANCHOR_FAILED",
          "Anchor transaction emitted a mismatched receipt hash",
        );
      }
      return {
        transactionHash: result.transactionHash,
        blockNumber: result.blockNumber,
      };
    } catch (error) {
      if (error instanceof ZgProvenanceError) throw error;
      throw new ZgProvenanceError(
        "ANCHOR_FAILED",
        "0G Chain provenance anchor failed",
        { cause: error },
      );
    }
  }

  async verify(
    request: ProvenanceVerificationRequest,
  ): Promise<ProvenanceVerificationResult> {
    this.validate(request.receiptHash, request.network);
    const transaction = await this.client.inspect(request.transactionHash);
    if (!transaction) {
      throw new ZgProvenanceError(
        "TRANSACTION_NOT_FINAL",
        "0G Chain transaction is not finalized",
      );
    }
    const transactionMatches =
      transaction.receiptHash.toLowerCase() ===
      request.receiptHash.toLowerCase();
    const stateMatches = await this.client.isAnchored(request.receiptHash);

    return {
      verified: transactionMatches && stateMatches,
      anchoredReceiptHash: transaction.receiptHash,
      blockNumber: transaction.blockNumber,
    };
  }

  private validate(receiptHash: string, network: string): void {
    if (!/^0x[0-9a-fA-F]{64}$/.test(receiptHash) || network !== this.network) {
      throw new ZgProvenanceError(
        "INVALID_REQUEST",
        "Invalid 0G Chain provenance request",
      );
    }
  }
}
