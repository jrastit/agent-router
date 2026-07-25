import { z } from "zod";

import { offerSchema, providerSchema, quoteSchema } from "../domain/schema";

const timestamp = z.string().datetime({ offset: true });

export const discoverySourceSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("fixture"),
    label: z.string().min(1),
  }),
  z.strictObject({
    kind: z.literal("the-graph"),
    label: z.string().min(1),
    deploymentId: z.string().min(1),
    network: z.string().min(1),
    endpoint: z.string().url(),
    blockNumber: z.number().int().nonnegative().optional(),
  }),
]);

export const discoveredProviderSchema = z.strictObject({
  provider: providerSchema,
  offer: offerSchema,
  quote: quoteSchema,
});

export const discoveryResultSchema = z.strictObject({
  providers: z.array(discoveredProviderSchema),
  source: discoverySourceSchema,
  queriedAt: timestamp,
});

export type DiscoverySource = z.infer<typeof discoverySourceSchema>;
export type DiscoveredProvider = z.infer<typeof discoveredProviderSchema>;
export type DiscoveryResult = z.infer<typeof discoveryResultSchema>;
