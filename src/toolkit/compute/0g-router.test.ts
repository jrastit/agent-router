import { describe, expect, it, vi } from "vitest";

import type { ModelRoute } from "../contracts";
import { ZgRouterComputeAdapter } from "./0g-router";

const route: ModelRoute = {
  id: "0g:private",
  providerAddress: "0x0000000000000000000000000000000000000001",
  model: "0gm-private",
  capability: "chat",
  privacy: "confidential",
  expectedLatencyMs: 1000,
  price: {
    currency: "0G",
    inputAmount: "1",
    outputAmount: "2",
    unit: "neuron-per-token",
  },
  provenance: {
    network: "0g-mainnet",
    endpoint: "https://router-api.0g.ai/v1",
    verification: "TeeML",
  },
};

const request = { route, prompt: "secret", idempotencyKey: "job-1" };

describe("ZgRouterComputeAdapter", () => {
  it("pins the selected TeeML provider and enforces private trust mode", async () => {
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        id: "chat-1",
        choices: [{ message: { content: "private result" } }],
      }),
    );
    const adapter = new ZgRouterComputeAdapter({
      apiKey: "sk-test",
      fetch,
    });

    await expect(adapter.execute(request)).resolves.toMatchObject({
      output: "private result",
      evidence: { executionId: "chat-1", verified: true },
    });
    expect(fetch.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: "Bearer sk-test",
      "X-0G-Provider-Address": route.providerAddress,
      "X-0G-Provider-Allow-Fallbacks": "false",
      "X-0G-Provider-Trust-Mode": "private",
    });
  });

  it("retries transient failures and returns a stable terminal code", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        Response.json({
          id: "chat-2",
          choices: [{ message: { content: "ok" } }],
        }),
      );
    const adapter = new ZgRouterComputeAdapter({
      apiKey: "sk-test",
      fetch,
      maxAttempts: 2,
      retryDelay: async () => undefined,
    });

    await expect(adapter.execute(request)).resolves.toMatchObject({
      output: "ok",
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("fails closed for a non-private route", async () => {
    const adapter = new ZgRouterComputeAdapter({
      apiKey: "sk-test",
      fetch: vi.fn(),
    });

    await expect(
      adapter.execute({
        ...request,
        route: { ...route, privacy: "public" },
      }),
    ).rejects.toMatchObject({ code: "ZG_COMPUTE_POLICY_REJECTED" });
  });

  it("rejects management keys for inference", () => {
    expect(
      () => new ZgRouterComputeAdapter({ apiKey: "mk-management" }),
    ).toThrow(expect.objectContaining({ code: "ZG_COMPUTE_CONFIGURATION" }));
  });
});
