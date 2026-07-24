import type { FailureReasonCode } from "./lifecycle";
import {
  decisionSchema,
  type Decision,
  type Offer,
  type Policy,
  type Provider,
  type Quote,
  type Requirement,
} from "./schema";

export interface RoutingCandidate {
  provider: Provider;
  offer: Offer;
  quote: Quote;
}

export interface RoutingDecisionInput {
  decisionId: string;
  jobId: string;
  requirement: Requirement;
  policy: Policy;
  candidates: readonly RoutingCandidate[];
  evaluatedAt: string;
}

interface EvaluatedCandidate extends RoutingCandidate {
  reasonCodes: FailureReasonCode[];
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function evaluateCandidate(
  requirement: Requirement,
  policy: Policy,
  candidate: RoutingCandidate,
  evaluatedAtMs: number,
): EvaluatedCandidate {
  const { provider, offer, quote } = candidate;
  const reasons: FailureReasonCode[] = [];
  const capabilities = unique([
    requirement.capability,
    ...policy.requiredCapabilities,
  ]);

  if (
    !capabilities.every((capability) =>
      provider.capabilities.includes(capability),
    ) ||
    offer.capability !== requirement.capability ||
    offer.inputType !== requirement.inputType ||
    offer.outputType !== requirement.outputType
  ) {
    reasons.push("CAPABILITY_REQUIRED");
  }

  if (
    !policy.allowedPrivacyClasses.includes(requirement.privacyClass) ||
    !provider.privacyClasses.includes(requirement.privacyClass)
  ) {
    reasons.push(
      requirement.privacyClass === "confidential"
        ? "PRIVATE_COMPUTE_REQUIRED"
        : "PRIVACY_CLASS_NOT_ALLOWED",
    );
  }

  if (
    quote.price.currency !== policy.budget.currency ||
    quote.price.currency !== policy.maxTransaction.currency
  ) {
    reasons.push("PRICE_CURRENCY_MISMATCH");
  } else if (
    quote.price.amountMinor > policy.budget.amountMinor ||
    quote.price.amountMinor > policy.maxTransaction.amountMinor
  ) {
    reasons.push("BUDGET_EXCEEDED");
  }

  if (Date.parse(quote.expiresAt) <= evaluatedAtMs) {
    reasons.push("QUOTE_EXPIRED");
  }

  return { ...candidate, reasonCodes: unique(reasons) };
}

function compareEligible(
  left: EvaluatedCandidate,
  right: EvaluatedCandidate,
): number {
  return (
    left.quote.price.amountMinor - right.quote.price.amountMinor ||
    left.offer.expectedLatencyMs - right.offer.expectedLatencyMs ||
    left.provider.id.localeCompare(right.provider.id) ||
    left.offer.id.localeCompare(right.offer.id)
  );
}

export function makeRoutingDecision(input: RoutingDecisionInput): Decision {
  const evaluatedAtMs = Date.parse(input.evaluatedAt);
  if (Number.isNaN(evaluatedAtMs)) {
    throw new TypeError("evaluatedAt must be an ISO timestamp");
  }

  const evaluated = input.candidates.map((candidate) =>
    evaluateCandidate(
      input.requirement,
      input.policy,
      candidate,
      evaluatedAtMs,
    ),
  );
  const eligible = evaluated
    .filter((candidate) => candidate.reasonCodes.length === 0)
    .sort(compareEligible);
  const ranks = new Map(
    eligible.map((candidate, index) => [candidate.offer.id, index + 1]),
  );
  const selected = eligible[0];

  return decisionSchema.parse({
    id: input.decisionId,
    jobId: input.jobId,
    requirementId: input.requirement.id,
    policyId: input.policy.id,
    policyVersion: input.policy.version,
    selectedProviderId: selected?.provider.id,
    selectedOfferId: selected?.offer.id,
    considered: evaluated.map((candidate) => ({
      providerId: candidate.provider.id,
      offerId: candidate.offer.id,
      eligible: candidate.reasonCodes.length === 0,
      reasonCodes: candidate.reasonCodes,
      rank: ranks.get(candidate.offer.id),
    })),
    createdAt: input.evaluatedAt,
  });
}
