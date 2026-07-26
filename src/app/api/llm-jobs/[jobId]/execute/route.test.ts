import { describe, expect, it, vi } from "vitest";

import { createLlmJobExecutionHandler } from "../../../../../lib/llm-jobs/supabase-execution";

const dependencies = {
  load: vi.fn().mockResolvedValue({
    id: "job:1",
    state: "delivered",
    provider: "scaleway",
    model: "model",
    prompt: "private",
    maximumInputTokens: 1,
    maximumOutputTokens: 1,
  }),
  reserve: vi.fn(),
  startAttempt: vi.fn(),
  scaleway: { execute: vi.fn() },
  zg: { execute: vi.fn() },
  settle: vi.fn(),
  reconcile: vi.fn(),
  failAndRelease: vi.fn(),
};

function request(token?: string) {
  return new Request("https://app.example.com/api/llm-jobs/job:1/execute", {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe("POST /api/llm-jobs/[jobId]/execute", () => {
  it("requires a valid authenticated user before loading a job", async () => {
    const handler = createLlmJobExecutionHandler({
      supabaseUrl: "https://supabase.example.com",
      serviceRoleKey: "service-secret",
      createDependencies: vi.fn().mockReturnValue(dependencies),
      fetcher: vi.fn(),
    });
    expect(
      (
        await handler(request(), {
          params: Promise.resolve({ jobId: "job:1" }),
        })
      ).status,
    ).toBe(401);
  });

  it("executes only through user-scoped durable dependencies", async () => {
    const createDependencies = vi.fn().mockReturnValue(dependencies);
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ id: "11111111-1111-4111-8111-111111111111" }),
      );
    const handler = createLlmJobExecutionHandler({
      supabaseUrl: "https://supabase.example.com",
      serviceRoleKey: "service-secret",
      createDependencies,
      fetcher,
    });
    const response = await handler(request("user-jwt"), {
      params: Promise.resolve({ jobId: "job:1" }),
    });
    const responseCopy = response.clone();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      state: "delivered",
      jobId: "job:1",
    });
    expect(createDependencies).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "user-jwt",
    );
    expect(JSON.stringify(await responseCopy.text())).not.toMatch(
      /private|service-secret|user-jwt/,
    );
  });
});
