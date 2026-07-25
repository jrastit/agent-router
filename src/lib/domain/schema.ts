import { z } from "zod";

import {
  deliveryStateSchema,
  eventTypeSchema,
  failureReasonCodeSchema,
  jobStateSchema,
  paymentStateSchema,
} from "./lifecycle";

const id = z.string().min(1);
const timestamp = z.string().datetime({ offset: true });
export const fiatMoneySchema = z.strictObject({
  currency: z.string().regex(/^[A-Z]{3}$/),
  amountMinor: z.number().int().safe().nonnegative(),
});

export const hbarAmountSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)(\.\d{1,8})?$/, "must be an exact HBAR decimal");

export const requirementSchema = z.strictObject({
  id,
  capability: z.string().min(1),
  privacyClass: z.enum(["public", "confidential"]),
  inputType: z.string().min(1),
  outputType: z.string().min(1),
});

export const policySchema = z.strictObject({
  id,
  version: z.number().int().positive(),
  budget: fiatMoneySchema,
  maxTransaction: fiatMoneySchema,
  allowedPrivacyClasses: z.array(z.enum(["public", "confidential"])).min(1),
  requiredCapabilities: z.array(z.string().min(1)),
});

export const providerSchema = z.strictObject({
  id,
  name: z.string().min(1),
  capabilities: z.array(z.string().min(1)),
  privacyClasses: z.array(z.enum(["public", "confidential"])).min(1),
  settlementAccount: z.string().min(1),
});

export const offerSchema = z.strictObject({
  id,
  providerId: id,
  capability: z.string().min(1),
  inputType: z.string().min(1),
  outputType: z.string().min(1),
  price: fiatMoneySchema,
  expectedLatencyMs: z.number().int().nonnegative(),
});

export const quoteSchema = z.strictObject({
  id,
  jobId: id,
  offerId: id,
  price: fiatMoneySchema,
  expiresAt: timestamp,
});

export const consideredProviderSchema = z.strictObject({
  providerId: id,
  offerId: id,
  eligible: z.boolean(),
  reasonCodes: z.array(z.string().min(1)),
  modelScore: z.number().int().min(0).max(100),
  rationale: z.string().min(1),
  rank: z.number().int().positive().optional(),
});

export const decisionSchema = z.strictObject({
  id,
  jobId: id,
  requirementId: id,
  policyId: id,
  policyVersion: z.number().int().positive(),
  selectedProviderId: id.optional(),
  selectedOfferId: id.optional(),
  considered: z.array(consideredProviderSchema).min(1),
  createdAt: timestamp,
});

export const challengeSchema = z.strictObject({
  id,
  quoteId: id,
  payerAccount: z.string().min(1),
  recipientAccount: z.string().min(1),
  network: z.string().min(1),
  asset: z.string().min(1),
  amount: hbarAmountSchema,
  memo: z.string().min(1),
  expiresAt: timestamp,
});

export const paymentSchema = z.strictObject({
  id,
  challengeId: id,
  transactionId: z.string().min(1),
  status: paymentStateSchema,
  amount: hbarAmountSchema,
  createdAt: timestamp,
});

export const deliverySchema = z.strictObject({
  id,
  jobId: id,
  providerId: id,
  status: deliveryStateSchema,
  artifactReference: z.string().min(1).optional(),
  completedAt: timestamp.optional(),
});

export const receiptSchema = z.strictObject({
  id,
  jobId: id,
  decisionId: id,
  paymentId: id,
  deliveryId: id,
  total: fiatMoneySchema,
  createdAt: timestamp,
});

export const eventSchema = z.strictObject({
  id,
  jobId: id,
  sequence: z.number().int().nonnegative(),
  type: eventTypeSchema,
  occurredAt: timestamp,
  payload: z.record(z.string(), z.unknown()),
});

export const jobSchema = z.strictObject({
  id,
  requirementId: id,
  policyId: id,
  status: jobStateSchema,
  failureReason: failureReasonCodeSchema.optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export type Requirement = z.infer<typeof requirementSchema>;
export type FiatMoney = z.infer<typeof fiatMoneySchema>;
export type HbarAmount = z.infer<typeof hbarAmountSchema>;
export type Policy = z.infer<typeof policySchema>;
export type Provider = z.infer<typeof providerSchema>;
export type Offer = z.infer<typeof offerSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type ConsideredProvider = z.infer<typeof consideredProviderSchema>;
export type Decision = z.infer<typeof decisionSchema>;
export type Challenge = z.infer<typeof challengeSchema>;
export type Payment = z.infer<typeof paymentSchema>;
export type Delivery = z.infer<typeof deliverySchema>;
export type Receipt = z.infer<typeof receiptSchema>;
export type Event = z.infer<typeof eventSchema>;
export type Job = z.infer<typeof jobSchema>;
