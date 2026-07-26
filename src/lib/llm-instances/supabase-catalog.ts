import { z } from "zod";

import { llmInstanceCatalogSchema, type LlmInstanceCatalog } from "./schema";

const databaseRowSchema = z.object({
  provider: z.string(),
  model_id: z.string(),
  name: z.string(),
  base_url: z.string(),
  capabilities: z.array(z.string()),
  privacy: z.enum(["public", "confidential"]),
  enabled: z.boolean(),
  expected_latency_ms: z.number().int().nonnegative(),
  input_price_eur_per_million_tokens: z
    .union([z.string(), z.number()])
    .transform(String)
    .nullable(),
  output_price_eur_per_million_tokens: z
    .union([z.string(), z.number()])
    .transform(String)
    .nullable(),
  performance_score: z.number().int().min(0).max(100).nullable(),
  performance_score_basis: z.literal("catalog-readiness-v1").nullable(),
});

const databaseRowsSchema = z.array(databaseRowSchema).max(200);

export function createSupabaseLlmCatalogHandler(input: {
  supabaseUrl?: string;
  serviceRoleKey?: string;
  fetcher?: typeof fetch;
}) {
  return async function GET() {
    if (!input.supabaseUrl || !input.serviceRoleKey) {
      return Response.json(
        { error: "LLM instance catalog unavailable" },
        { status: 503 },
      );
    }

    try {
      const response = await (input.fetcher ?? fetch)(
        `${input.supabaseUrl.replace(/\/$/, "")}/rest/v1/llm_instances?order=provider.asc,model_id.asc&select=provider,model_id,name,base_url,capabilities,privacy,enabled,expected_latency_ms,input_price_eur_per_million_tokens,output_price_eur_per_million_tokens,performance_score,performance_score_basis`,
        {
          headers: {
            apikey: input.serviceRoleKey,
            authorization: `Bearer ${input.serviceRoleKey}`,
          },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!response.ok) throw new Error("catalog query failed");

      const instances = databaseRowsSchema
        .parse(await response.json())
        .map((row) => ({
          id: `${row.provider}-${row.model_id}`,
          name: row.name,
          provider: row.provider,
          model: row.model_id,
          baseUrl: row.base_url,
          capabilities: row.capabilities,
          privacy: row.privacy,
          enabled: row.enabled,
          expectedLatencyMs: row.expected_latency_ms,
          inputPriceEurPerMillionTokens:
            row.input_price_eur_per_million_tokens ?? undefined,
          outputPriceEurPerMillionTokens:
            row.output_price_eur_per_million_tokens ?? undefined,
          performanceScore: row.performance_score ?? undefined,
          performanceScoreBasis: row.performance_score_basis ?? undefined,
        }));
      const catalog: LlmInstanceCatalog = llmInstanceCatalogSchema.parse({
        version: 1,
        instances,
      });

      return Response.json(catalog, {
        headers: { "cache-control": "no-store" },
      });
    } catch {
      return Response.json(
        { error: "LLM instance catalog unavailable" },
        { status: 502 },
      );
    }
  };
}
