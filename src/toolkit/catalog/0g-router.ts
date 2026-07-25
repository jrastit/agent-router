import { z } from "zod";

import type {
  ModelCatalogAdapter,
  ModelCatalogQuery,
  ModelRoute,
} from "../contracts";

const modelListSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().min(1),
      pricing: z.object({
        prompt: z.string().regex(/^\d+$/),
        completion: z.string().regex(/^\d+$/),
      }),
    }),
  ),
});

const providerListSchema = z.object({
  data: z
    .array(
      z.object({
        address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
        latency: z.number().int().nonnegative().nullish(),
        verifiability: z.string().min(1).optional(),
        trust_mode: z.string().min(1).optional(),
        tee_attested: z.boolean().optional(),
      }),
    )
    .default([]),
});

type ZgRouterCatalogOptions = Readonly<{
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}>;

export class ZgRouterCatalogAdapter implements ModelCatalogAdapter {
  private readonly baseUrl: string;
  private readonly fetch: typeof globalThis.fetch;

  constructor(options: ZgRouterCatalogOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "https://router-api.0g.ai/v1").replace(
      /\/$/,
      "",
    );
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  async list(query: ModelCatalogQuery): Promise<readonly ModelRoute[]> {
    if (query.capability !== "chat") {
      return [];
    }

    const modelsResponse = await this.fetch(`${this.baseUrl}/models`);
    if (!modelsResponse.ok) {
      throw new Error(
        `0G Router models returned HTTP ${modelsResponse.status}`,
      );
    }
    const models = modelListSchema.parse(await modelsResponse.json()).data;

    const routes = await Promise.all(
      models.map(async (model): Promise<ModelRoute[]> => {
        const providersResponse = await this.fetch(
          `${this.baseUrl}/providers?model=${encodeURIComponent(model.id)}`,
        );
        if (!providersResponse.ok) {
          throw new Error(
            `0G Router providers returned HTTP ${providersResponse.status}`,
          );
        }
        const providers = providerListSchema.parse(
          await providersResponse.json(),
        ).data;

        return providers
          .filter(
            (provider) =>
              query.privacy === "public" ||
              (provider.verifiability === "TeeML" &&
                provider.trust_mode === "private" &&
                provider.tee_attested === true),
          )
          .map((provider) => {
            const confidential =
              provider.verifiability === "TeeML" &&
              provider.trust_mode === "private" &&
              provider.tee_attested === true;
            return {
              id: `0g:${model.id}:${provider.address.toLowerCase()}`,
              providerAddress: provider.address,
              model: model.id,
              capability: "chat",
              privacy: confidential
                ? ("confidential" as const)
                : ("public" as const),
              expectedLatencyMs: provider.latency ?? 0,
              price: {
                currency: "0G",
                inputAmount: model.pricing.prompt,
                outputAmount: model.pricing.completion,
                unit: "neuron-per-token",
              },
              provenance: {
                network: "0g-mainnet",
                endpoint: this.baseUrl,
                verification:
                  provider.verifiability ?? provider.trust_mode ?? "standard",
              },
            };
          });
      }),
    );

    return routes.flat().sort((left, right) => left.id.localeCompare(right.id));
  }
}
