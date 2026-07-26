import { describe, expect, it, vi } from "vitest";

import { createLlmMcpClient } from "./llm-client";

const instance = {
  id: 42,
  name: "Private model",
  provider: "0g",
  model_id: "private-model",
  capabilities: ["chat"],
  privacy: "confidential",
  input_price_tinybar_per_million: "100",
  output_price_tinybar_per_million: "300",
  price_synced_at: "2026-07-26T02:00:00.000Z",
};

const jobInput = {
  instanceId: "42",
  prompt: "Keep this prompt private",
  capability: "chat",
  privacy: "confidential" as const,
  maximumInputTokens: 512,
  maximumOutputTokens: 128,
  spendCeilingTinybars: "10000",
  idempotencyKey: "mcp-request-001",
};

describe("LLM MCP client", () => {
  it("projects runnable instances without database field names", async () => {
    const client = createLlmMcpClient({
      catalogHandler: vi.fn().mockResolvedValue(Response.json([instance])),
      submissionHandler: vi.fn(),
    });

    await expect(client.listInstances()).resolves.toEqual({
      tool: "list_llm_instances",
      instances: [
        {
          id: "42",
          name: "Private model",
          provider: "0g",
          model: "private-model",
          capabilities: ["chat"],
          privacy: "confidential",
          inputPriceTinybarsPerMillionTokens: "100",
          outputPriceTinybarsPerMillionTokens: "300",
          priceSyncedAt: "2026-07-26T02:00:00.000Z",
        },
      ],
    });
  });

  it("submits the selected instance with transport authentication", async () => {
    const submissionHandler = vi
      .fn()
      .mockResolvedValue(
        Response.json({ id: "llm-job:1", state: "accepted" }, { status: 201 }),
      );
    const client = createLlmMcpClient({
      catalogHandler: vi.fn(),
      submissionHandler,
      userAccessToken: "user-access-token",
    });

    await expect(client.createJob(jobInput)).resolves.toEqual({
      tool: "create_llm_job",
      job: { id: "llm-job:1", state: "accepted", instanceId: "42" },
    });
    const request = submissionHandler.mock.calls[0]?.[0] as Request;
    expect(request.headers.get("authorization")).toBe(
      "Bearer user-access-token",
    );
    expect(request.headers.get("idempotency-key")).toBe("mcp-request-001");
    expect(await request.json()).toMatchObject({ instanceId: "42" });
    expect(
      JSON.stringify(await request.json().catch(() => null)),
    ).not.toContain("user-access-token");
  });

  it("requires transport authentication for job creation", async () => {
    const client = createLlmMcpClient({
      catalogHandler: vi.fn(),
      submissionHandler: vi.fn(),
    });
    await expect(client.createJob(jobInput)).rejects.toThrow(
      "Authentication required",
    );
  });
});
