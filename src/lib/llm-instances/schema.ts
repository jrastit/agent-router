import { z } from "zod";

const identifier = z.string().regex(/^[a-z0-9][a-z0-9._-]*$/);

export const llmInstanceSchema = z.strictObject({
  id: identifier,
  name: z.string().trim().min(1).max(120),
  provider: identifier,
  model: z.string().trim().min(1).max(200),
  baseUrl: z.string().url(),
  providerAddress: z.string().trim().min(1).max(200).optional(),
  capabilities: z.array(identifier).min(1),
  privacy: z.enum(["public", "confidential"]),
  enabled: z.boolean(),
  expectedLatencyMs: z.number().int().nonnegative(),
  inputPriceEurPerMillionTokens: z.string().optional(),
  outputPriceEurPerMillionTokens: z.string().optional(),
  notes: z.string().trim().max(500).optional(),
});

export const llmInstanceCatalogSchema = z
  .strictObject({
    version: z.literal(1),
    instances: z.array(llmInstanceSchema).max(100),
  })
  .superRefine(({ instances }, context) => {
    const ids = new Set<string>();
    for (const [index, instance] of instances.entries()) {
      if (ids.has(instance.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate instance id: ${instance.id}`,
          path: ["instances", index, "id"],
        });
      }
      ids.add(instance.id);
    }
  });

export type LlmInstanceCatalog = z.infer<typeof llmInstanceCatalogSchema>;
