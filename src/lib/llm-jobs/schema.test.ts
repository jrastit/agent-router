import { describe, expect, it } from "vitest";

import {
  canTransitionLlmJob,
  llmJobChargeSchema,
  llmJobFailureCodeSchema,
  llmJobSchema,
  llmJobUsageSchema,
  llmPriceSnapshotSchema,
  llmProviderEvidenceSchema,
} from "./schema";

const now = "2026-07-26T02:00:00.000Z";

describe("durable LLM job contracts", () => {
  it("accepts a balance-backed job without provider credentials", () => {
    const job = llmJobSchema.parse({
      id: "job:1",
      userId: "7d444840-9dc0-11d1-b245-5ffdce74fad2",
      instanceId: "42",
      provider: "0g",
      model: "llama-3.3-70b",
      capability: "chat",
      privacy: "confidential",
      state: "accepted",
      maximumInputTokens: 512,
      maximumOutputTokens: 128,
      spendCeilingTinybars: "10000",
      idempotencyKey: "request:1",
      failureCode: null,
      createdAt: now,
      updatedAt: now,
    });

    expect(job.provider).toBe("0g");
    expect(job).not.toHaveProperty("apiKey");
    expect(job).not.toHaveProperty("prompt");
  });

  it("requires exact integer money and internally consistent usage", () => {
    expect(() =>
      llmPriceSnapshotSchema.parse({
        currency: "tinybar",
        inputTinybarsPerMillionTokens: "0.5",
        outputTinybarsPerMillionTokens: "4",
        catalogSyncedAt: now,
      }),
    ).toThrow();
    expect(() =>
      llmJobUsageSchema.parse({
        jobId: "job:1",
        attemptId: "attempt:1",
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 31,
        reportedByProvider: true,
      }),
    ).toThrow(/Total tokens/);
  });

  it("keeps execution evidence redacted and labels trust precisely", () => {
    const evidence = llmProviderEvidenceSchema.parse({
      jobId: "job:1",
      attemptId: "attempt:1",
      provider: "0g",
      model: "llama",
      executionId: "execution:1",
      verificationLabel:
        "0G Router private trust-mode response; not independently attested",
      providerAddress: "0x1111111111111111111111111111111111111111",
      trustMode: "private",
    });

    expect(evidence).not.toHaveProperty("prompt");
    expect(evidence).not.toHaveProperty("output");
    expect(evidence.verificationLabel).toMatch(/not independently attested/);
  });

  it("defines stable failure codes and fail-closed state transitions", () => {
    expect(llmJobFailureCodeSchema.parse("COMPLETION_AMBIGUOUS")).toBe(
      "COMPLETION_AMBIGUOUS",
    );
    expect(canTransitionLlmJob("accepted", "reserved")).toBe(true);
    expect(canTransitionLlmJob("executing", "reconciliation_required")).toBe(
      true,
    );
    expect(canTransitionLlmJob("delivered", "executing")).toBe(false);
  });

  it("binds a charge to one reservation using integer tinybars", () => {
    expect(
      llmJobChargeSchema.parse({
        id: "charge:1",
        jobId: "job:1",
        reservationId: "reservation:1",
        amountTinybars: "37",
        idempotencyKey: "charge:job:1",
        chargedAt: now,
      }).amountTinybars,
    ).toBe("37");
  });
});
