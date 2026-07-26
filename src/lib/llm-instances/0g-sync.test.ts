import { describe, expect, it } from "vitest";

import {
  createZgInstanceRow,
  zgModelCatalogSchema,
  zgProviderCatalogSchema,
} from "./0g-sync";

const model = zgModelCatalogSchema.parse({
  data: [
    {
      id: "private-model",
      name: "Private model",
      type: "chatbot",
      pricing: { prompt: "1", completion: "2" },
      pricing_usd: { prompt: "0.00000008", completion: "0.00000048" },
      provider_count: 2,
    },
  ],
}).data[0];

describe("0G catalog synchronization", () => {
  it("marks a model confidential when a healthy private TeeML route exists", () => {
    const providers = zgProviderCatalogSchema.parse({
      data: [
        {
          address: `0x${"11".repeat(20)}`,
          is_healthy: true,
          latency: 42,
          trust_mode: "private",
          verifiability: "TeeML",
          tee_attested: true,
        },
        {
          address: `0x${"22".repeat(20)}`,
          is_healthy: false,
          trust_mode: "standard",
        },
      ],
    }).data;

    const row = createZgInstanceRow({
      model,
      providers,
      baseUrl: "https://router-api.0g.ai/v1",
      syncedAt: "2026-07-26T00:00:00.000Z",
      fxSnapshot: {
        usdPerEur: "1.1377",
        observedOn: "2026-07-24",
        source: "ECB",
      },
    });

    expect(row).toMatchObject({
      model_id: "private-model",
      privacy: "confidential",
      enabled: true,
      expected_latency_ms: 42,
      input_price_eur_per_million_tokens: "0.070317",
      output_price_eur_per_million_tokens: "0.421904",
      source_metadata: {
        healthyProviderCount: 1,
        hasPrivateProvider: true,
        pricingFxSnapshot: {
          source: "ECB",
          usdPerEur: "1.1377",
          observedOn: "2026-07-24",
        },
      },
    });
    expect(row.source_metadata.providers).toHaveLength(1);
  });

  it("keeps catalog-only models disabled", () => {
    const row = createZgInstanceRow({
      model,
      providers: [],
      baseUrl: "https://router-api.0g.ai/v1",
      syncedAt: "2026-07-26T00:00:00.000Z",
    });

    expect(row).toMatchObject({
      privacy: "public",
      enabled: false,
      source_metadata: {
        healthyProviderCount: 0,
        hasPrivateProvider: false,
      },
    });
  });
});
