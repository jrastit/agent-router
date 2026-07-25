import type { DiscoveryAdapter, DiscoveryQuery } from "./adapter";
import { discoveryResultSchema, type DiscoveredProvider } from "./schema";

const FIXTURE_QUOTE_LIFETIME_MS = 5 * 60 * 1000;

const records = [
  {
    provider: {
      id: "prv_scaleway_standard",
      name: "Scaleway Generative APIs",
      capabilities: ["summarize"],
      privacyClasses: ["public"],
      settlementAccount: "0.0.6101001",
    },
    offer: {
      id: "off_scaleway_summarize_v1",
      providerId: "prv_scaleway_standard",
      capability: "summarize",
      inputType: "text",
      outputType: "text",
      price: { currency: "USD", amountMinor: 3 },
      expectedLatencyMs: 1800,
    },
  },
  {
    provider: {
      id: "prv_private_compute",
      name: "Private Compute Provider",
      capabilities: ["summarize"],
      privacyClasses: ["public", "confidential"],
      settlementAccount: "0.0.6101002",
    },
    offer: {
      id: "off_private_summarize_v1",
      providerId: "prv_private_compute",
      capability: "summarize",
      inputType: "text",
      outputType: "text",
      price: { currency: "USD", amountMinor: 7 },
      expectedLatencyMs: 2600,
    },
  },
] as const;

export class FixtureDiscoveryAdapter implements DiscoveryAdapter {
  async discover(query: DiscoveryQuery) {
    const nowMs = Date.parse(query.now);
    if (Number.isNaN(nowMs)) {
      throw new TypeError("discovery query now must be an ISO timestamp");
    }

    const providers: DiscoveredProvider[] = records
      .filter(
        ({ offer }) =>
          offer.capability === query.capability &&
          offer.inputType === query.inputType &&
          offer.outputType === query.outputType,
      )
      .map(({ provider, offer }) => ({
        provider: {
          ...provider,
          capabilities: [...provider.capabilities],
          privacyClasses: [...provider.privacyClasses],
        },
        offer: { ...offer, price: { ...offer.price } },
        quote: {
          id: `quo_${query.jobId}_${offer.id}`,
          jobId: query.jobId,
          offerId: offer.id,
          price: { ...offer.price },
          expiresAt: new Date(nowMs + FIXTURE_QUOTE_LIFETIME_MS).toISOString(),
        },
      }));

    return discoveryResultSchema.parse({
      providers,
      source: { kind: "fixture", label: "deterministic-demo-v1" },
      queriedAt: query.now,
    });
  }
}
