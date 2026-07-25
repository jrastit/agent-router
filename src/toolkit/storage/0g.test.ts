import { describe, expect, it, vi } from "vitest";

import {
  ZgStorageError,
  ZgStorageEvidenceAdapter,
  type ZgStorageUploader,
} from "./0g";

const rootHash = `0x${"12".repeat(32)}`;
const transactionHash = `0x${"ab".repeat(32)}`;

function request() {
  return {
    content: new TextEncoder().encode('{"executionId":"safe-id"}'),
    mediaType: "application/json",
    idempotencyKey: "job-1:evidence",
    classification: "public-non-secret" as const,
  };
}

describe("ZgStorageEvidenceAdapter", () => {
  it("returns normalized content-addressed evidence", async () => {
    const uploader: ZgStorageUploader = {
      upload: vi.fn().mockResolvedValue({ rootHash, transactionHash }),
    };
    const adapter = new ZgStorageEvidenceAdapter(uploader);

    await expect(adapter.persist(request())).resolves.toEqual({
      network: "0g-galileo-testnet",
      rootHash,
      transactionHash,
    });
  });

  it("deduplicates concurrent and completed idempotent requests", async () => {
    const upload = vi.fn().mockResolvedValue({ rootHash, transactionHash });
    const adapter = new ZgStorageEvidenceAdapter({ upload });

    await Promise.all([
      adapter.persist(request()),
      adapter.persist(request()),
      adapter.persist(request()),
    ]);
    await adapter.persist(request());

    expect(upload).toHaveBeenCalledOnce();
  });

  it("fails closed unless evidence is explicitly public and non-secret", () => {
    const adapter = new ZgStorageEvidenceAdapter({
      upload: vi.fn(),
    });

    expect(() =>
      adapter.persist({ ...request(), classification: "secret" as never }),
    ).toThrowError(
      new ZgStorageError(
        "INVALID_REQUEST",
        "0G Storage accepts only bounded, explicitly public non-secret evidence",
      ),
    );
  });

  it("returns a stable timeout code without leaking content", async () => {
    vi.useFakeTimers();
    const adapter = new ZgStorageEvidenceAdapter(
      { upload: () => new Promise(() => undefined) },
      { timeoutMs: 10 },
    );
    const result = adapter.persist(request());
    const assertion = expect(result).rejects.toMatchObject({
      code: "UPLOAD_TIMEOUT",
      message: "0G Storage upload exceeded 10ms",
    });
    await vi.advanceTimersByTimeAsync(10);

    await assertion;
    vi.useRealTimers();
  });

  it("rejects malformed SDK evidence", async () => {
    const adapter = new ZgStorageEvidenceAdapter({
      upload: vi.fn().mockResolvedValue({
        rootHash: "not-a-root",
        transactionHash,
      }),
    });

    await expect(adapter.persist(request())).rejects.toMatchObject({
      code: "UPLOAD_FAILED",
    });
  });
});
