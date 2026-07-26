import { describe, expect, it, vi } from "vitest";

import { createRunnableLlmCatalogHandler } from "../../../lib/llm-jobs/catalog";

describe("GET /api/llm-job-instances", () => {
  it("returns only the safe priced execution fields", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json([
        {
          id: 1,
          name: "Scaleway model",
          provider: "scaleway",
          model_id: "model",
          capabilities: ["chat"],
          privacy: "public",
          input_price_tinybar_per_million: 100,
          output_price_tinybar_per_million: 300,
          price_synced_at: "2026-07-26T03:00:00Z",
          performance_score: 92,
          performance_score_basis: "catalog-readiness-v1",
        },
      ]),
    );
    const response = await createRunnableLlmCatalogHandler({
      supabaseUrl: "https://supabase.example.com",
      serviceRoleKey: "service-secret",
      fetcher,
    })();
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain('"input_price_tinybar_per_million":"100"');
    expect(body).not.toMatch(/service-secret|apiKey|providerAddress/);
    expect(fetcher.mock.calls[0]?.[0]).toContain("enabled=eq.true");
  });

  it.each([
    [401, "catalog_unauthorized"],
    [403, "catalog_unauthorized"],
    [400, "catalog_query_failed"],
    [500, "catalog_query_failed"],
  ])("classifies a Supabase %s response as %s", async (status, code) => {
    const response = await createRunnableLlmCatalogHandler({
      supabaseUrl: "https://supabase.example.com",
      serviceRoleKey: "service-secret",
      fetcher: vi.fn().mockResolvedValue(new Response(null, { status })),
    })();
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code });
  });

  it("distinguishes missing server configuration", async () => {
    const response = await createRunnableLlmCatalogHandler({})();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: "configuration_error",
    });
  });
});
