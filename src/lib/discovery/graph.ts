import { z } from "zod";

import type { DiscoveryAdapter, DiscoveryQuery } from "./adapter";
import { DiscoveryError } from "./errors";
import { discoveryResultSchema } from "./schema";

const graphResponseSchema = z.strictObject({
  data: z
    .strictObject({
      _meta: z
        .strictObject({
          block: z.strictObject({
            number: z.number().int().nonnegative(),
          }),
        })
        .optional(),
      providerOffers: z.array(
        z.strictObject({
          id: z.string().min(1),
          capability: z.string().min(1),
          inputType: z.string().min(1),
          outputType: z.string().min(1),
          currency: z.string().regex(/^[A-Z]{3}$/),
          amountMinor: z.string().regex(/^(0|[1-9]\d*)$/),
          expectedLatencyMs: z.string().regex(/^(0|[1-9]\d*)$/),
          quoteTtlSeconds: z.string().regex(/^[1-9]\d*$/),
          updatedAt: z.string().regex(/^(0|[1-9]\d*)$/),
          provider: z.strictObject({
            id: z.string().min(1),
            name: z.string().min(1),
            capabilities: z.array(z.string().min(1)),
            privacyClasses: z.array(z.enum(["public", "confidential"])).min(1),
            settlementAccount: z.string().min(1),
            active: z.boolean(),
          }),
        }),
      ),
    })
    .optional(),
  errors: z.array(z.object({ message: z.string() }).passthrough()).optional(),
});

const providerQuery = `
  query DiscoverProviders(
    $capability: String!
    $inputType: String!
    $outputType: String!
  ) {
    _meta { block { number } }
    providerOffers(
      where: {
        capability: $capability
        inputType: $inputType
        outputType: $outputType
        active: true
        provider_: { active: true }
      }
      orderBy: amountMinor
      orderDirection: asc
    ) {
      id
      capability
      inputType
      outputType
      currency
      amountMinor
      expectedLatencyMs
      quoteTtlSeconds
      updatedAt
      provider {
        id
        name
        capabilities
        privacyClasses
        settlementAccount
        active
      }
    }
  }
`;

export interface GraphDiscoveryConfig {
  endpoint: string;
  deploymentId: string;
  network: string;
  maxStalenessMs: number;
  accessToken?: string;
  fetch?: typeof globalThis.fetch;
}

function safeInteger(value: string, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new DiscoveryError(
      "DISCOVERY_MALFORMED",
      `${field} exceeds the safe integer range`,
    );
  }
  return parsed;
}

export class GraphDiscoveryAdapter implements DiscoveryAdapter {
  private readonly fetch: typeof globalThis.fetch;

  constructor(private readonly config: GraphDiscoveryConfig) {
    if (!URL.canParse(config.endpoint)) {
      throw new TypeError("Graph endpoint must be a valid URL");
    }
    if (
      !Number.isSafeInteger(config.maxStalenessMs) ||
      config.maxStalenessMs < 0
    ) {
      throw new TypeError("maxStalenessMs must be a non-negative safe integer");
    }
    this.fetch = config.fetch ?? globalThis.fetch;
  }

  async discover(query: DiscoveryQuery) {
    const nowMs = Date.parse(query.now);
    if (Number.isNaN(nowMs)) {
      throw new TypeError("discovery query now must be an ISO timestamp");
    }

    let response: Response;
    try {
      response = await this.fetch(this.config.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.config.accessToken
            ? { authorization: `Bearer ${this.config.accessToken}` }
            : {}),
        },
        body: JSON.stringify({
          query: providerQuery,
          variables: {
            capability: query.capability,
            inputType: query.inputType,
            outputType: query.outputType,
          },
        }),
      });
    } catch (cause) {
      throw new DiscoveryError(
        "DISCOVERY_UNAVAILABLE",
        "The Graph request failed",
        { cause },
      );
    }

    if (!response.ok) {
      throw new DiscoveryError(
        "DISCOVERY_UNAVAILABLE",
        `The Graph returned HTTP ${response.status}`,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (cause) {
      throw new DiscoveryError(
        "DISCOVERY_MALFORMED",
        "The Graph returned invalid JSON",
        { cause },
      );
    }

    const parsed = graphResponseSchema.safeParse(payload);
    if (!parsed.success || !parsed.data.data || parsed.data.errors?.length) {
      throw new DiscoveryError(
        "DISCOVERY_MALFORMED",
        "The Graph response did not match the provider registry contract",
        parsed.success ? undefined : { cause: parsed.error },
      );
    }

    const records = parsed.data.data.providerOffers;
    if (records.length === 0) {
      throw new DiscoveryError(
        "DISCOVERY_EMPTY",
        "The Graph returned no matching active providers",
      );
    }

    const newestUpdatedAtMs = Math.max(
      ...records.map(
        ({ updatedAt }) => safeInteger(updatedAt, "updatedAt") * 1000,
      ),
    );
    if (nowMs - newestUpdatedAtMs > this.config.maxStalenessMs) {
      throw new DiscoveryError(
        "DISCOVERY_STALE",
        "The Graph provider data is older than the configured freshness limit",
      );
    }

    return discoveryResultSchema.parse({
      providers: records.map(({ provider, ...offer }) => {
        const amountMinor = safeInteger(offer.amountMinor, "amountMinor");
        const expectedLatencyMs = safeInteger(
          offer.expectedLatencyMs,
          "expectedLatencyMs",
        );
        const quoteTtlSeconds = safeInteger(
          offer.quoteTtlSeconds,
          "quoteTtlSeconds",
        );
        return {
          provider: {
            id: provider.id,
            name: provider.name,
            capabilities: provider.capabilities,
            privacyClasses: provider.privacyClasses,
            settlementAccount: provider.settlementAccount,
          },
          offer: {
            id: offer.id,
            providerId: provider.id,
            capability: offer.capability,
            inputType: offer.inputType,
            outputType: offer.outputType,
            price: { currency: offer.currency, amountMinor },
            expectedLatencyMs,
          },
          quote: {
            id: `quo_${query.jobId}_${offer.id}`,
            jobId: query.jobId,
            offerId: offer.id,
            price: { currency: offer.currency, amountMinor },
            expiresAt: new Date(nowMs + quoteTtlSeconds * 1000).toISOString(),
          },
        };
      }),
      source: {
        kind: "the-graph",
        label: "provider-registry",
        deploymentId: this.config.deploymentId,
        network: this.config.network,
        endpoint: this.config.endpoint,
        blockNumber: parsed.data.data._meta?.block.number,
      },
      queriedAt: query.now,
    });
  }
}
