import { z } from "zod";

export const jobStates = [
  "created",
  "requirements_ready",
  "providers_discovered",
  "quotes_evaluated",
  "provider_selected",
  "execution_requested",
  "payment_required",
  "payment_submitted",
  "payment_confirmed_mirror_pending",
  "payment_verified",
  "execution_completed",
  "receipt_recorded",
  "failed",
] as const;

export const paymentStates = [
  "required",
  "submitted",
  "consensus_confirmed",
  "mirror_verified",
  "reconciliation_required",
  "failed",
] as const;

export const deliveryStates = [
  "requested",
  "processing",
  "completed",
  "failed",
] as const;

export const failureReasonCodes = [
  "BUDGET_EXCEEDED",
  "CAPABILITY_REQUIRED",
  "PRICE_CURRENCY_MISMATCH",
  "PRIVACY_CLASS_NOT_ALLOWED",
  "PRIVATE_COMPUTE_REQUIRED",
  "QUOTE_EXPIRED",
  "NO_ELIGIBLE_PROVIDER",
  "PAYMENT_CHALLENGE_EXPIRED",
  "PAYMENT_CHALLENGE_MISMATCH",
  "PAYMENT_PROOF_REPLAYED",
  "PAYMENT_AMBIGUOUS",
  "MIRROR_VERIFICATION_TIMEOUT",
  "PROVIDER_TIMEOUT",
  "INVALID_DELIVERY",
] as const;

export const eventTypes = [
  "job.created",
  "requirements.ready",
  "providers.discovered",
  "quotes.evaluated",
  "provider.selected",
  "execution.requested",
  "payment.required",
  "payment.submitted",
  "payment.consensus_confirmed",
  "payment.mirror_verified",
  "execution.completed",
  "receipt.recorded",
  "job.failed",
] as const;

export const jobStateSchema = z.enum(jobStates);
export const paymentStateSchema = z.enum(paymentStates);
export const deliveryStateSchema = z.enum(deliveryStates);
export const failureReasonCodeSchema = z.enum(failureReasonCodes);
export const eventTypeSchema = z.enum(eventTypes);

export type JobState = z.infer<typeof jobStateSchema>;
export type PaymentState = z.infer<typeof paymentStateSchema>;
export type DeliveryState = z.infer<typeof deliveryStateSchema>;
export type FailureReasonCode = z.infer<typeof failureReasonCodeSchema>;
export type EventType = z.infer<typeof eventTypeSchema>;
