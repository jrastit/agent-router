import { z } from "zod";

import { deriveEurPerMillionTokens } from "./fx-pricing";
import {
  estimateAgentPerformanceScore,
  PERFORMANCE_SCORE_BASIS,
} from "./performance-score";

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
      pricing_eur: z
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

export type ZgModel = z.infer<typeof zgModelCatalogSchema>["data"][number];
type ZgProvider = z.infer<typeof zgProviderCatalogSchema>["data"][number];

const existingEurRowSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  model_id: z.string(),
  input_price_eur_per_million_tokens: z
    .union([z.string(), z.number()])
    .transform(String)
    .nullable(),
  output_price_eur_per_million_tokens: z
    .union([z.string(), z.number()])
    .transform(String)
    .nullable(),
  source_metadata: z.record(z.string(), z.unknown()),
});

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
  fxSnapshot?: {
    usdPerEur: string;
    observedOn: string;
    source: "ECB";
  };
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
  const inputPriceEurPerMillionTokens = deriveEurPerMillionTokens({
    eurPerToken: input.model.pricing_eur?.prompt,
    usdPerToken: input.model.pricing_usd?.prompt,
    usdPerEur: input.fxSnapshot?.usdPerEur,
  });
  const outputPriceEurPerMillionTokens = deriveEurPerMillionTokens({
    eurPerToken: input.model.pricing_eur?.completion,
    usdPerToken: input.model.pricing_usd?.completion,
    usdPerEur: input.fxSnapshot?.usdPerEur,
  });
  const usedFxSnapshot =
    input.fxSnapshot &&
    ((input.model.pricing_eur?.prompt === undefined &&
      input.model.pricing_usd?.prompt !== undefined) ||
      (input.model.pricing_eur?.completion === undefined &&
        input.model.pricing_usd?.completion !== undefined));
  const pricingFxSnapshot =
    usedFxSnapshot && input.fxSnapshot
      ? {
          source: input.fxSnapshot.source,
          base: "EUR",
          quote: "USD",
          usdPerEur: input.fxSnapshot.usdPerEur,
          observedOn: input.fxSnapshot.observedOn,
        }
      : null;
  const capabilities = zgCapabilities(input.model);
  const enabled = healthyProviders.length > 0;

  return {
    provider: "0g",
    model_id: input.model.id,
    name: input.model.name ?? input.model.id,
    base_url: input.baseUrl,
    capabilities,
    privacy: privateProviders.length > 0 ? "confidential" : "public",
    enabled,
    expected_latency_ms: latencies.length > 0 ? Math.min(...latencies) : 0,
    input_price_eur_per_million_tokens: inputPriceEurPerMillionTokens ?? null,
    output_price_eur_per_million_tokens: outputPriceEurPerMillionTokens ?? null,
    performance_score: estimateAgentPerformanceScore({
      enabled,
      capabilities,
      hasExactPrices:
        inputPriceEurPerMillionTokens !== undefined &&
        outputPriceEurPerMillionTokens !== undefined,
      healthyProviderCount: healthyProviders.length,
      expectedLatencyMs: latencies.length > 0 ? Math.min(...latencies) : 0,
    }),
    performance_score_basis: PERFORMANCE_SCORE_BASIS,
    source_metadata: {
      type: input.model.type ?? null,
      description: input.model.description ?? null,
      contextLength: input.model.context_length ?? null,
      maxCompletionTokens: input.model.max_completion_tokens ?? null,
      supportedParameters: input.model.supported_parameters ?? [],
      supportedFormats: input.model.supported_formats ?? [],
      pricing: input.model.pricing ?? null,
      pricingUsd: input.model.pricing_usd ?? null,
      pricingEur: input.model.pricing_eur ?? null,
      pricingFxSnapshot,
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

export async function updateMissingZgEurPrices(input: {
  models: readonly ZgModel[];
  fxSnapshot:
    { usdPerEur: string; observedOn: string; source: "ECB" } | undefined;
  supabaseUrl: string;
  serviceRoleKey: string;
  fetcher?: typeof fetch;
}) {
  const fetcher = input.fetcher ?? fetch;
  const base = input.supabaseUrl.replace(/\/$/, "");
  const headers = {
    apikey: input.serviceRoleKey,
    authorization: `Bearer ${input.serviceRoleKey}`,
  };
  const existingResponse = await fetcher(
    `${base}/rest/v1/llm_instances?provider=eq.0g&select=id,model_id,input_price_eur_per_million_tokens,output_price_eur_per_million_tokens,source_metadata`,
    { headers, signal: AbortSignal.timeout(15_000) },
  );
  if (!existingResponse.ok) {
    throw new Error(
      `Supabase EUR catalog query failed (${existingResponse.status})`,
    );
  }
  const existing = z
    .array(existingEurRowSchema)
    .parse(await existingResponse.json());
  const models = new Map(input.models.map((model) => [model.id, model]));
  let updated = 0;
  for (const row of existing) {
    const model = models.get(row.model_id);
    if (!model) continue;
    const patch: Record<string, unknown> = {};
    if (row.input_price_eur_per_million_tokens === null) {
      const value = deriveEurPerMillionTokens({
        eurPerToken: model.pricing_eur?.prompt,
        usdPerToken: model.pricing_usd?.prompt,
        usdPerEur: input.fxSnapshot?.usdPerEur,
      });
      if (value !== undefined) {
        patch.input_price_eur_per_million_tokens = value;
      }
    }
    if (row.output_price_eur_per_million_tokens === null) {
      const value = deriveEurPerMillionTokens({
        eurPerToken: model.pricing_eur?.completion,
        usdPerToken: model.pricing_usd?.completion,
        usdPerEur: input.fxSnapshot?.usdPerEur,
      });
      if (value !== undefined) {
        patch.output_price_eur_per_million_tokens = value;
      }
    }
    if (Object.keys(patch).length === 0) continue;
    patch.source_metadata = {
      ...row.source_metadata,
      pricingUsd: model.pricing_usd ?? null,
      pricingEur: model.pricing_eur ?? null,
      pricingFxSnapshot: input.fxSnapshot
        ? {
            source: input.fxSnapshot.source,
            base: "EUR",
            quote: "USD",
            usdPerEur: input.fxSnapshot.usdPerEur,
            observedOn: input.fxSnapshot.observedOn,
          }
        : null,
    };
    const response = await fetcher(
      `${base}/rest/v1/llm_instances?id=eq.${encodeURIComponent(row.id)}`,
      {
        method: "PATCH",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify(patch),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok) {
      throw new Error(
        `Supabase EUR price update failed for ${row.model_id} (${response.status})`,
      );
    }
    updated += 1;
  }
  return updated;
}
