import { z } from "zod";

export const runnableLlmInstanceSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string(),
  provider: z.enum(["scaleway", "0g"]),
  model_id: z.string(),
  capabilities: z.array(z.string()),
  privacy: z.enum(["public", "confidential"]),
  input_price_tinybar_per_million: z
    .union([z.string(), z.number()])
    .transform(String),
  output_price_tinybar_per_million: z
    .union([z.string(), z.number()])
    .transform(String),
  price_synced_at: z.string(),
});

export const runnableLlmInstancesSchema = z.array(runnableLlmInstanceSchema);
export type RunnableLlmInstance = z.infer<typeof runnableLlmInstanceSchema>;

export function createRunnableLlmCatalogHandler(input: {
  supabaseUrl?: string;
  serviceRoleKey?: string;
  fetcher?: typeof fetch;
}) {
  return async function GET() {
    if (!input.supabaseUrl || !input.serviceRoleKey) {
      return Response.json(
        { error: "Runnable LLM catalog unavailable" },
        { status: 503 },
      );
    }
    try {
      const response = await (input.fetcher ?? fetch)(
        `${input.supabaseUrl.replace(/\/$/, "")}/rest/v1/llm_instances?enabled=eq.true&input_price_tinybar_per_million=not.is.null&output_price_tinybar_per_million=not.is.null&price_synced_at=not.is.null&order=provider.asc,model_id.asc&select=id,name,provider,model_id,capabilities,privacy,input_price_tinybar_per_million,output_price_tinybar_per_million,price_synced_at`,
        {
          headers: {
            apikey: input.serviceRoleKey,
            authorization: `Bearer ${input.serviceRoleKey}`,
          },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!response.ok) throw new Error("catalog query failed");
      return Response.json(
        runnableLlmInstancesSchema.parse(await response.json()),
        { headers: { "cache-control": "no-store" } },
      );
    } catch {
      return Response.json(
        { error: "Runnable LLM catalog unavailable" },
        { status: 502 },
      );
    }
  };
}
