import { z } from "zod";

const exactAmount = z.union([z.string(), z.number()]).transform(String);

export const zgModelCatalogSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().min(1).max(300),
      name: z.string().min(1).max(300).optional(),
      description: z.string().optional(),
      type: z.string().optional(),
      context_length: z.number().int().nonnegative().optional(),
      max_completion_tokens: z.number().int().nonnegative().optional(),
      supported_parameters: z.array(z.string()).optional(),
      supported_formats: z.array(z.string()).optional(),
      pricing: z
        .object({
          prompt: exactAmount.optional(),
          completion: exactAmount.optional(),
        })
        .optional(),
      pricing_usd: z
        .object({
          prompt: exactAmount.optional(),
          completion: exactAmount.optional(),
        })
        .optional(),
      verifiability: z.string().optional().nullable(),
      tee_attested: z.boolean().optional().nullable(),
      tee_type: z.string().optional().nullable(),
      tee_verifier: z.string().optional().nullable(),
      provider_count: z.number().int().nonnegative().optional(),
    }),
  ),
});

export const zgProviderCatalogSchema = z.object({
  data: z
    .array(
      z.object({
        address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
        service_type: z.string().optional(),
        is_healthy: z.boolean().optional(),
        latency: z.number().int().nonnegative().nullish(),
        verifiability: z.string().optional().nullable(),
        trust_mode: z.string().optional().nullable(),
        tee_attested: z.boolean().optional().nullable(),
        tee_type: z.string().optional().nullable(),
        tee_verifier: z.string().optional().nullable(),
        provider_name: z.string().optional().nullable(),
      }),
    )
    .default([]),
});

type ZgModel = z.infer<typeof zgModelCatalogSchema>["data"][number];
type ZgProvider = z.infer<typeof zgProviderCatalogSchema>["data"][number];

export function zgCapabilities(model: ZgModel): string[] {
  switch (model.type) {
    case "speech-to-text":
      return ["transcription"];
    case "text-to-image":
      return ["image-generation"];
    case "embedding":
      return ["embedding"];
    default:
      return ["chat"];
  }
}

export function createZgInstanceRow(input: {
  model: ZgModel;
  providers: readonly ZgProvider[];
  baseUrl: string;
  syncedAt: string;
}) {
  const healthyProviders = input.providers.filter(
    (provider) => provider.is_healthy !== false,
  );
  const privateProviders = healthyProviders.filter(
    (provider) =>
      provider.trust_mode === "private" &&
      provider.verifiability === "TeeML" &&
      provider.tee_attested === true,
  );
  const latencies = healthyProviders
    .map((provider) => provider.latency)
    .filter(
      (latency): latency is number => latency !== null && latency !== undefined,
    );

  return {
    provider: "0g",
    model_id: input.model.id,
    name: input.model.name ?? input.model.id,
    base_url: input.baseUrl,
    capabilities: zgCapabilities(input.model),
    privacy: privateProviders.length > 0 ? "confidential" : "public",
    enabled: healthyProviders.length > 0,
    expected_latency_ms: latencies.length > 0 ? Math.min(...latencies) : 0,
    source_metadata: {
      type: input.model.type ?? null,
      description: input.model.description ?? null,
      contextLength: input.model.context_length ?? null,
      maxCompletionTokens: input.model.max_completion_tokens ?? null,
      supportedParameters: input.model.supported_parameters ?? [],
      supportedFormats: input.model.supported_formats ?? [],
      pricing: input.model.pricing ?? null,
      pricingUsd: input.model.pricing_usd ?? null,
      catalogVerifiability: input.model.verifiability ?? null,
      catalogTeeAttested: input.model.tee_attested ?? false,
      catalogTeeType: input.model.tee_type ?? null,
      catalogTeeVerifier: input.model.tee_verifier ?? null,
      catalogProviderCount: input.model.provider_count ?? 0,
      healthyProviderCount: healthyProviders.length,
      hasPrivateProvider: privateProviders.length > 0,
      providers: healthyProviders.map((provider) => ({
        address: provider.address.toLowerCase(),
        serviceType: provider.service_type ?? null,
        latencyMs: provider.latency ?? null,
        trustMode: provider.trust_mode ?? null,
        verifiability: provider.verifiability ?? null,
        teeAttested: provider.tee_attested ?? false,
        teeType: provider.tee_type ?? null,
        teeVerifier: provider.tee_verifier ?? null,
        providerName: provider.provider_name ?? null,
      })),
    },
    synced_at: input.syncedAt,
    updated_at: input.syncedAt,
  };
}
