import { z } from "zod";

const identifierSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const exactIntegerSchema = z.string().regex(/^(0|[1-9]\d*)$/);
const positiveIntegerSchema = z.string().regex(/^[1-9]\d*$/);
const timestampSchema = z.string().datetime({ offset: true });

export const llmJobStates = [
  "accepted",
  "reserved",
  "executing",
  "validating",
  "settled",
  "delivered",
  "reconciliation_required",
  "failed",
] as const;

export const llmAttemptStates = [
  "pending",
  "started",
  "provider_accepted",
  "completed",
  "ambiguous",
  "failed",
] as const;

export const llmJobFailureCodes = [
  "INSTANCE_UNKNOWN",
  "INSTANCE_DISABLED",
  "CAPABILITY_INCOMPATIBLE",
  "PRIVACY_INCOMPATIBLE",
  "PRICE_STALE",
  "PROVIDER_UNCREDENTIALLED",
  "INSUFFICIENT_CREDIT",
  "PROVIDER_AUTHENTICATION",
  "PROVIDER_TIMEOUT",
  "PROVIDER_UNAVAILABLE",
  "OUTPUT_INVALID",
  "USAGE_MISSING",
  "USAGE_EXCEEDED",
  "COMPLETION_AMBIGUOUS",
  "SETTLEMENT_AMBIGUOUS",
] as const;

export const llmJobStateSchema = z.enum(llmJobStates);
export const llmAttemptStateSchema = z.enum(llmAttemptStates);
export const llmJobFailureCodeSchema = z.enum(llmJobFailureCodes);

export const llmPriceSnapshotSchema = z.strictObject({
  currency: z.literal("tinybar"),
  inputTinybarsPerMillionTokens: exactIntegerSchema,
  outputTinybarsPerMillionTokens: exactIntegerSchema,
  catalogSyncedAt: timestampSchema,
});

export const llmJobSchema = z.strictObject({
  id: identifierSchema,
  userId: z.string().uuid(),
  instanceId: positiveIntegerSchema,
  provider: z.enum(["scaleway", "0g"]),
  model: z.string().trim().min(1).max(300),
  capability: identifierSchema,
  privacy: z.enum(["public", "confidential"]),
  state: llmJobStateSchema,
  maximumInputTokens: z.number().int().positive(),
  maximumOutputTokens: z.number().int().positive(),
  spendCeilingTinybars: positiveIntegerSchema,
  idempotencyKey: identifierSchema,
  failureCode: llmJobFailureCodeSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const llmJobAttemptSchema = z.strictObject({
  id: identifierSchema,
  jobId: identifierSchema,
  attemptNumber: z.number().int().positive(),
  state: llmAttemptStateSchema,
  providerRequestId: z.string().trim().min(1).max(300).nullable(),
  idempotencyKey: identifierSchema,
  failureCode: llmJobFailureCodeSchema.nullable(),
  startedAt: timestampSchema.nullable(),
  completedAt: timestampSchema.nullable(),
});

export const llmJobUsageSchema = z
  .strictObject({
    jobId: identifierSchema,
    attemptId: identifierSchema,
    promptTokens: z.number().int().nonnegative(),
    completionTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
    reportedByProvider: z.literal(true),
  })
  .superRefine((usage, context) => {
    if (usage.totalTokens !== usage.promptTokens + usage.completionTokens) {
      context.addIssue({
        code: "custom",
        message: "Total tokens must equal prompt plus completion tokens",
        path: ["totalTokens"],
      });
    }
  });

export const llmJobReservationSchema = z.strictObject({
  id: identifierSchema,
  jobId: identifierSchema,
  amountTinybars: positiveIntegerSchema,
  priceSnapshot: llmPriceSnapshotSchema,
  status: z.enum([
    "reserved",
    "settled",
    "released",
    "reconciliation_required",
  ]),
  idempotencyKey: identifierSchema,
});

export const llmJobChargeSchema = z.strictObject({
  id: identifierSchema,
  jobId: identifierSchema,
  reservationId: identifierSchema,
  amountTinybars: exactIntegerSchema,
  idempotencyKey: identifierSchema,
  chargedAt: timestampSchema,
});

export const llmJobRefundSchema = z.strictObject({
  id: identifierSchema,
  jobId: identifierSchema,
  reservationId: identifierSchema,
  amountTinybars: exactIntegerSchema,
  idempotencyKey: identifierSchema,
  refundedAt: timestampSchema,
});

export const llmJobResultSchema = z.strictObject({
  jobId: identifierSchema,
  output: z.string().min(1),
  contentType: z.literal("text/plain"),
  deliveredAt: timestampSchema.nullable(),
});

export const llmProviderEvidenceSchema = z.strictObject({
  jobId: identifierSchema,
  attemptId: identifierSchema,
  provider: z.enum(["scaleway", "0g"]),
  model: z.string().trim().min(1).max(300),
  executionId: z.string().trim().min(1).max(300),
  verificationLabel: z.string().trim().min(1).max(500),
  providerAddress: z.string().trim().min(1).max(300).nullable(),
  trustMode: z.enum(["standard", "private"]).nullable(),
});

const allowedTransitions: Readonly<
  Record<
    (typeof llmJobStates)[number],
    readonly (typeof llmJobStates)[number][]
  >
> = {
  accepted: ["reserved", "failed"],
  reserved: ["executing", "failed"],
  executing: ["validating", "reconciliation_required", "failed"],
  validating: ["settled", "reconciliation_required", "failed"],
  settled: ["delivered", "reconciliation_required"],
  delivered: [],
  reconciliation_required: [],
  failed: [],
};

export function canTransitionLlmJob(
  from: z.infer<typeof llmJobStateSchema>,
  to: z.infer<typeof llmJobStateSchema>,
) {
  return allowedTransitions[from].includes(to);
}

export type LlmJob = z.infer<typeof llmJobSchema>;
