import { describe, expect, it, vi } from "vitest";

import {
  createLlmJobEventHandler,
  createLlmJobSnapshotHandler,
  type LlmJobSnapshot,
} from "./snapshot";

const snapshot = {
  id: "job:1",
  state: "delivered",
  failureCode: null,
  provider: "scaleway",
  model: "model",
  capability: "chat",
  privacy: "public",
  maximumInputTokens: 100,
  maximumOutputTokens: 50,
  spendCeilingTinybars: "100",
  selectedInstance: {
    id: "1",
    name: "Scaleway",
    provider: "scaleway",
    model: "model",
    privacy: "public",
  },
  usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
  accounting: {
    reservedTinybars: "50",
    chargedTinybars: "20",
    refundedTinybars: "30",
    priceSnapshot: {},
  },
  remainingBalanceTinybars: "980",
  output: "private output",
  evidence: {
    executionId: "execution-1",
    verificationLabel: "provider-reported",
    providerAddress: null,
    trustMode: "standard",
  },
  createdAt: "2026-07-26T03:00:00Z",
  updatedAt: "2026-07-26T03:01:00Z",
} satisfies LlmJobSnapshot;

const context = { params: Promise.resolve({ jobId: "job:1" }) };
const request = new Request("https://app.example.com/api/llm-jobs/job:1", {
  headers: { authorization: "Bearer user-jwt" },
});

describe("LLM job snapshots and recovery events", () => {
  it("restores the authoritative owner-scoped snapshot", async () => {
    const reader = vi.fn().mockResolvedValue(snapshot);
    const response = await createLlmJobSnapshotHandler({ reader })(
      request,
      context,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(snapshot);
    expect(reader).toHaveBeenCalledWith("user-jwt", "job:1");
  });

  it("streams the persisted snapshot without prompting execution", async () => {
    const reader = vi.fn().mockResolvedValue(snapshot);
    const response = await createLlmJobEventHandler({ reader })(
      request,
      context,
    );
    const body = await response.text();
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain("event: llm-job");
    expect(body).toContain('"chargedTinybars":"20"');
    expect(body).toContain("event: complete");
    expect(reader).toHaveBeenCalledOnce();
  });

  it("requires authentication and hides unowned jobs", async () => {
    const reader = vi.fn().mockResolvedValue(null);
    const handler = createLlmJobSnapshotHandler({ reader });
    expect(
      (
        await handler(
          new Request("https://app.example.com/api/llm-jobs/job:1"),
          context,
        )
      ).status,
    ).toBe(401);
    expect((await handler(request, context)).status).toBe(404);
  });
});
