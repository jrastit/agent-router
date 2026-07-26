import { describe, expect, it, vi } from "vitest";

import {
  createScalewayWorkloadAdapter,
  createZgWorkloadAdapter,
  LlmProviderError,
} from "./providers";

const request = {
  model: "model-1",
  prompt: "private prompt",
  maximumInputTokens: 100,
  maximumOutputTokens: 50,
  idempotencyKey: "attempt-1",
};

function completion(overrides: Record<string, unknown> = {}) {
  return {
    id: "execution-1",
    model: "model-1",
    choices: [{ message: { content: "private result" } }],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    },
    ...overrides,
  };
}

describe("Scaleway workload adapter", () => {
  it("uses a bounded explicit chat completion and captures integer usage", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(completion()));
    const result = await createScalewayWorkloadAdapter({
      apiKey: "scaleway-secret",
      baseUrl: "https://api.scaleway.ai/v1/",
      timeoutMs: 100,
      fetcher,
    }).execute(request);

    expect(result.usage).toEqual({
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    });
    expect(result.evidence.verificationLabel).toMatch(/provider-reported/);
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.scaleway.ai/v1/chat/completions",
      expect.objectContaining({
        body: expect.stringContaining('"max_tokens":50'),
      }),
    );
    expect(JSON.stringify(result.evidence)).not.toMatch(
      /private prompt|private result|scaleway-secret/,
    );
  });

  it.each([
    ["OUTPUT_INVALID", completion({ choices: [{ message: { content: "" } }] })],
    ["OUTPUT_INVALID", completion({ model: "other-model" })],
    ["USAGE_MISSING", completion({ usage: undefined })],
    [
      "USAGE_EXCEEDED",
      completion({
        usage: {
          prompt_tokens: 101,
          completion_tokens: 20,
          total_tokens: 121,
        },
      }),
    ],
  ])("fails closed with %s", async (code, body) => {
    const adapter = createScalewayWorkloadAdapter({
      apiKey: "secret",
      baseUrl: "https://provider.example.com/v1",
      fetcher: vi.fn().mockResolvedValue(Response.json(body)),
    });
    await expect(adapter.execute(request)).rejects.toMatchObject({ code });
  });

  it("classifies authentication and timeout without leaking the key", async () => {
    const authAdapter = createScalewayWorkloadAdapter({
      apiKey: "do-not-leak",
      baseUrl: "https://provider.example.com/v1",
      fetcher: vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    });
    const authError = await authAdapter
      .execute(request)
      .catch((error) => error);
    expect(authError).toMatchObject({ code: "PROVIDER_AUTHENTICATION" });
    expect(String(authError)).not.toContain("do-not-leak");

    const timeoutAdapter = createScalewayWorkloadAdapter({
      apiKey: "secret",
      baseUrl: "https://provider.example.com/v1",
      timeoutMs: 1,
      fetcher: vi.fn<typeof fetch>((_url, init) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        });
      }),
    });
    await expect(timeoutAdapter.execute(request)).rejects.toMatchObject({
      code: "PROVIDER_TIMEOUT",
    });
  });
});

describe("0G workload adapter", () => {
  it("pins private routing, disables fallback, and labels evidence precisely", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(completion()));
    const result = await createZgWorkloadAdapter({
      apiKey: "0g-secret",
      baseUrl: "https://router-api.0g.ai/v1",
      maximumAttempts: 2,
      fetcher,
    }).execute({
      ...request,
      providerAddress: `0x${"11".repeat(20)}`,
      providerTrustMode: "private",
    });

    const headers = fetcher.mock.calls[0]?.[1]?.headers;
    expect(headers).toMatchObject({
      "x-0g-provider-address": `0x${"11".repeat(20)}`,
      "x-0g-provider-allow-fallbacks": "false",
      "x-0g-provider-trust-mode": "private",
    });
    expect(result.evidence.verificationLabel).toMatch(
      /not independently attested/,
    );
  });

  it("recovers one transient failure with the same idempotency key", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(Response.json(completion()));
    const adapter = createZgWorkloadAdapter({
      apiKey: "secret",
      baseUrl: "https://router.example.com/v1",
      maximumAttempts: 2,
      fetcher,
      retryDelay: vi.fn(),
    });
    await expect(
      adapter.execute({
        ...request,
        providerAddress: `0x${"11".repeat(20)}`,
        providerTrustMode: "private",
      }),
    ).resolves.toMatchObject({ evidence: { executionId: "execution-1" } });
    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({
      "idempotency-key": "attempt-1",
    });
    expect(fetcher.mock.calls[1]?.[1]?.headers).toMatchObject({
      "idempotency-key": "attempt-1",
    });
  });

  it("requires a pinned provider address", async () => {
    const adapter = createZgWorkloadAdapter({
      apiKey: "secret",
      baseUrl: "https://router.example.com/v1",
    });
    await expect(adapter.execute(request)).rejects.toBeInstanceOf(
      LlmProviderError,
    );
  });

  it("uses and records a verified route for a public 0G instance", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(completion()));
    const result = await createZgWorkloadAdapter({
      apiKey: "secret",
      baseUrl: "https://router.example.com/v1",
      fetcher,
    }).execute({
      ...request,
      providerAddress: `0x${"22".repeat(20)}`,
      providerTrustMode: "verified",
    });

    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({
      "x-0g-provider-trust-mode": "verified",
    });
    expect(result.evidence).toMatchObject({
      trustMode: "verified",
      providerAddress: `0x${"22".repeat(20)}`,
    });
  });
});
