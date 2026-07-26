import { describe, expect, it, vi } from "vitest";

import { createLlmJobSubmissionHandler } from "../../../lib/llm-jobs/submission";

const requestBody = {
  instanceId: "42",
  prompt: "private prompt",
  capability: "chat",
  privacy: "confidential",
  maximumInputTokens: 512,
  maximumOutputTokens: 128,
  spendCeilingTinybars: "10000",
};

function request(body: unknown = requestBody, token = "user-jwt") {
  return new Request("https://app.example.com/api/llm-jobs", {
    method: "POST",
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "content-type": "application/json",
      "idempotency-key": "request-001",
    },
    body: JSON.stringify(body),
  });
}

const user = { id: "11111111-1111-4111-8111-111111111111" };
const instance = {
  id: 42,
  provider: "0g",
  model_id: "private-model",
  base_url: "https://router-api.0g.ai/v1",
  capabilities: ["chat"],
  privacy: "confidential",
  enabled: true,
  input_price_tinybar_per_million: "100",
  output_price_tinybar_per_million: "300",
  price_synced_at: "2026-07-26T02:00:00.000Z",
  source_metadata: {},
};

function handler(
  fetcher: typeof fetch,
  environment: Readonly<Record<string, string | undefined>> = {
    G_API_KEY_PRIVATE: "secret",
  },
) {
  return createLlmJobSubmissionHandler({
    supabaseUrl: "https://supabase.example.com",
    serviceRoleKey: "service-secret",
    environment,
    maximumPriceAgeMs: 60_000,
    now: () => new Date("2026-07-26T02:00:30.000Z"),
    id: () => "llm-job:1",
    fetcher,
  });
}

describe("POST /api/llm-jobs", () => {
  it("requires authentication and rejects secret-like request fields", async () => {
    expect((await handler(vi.fn())(request(requestBody, ""))).status).toBe(401);
    const response = await handler(vi.fn())(
      request({ ...requestBody, apiKey: "browser-secret" }),
    );
    expect(response.status).toBe(400);
  });

  it.each([
    ["INSTANCE_DISABLED", { enabled: false }, { G_API_KEY_PRIVATE: "secret" }],
    [
      "CAPABILITY_INCOMPATIBLE",
      { capabilities: ["embedding"] },
      { G_API_KEY_PRIVATE: "secret" },
    ],
    [
      "PRIVACY_INCOMPATIBLE",
      { privacy: "public" },
      { G_API_KEY_PRIVATE: "secret" },
    ],
    [
      "PRICE_STALE",
      { price_synced_at: "2026-07-25T02:00:00.000Z" },
      { G_API_KEY_PRIVATE: "secret" },
    ],
    ["PROVIDER_UNCREDENTIALLED", {}, {}],
  ] as const)("rejects %s before persistence", async (code, changes, env) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(user))
      .mockResolvedValueOnce(Response.json([{ ...instance, ...changes }]));
    const response = await handler(fetcher, env)(request());
    expect(await response.json()).toEqual({ error: code });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("persists an authenticated private input and returns no secret content", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(user))
      .mockResolvedValueOnce(Response.json([instance]))
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(
        Response.json([{ id: "llm-job:1", state: "accepted" }]),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const response = await handler(fetcher)(request());
    const responseCopy = response.clone();
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      id: "llm-job:1",
      state: "accepted",
    });
    expect(fetcher.mock.calls[3]?.[1]?.body).not.toContain("private prompt");
    expect(fetcher.mock.calls[4]?.[1]?.body).toContain("private prompt");
    expect(JSON.stringify(await responseCopy.text())).not.toMatch(
      /private prompt|service-secret|secret/,
    );
  });

  it("returns an existing idempotent job without persisting another input", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(user))
      .mockResolvedValueOnce(Response.json([instance]))
      .mockResolvedValueOnce(
        Response.json([{ id: "llm-job:existing", state: "reserved" }]),
      );
    const response = await handler(fetcher)(request());
    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
