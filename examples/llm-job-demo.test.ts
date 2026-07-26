import { describe, expect, it, vi } from "vitest";

import {
  createFixtureAdapter,
  createLiveAdapter,
  runLlmJobDemo,
} from "./llm-job-demo";

const request = {
  provider: "scaleway" as const,
  prompt: "private prompt",
  maximumInputTokens: 256,
  maximumOutputTokens: 128,
  spendCeilingMicrousd: "1000000",
  idempotencyKey: "demo-test",
};

describe("local LLM job demonstration", () => {
  it.each(["scaleway", "0g"] as const)(
    "runs a deterministic, redacted %s fixture",
    async (provider) => {
      const result = await runLlmJobDemo(createFixtureAdapter(provider), {
        ...request,
        provider,
      });

      expect(result.lifecycleStates).toEqual([
        "accepted",
        "reserved",
        "executing",
        "validated",
        "charged",
        "delivered",
      ]);
      expect(result.tokenUsage).toEqual({
        prompt: 12,
        completion: 18,
        total: 30,
      });
      expect(BigInt(result.amountsMicrousd.refunded)).toBeGreaterThan(
        BigInt(0),
      );
      expect(JSON.stringify(result)).not.toContain(request.prompt);
      expect(JSON.stringify(result)).not.toContain("Private fixture output");
    },
  );

  it("requires explicit live confirmation before making a request", () => {
    expect(() =>
      createLiveAdapter("scaleway", {
        SCALEWAY_GENAI_API_KEY: "secret",
      }),
    ).toThrow(/CONFIRM_LIVE_LLM_DEMO/);
  });

  it("requires the provider-specific live credential", () => {
    expect(() =>
      createLiveAdapter("0g", { CONFIRM_LIVE_LLM_DEMO: "yes" }),
    ).toThrow(/G_API_KEY_PRIVATE/);
  });

  it("validates live usage and returns only redacted evidence", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "live-1",
          model: "qwen",
          choices: [{ message: { content: "private live output" } }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30,
          },
        }),
      ),
    );
    const adapter = createLiveAdapter(
      "scaleway",
      {
        SCALEWAY_GENAI_API_KEY: "server-secret",
        CONFIRM_LIVE_LLM_DEMO: "yes",
      },
      fetchImpl,
    );
    const result = await runLlmJobDemo(adapter, request);

    expect(result.executionId).toBe("live-1");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.scaleway.ai/v1/chat/completions",
      expect.any(Object),
    );
    expect(JSON.stringify(result)).not.toMatch(
      /private prompt|private live output|server-secret/,
    );
  });

  it("accepts Scaleway's API_BASE deployment endpoint name", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "deployment-live-1",
          model: "qwen",
          choices: [{ message: { content: "private live output" } }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30,
          },
        }),
      ),
    );
    const adapter = createLiveAdapter(
      "scaleway",
      {
        SCALEWAY_GENAI_API_KEY: "server-secret",
        SCALEWAY_GENAI_API_BASE:
          "https://api.scaleway.ai/example-deployment/v1",
        CONFIRM_LIVE_LLM_DEMO: "yes",
      },
      fetchImpl,
    );

    await runLlmJobDemo(adapter, request);

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.scaleway.ai/example-deployment/v1/chat/completions",
      expect.any(Object),
    );
  });

  it("rejects provider usage beyond the reserved limits", async () => {
    const adapter = createFixtureAdapter("scaleway");
    await expect(
      runLlmJobDemo(
        {
          ...adapter,
          execute: vi.fn().mockResolvedValue({
            model: "fixture",
            executionId: "bad-usage",
            promptTokens: 257,
            completionTokens: 1,
            output: "output",
            verificationLabel: "fixture",
          }),
        },
        request,
      ),
    ).rejects.toThrow(/exceeds the requested limit/);
  });
});
