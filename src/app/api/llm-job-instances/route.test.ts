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
});
