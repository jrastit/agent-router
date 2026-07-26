import { describe, expect, it, vi } from "vitest";

import { executeDurableLlmJob, type ExecutableLlmJob } from "./execution";
import { LlmProviderError } from "./providers";

const baseJob: ExecutableLlmJob = {
  id: "job:1",
  state: "accepted",
  provider: "scaleway",
  model: "model-1",
  prompt: "private prompt",
  maximumInputTokens: 100,
  maximumOutputTokens: 50,
};
const result = {
  output: "private output",
  usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
  evidence: {
    provider: "scaleway" as const,
    model: "model-1",
    executionId: "execution-1",
    verificationLabel: "provider-reported Scaleway chat completion",
    providerAddress: null,
    trustMode: "standard" as const,
  },
};

function dependencies(
  states: ExecutableLlmJob[],
  execute = vi.fn().mockResolvedValue(result),
) {
  return {
    load: vi.fn().mockImplementation(async () => states.shift() ?? baseJob),
    reserve: vi.fn(),
    startAttempt: vi.fn(),
    scaleway: { execute },
    zg: { execute: vi.fn() },
    settle: vi.fn(),
    reconcile: vi.fn(),
    failAndRelease: vi.fn(),
  };
}

describe("durable LLM job execution", () => {
  it("reserves, starts once, executes, and settles", async () => {
    const deps = dependencies([
      baseJob,
      { ...baseJob, state: "reserved" },
      { ...baseJob, state: "executing", attemptId: "attempt:1" },
    ]);

    await expect(executeDurableLlmJob(deps, "job:1")).resolves.toEqual({
      state: "delivered",
      jobId: "job:1",
    });
    expect(deps.reserve).toHaveBeenCalledOnce();
    expect(deps.startAttempt).toHaveBeenCalledOnce();
    expect(deps.scaleway.execute).toHaveBeenCalledOnce();
    expect(deps.settle).toHaveBeenCalledWith(
      expect.objectContaining({ attemptId: "attempt:1" }),
      result,
    );
  });

  it.each(["executing", "validating"] as const)(
    "does not repeat an already %s inference",
    async (state) => {
      const deps = dependencies([{ ...baseJob, state }]);
      await expect(executeDurableLlmJob(deps, "job:1")).resolves.toEqual({
        state: "executing",
        jobId: "job:1",
      });
      expect(deps.scaleway.execute).not.toHaveBeenCalled();
      expect(deps.zg.execute).not.toHaveBeenCalled();
    },
  );

  it("returns a delivered retry without charging or executing again", async () => {
    const deps = dependencies([{ ...baseJob, state: "delivered" }]);
    await expect(executeDurableLlmJob(deps, "job:1")).resolves.toEqual({
      state: "delivered",
      jobId: "job:1",
    });
    expect(deps.reserve).not.toHaveBeenCalled();
    expect(deps.settle).not.toHaveBeenCalled();
  });

  it("releases credit on provider authentication failure", async () => {
    const execute = vi
      .fn()
      .mockRejectedValue(
        new LlmProviderError("PROVIDER_AUTHENTICATION", "unauthorized"),
      );
    const deps = dependencies(
      [
        { ...baseJob, state: "reserved" },
        { ...baseJob, state: "executing", attemptId: "attempt:1" },
      ],
      execute,
    );
    await expect(executeDurableLlmJob(deps, "job:1")).resolves.toMatchObject({
      state: "failed",
    });
    expect(deps.failAndRelease).toHaveBeenCalledWith(
      expect.anything(),
      "PROVIDER_AUTHENTICATION",
    );
    expect(deps.reconcile).not.toHaveBeenCalled();
  });

  it("reconciles ambiguous provider completion or settlement", async () => {
    const providerDeps = dependencies(
      [
        { ...baseJob, state: "reserved" },
        { ...baseJob, state: "executing", attemptId: "attempt:1" },
      ],
      vi.fn().mockRejectedValue(new Error("connection lost")),
    );
    await executeDurableLlmJob(providerDeps, "job:1");
    expect(providerDeps.reconcile).toHaveBeenCalledWith(
      expect.anything(),
      "COMPLETION_AMBIGUOUS",
    );

    const settlementDeps = dependencies([
      { ...baseJob, state: "reserved" },
      { ...baseJob, state: "executing", attemptId: "attempt:1" },
    ]);
    settlementDeps.settle.mockRejectedValue(new Error("database unavailable"));
    await executeDurableLlmJob(settlementDeps, "job:1");
    expect(settlementDeps.reconcile).toHaveBeenCalledWith(
      expect.anything(),
      "SETTLEMENT_AMBIGUOUS",
    );
  });

  it("selects the 0G adapter and passes the pinned provider", async () => {
    const job = {
      ...baseJob,
      provider: "0g" as const,
      state: "reserved" as const,
      providerAddress: `0x${"11".repeat(20)}`,
    };
    const deps = dependencies([
      job,
      { ...job, state: "executing", attemptId: "attempt:1" },
    ]);
    deps.zg.execute.mockResolvedValue({
      ...result,
      evidence: { ...result.evidence, provider: "0g" },
    });
    await executeDurableLlmJob(deps, "job:1");
    expect(deps.zg.execute).toHaveBeenCalledWith(
      expect.objectContaining({ providerAddress: job.providerAddress }),
    );
    expect(deps.scaleway.execute).not.toHaveBeenCalled();
  });
});
