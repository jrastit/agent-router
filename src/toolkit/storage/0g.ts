import type {
  StorageEvidenceAdapter,
  StorageEvidenceReference,
  StorageEvidenceRequest,
} from "../contracts";

export const zgStorageFailureCodes = [
  "INVALID_REQUEST",
  "UPLOAD_FAILED",
  "UPLOAD_TIMEOUT",
] as const;

export type ZgStorageFailureCode = (typeof zgStorageFailureCodes)[number];

export class ZgStorageError extends Error {
  constructor(
    readonly code: ZgStorageFailureCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ZgStorageError";
  }
}

export type ZgStorageUploadResult = Readonly<{
  rootHash: string;
  transactionHash: string;
}>;

export interface ZgStorageUploader {
  upload(
    content: Uint8Array,
    mediaType: string,
  ): Promise<ZgStorageUploadResult>;
}

export type ZgStorageEvidenceAdapterOptions = Readonly<{
  network?: string;
  timeoutMs?: number;
  maximumBytes?: number;
}>;

const hex32 = /^0x[0-9a-fA-F]{64}$/;

export class ZgStorageEvidenceAdapter implements StorageEvidenceAdapter {
  private readonly network: string;
  private readonly timeoutMs: number;
  private readonly maximumBytes: number;
  private readonly requests = new Map<
    string,
    Promise<StorageEvidenceReference>
  >();

  constructor(
    private readonly uploader: ZgStorageUploader,
    options: ZgStorageEvidenceAdapterOptions = {},
  ) {
    this.network = options.network ?? "0g-galileo-testnet";
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.maximumBytes = options.maximumBytes ?? 1_048_576;
  }

  persist(request: StorageEvidenceRequest): Promise<StorageEvidenceReference> {
    this.validate(request);

    const existing = this.requests.get(request.idempotencyKey);
    if (existing) return existing;

    const operation = this.upload(request).catch((error: unknown) => {
      this.requests.delete(request.idempotencyKey);
      throw error;
    });
    this.requests.set(request.idempotencyKey, operation);
    return operation;
  }

  private validate(request: StorageEvidenceRequest): void {
    if (
      request.classification !== "public-non-secret" ||
      request.content.byteLength === 0 ||
      request.content.byteLength > this.maximumBytes ||
      request.idempotencyKey.trim() === "" ||
      request.mediaType.trim() === ""
    ) {
      throw new ZgStorageError(
        "INVALID_REQUEST",
        "0G Storage accepts only bounded, explicitly public non-secret evidence",
      );
    }
  }

  private async upload(
    request: StorageEvidenceRequest,
  ): Promise<StorageEvidenceReference> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutResult = new Promise<never>((_, reject) => {
      timeout = setTimeout(
        () =>
          reject(
            new ZgStorageError(
              "UPLOAD_TIMEOUT",
              `0G Storage upload exceeded ${this.timeoutMs}ms`,
            ),
          ),
        this.timeoutMs,
      );
    });

    try {
      const result = await Promise.race([
        this.uploader.upload(request.content, request.mediaType),
        timeoutResult,
      ]);
      if (!hex32.test(result.rootHash) || !hex32.test(result.transactionHash)) {
        throw new ZgStorageError(
          "UPLOAD_FAILED",
          "0G Storage returned invalid content-addressed evidence",
        );
      }
      return {
        network: this.network,
        rootHash: result.rootHash.toLowerCase(),
        transactionHash: result.transactionHash.toLowerCase(),
      };
    } catch (error) {
      if (error instanceof ZgStorageError) throw error;
      throw new ZgStorageError("UPLOAD_FAILED", "0G Storage upload failed", {
        cause: error,
      });
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}
