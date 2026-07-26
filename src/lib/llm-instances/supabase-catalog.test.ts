import { describe, expect, it, vi } from "vitest";

import { createSupabaseLlmCatalogHandler } from "./supabase-catalog";

describe("Supabase LLM catalog", () => {
  it("maps every database row to safe public catalog fields", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json([
        {
          provider: "scaleway",
          model_id: "model-a",
          name: "Model A",
          base_url: "https://api.example.com/v1",
          capabilities: ["chat"],
          privacy: "public",
          enabled: true,
          expected_latency_ms: 1800,
          input_price_eur_per_million_tokens: "0.25",
          output_price_eur_per_million_tokens: "0.50",
          source_metadata: { apiKey: "must-not-be-returned" },
        },
        {
          provider: "0g",
          model_id: "model-b",
          name: "Model B",
          base_url: "https://router.example.com/v1",
          capabilities: ["chat"],
          privacy: "confidential",
          enabled: false,
          expected_latency_ms: 2600,
          input_price_eur_per_million_tokens: null,
          output_price_eur_per_million_tokens: null,
        },
      ]),
    );

    const response = await createSupabaseLlmCatalogHandler({
      supabaseUrl: "https://supabase.example.com",
      serviceRoleKey: "service-secret",
      fetcher,
    })();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(JSON.parse(body).instances).toHaveLength(2);
    expect(body).toContain('"inputPriceEurPerMillionTokens":"0.25"');
    expect(body).not.toMatch(/service-secret|apiKey|source_metadata/);
    expect(fetcher.mock.calls[0]?.[0]).not.toContain("enabled=eq.true");
  });
});
