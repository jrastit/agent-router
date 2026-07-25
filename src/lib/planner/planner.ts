import type { Policy, Requirement } from "../domain/schema";
import { makeRoutingDecision, type RoutingCandidate } from "../domain/policy";
import type { StructuredGenerator } from "./generate";
import {
  extractedRequirementSchema,
  providerEvaluationsSchema,
  type CandidateAssessment,
  type ExtractedRequirement,
} from "./schema";

export interface PlannerInput {
  jobId: string;
  decisionId: string;
  requirementId: string;
  objective: string;
  fallbackRequirement: ExtractedRequirement;
  policy: Policy;
  candidates: readonly RoutingCandidate[];
  evaluatedAt: string;
  timeoutMs: number;
}

export interface PlannerResult {
  requirement: Requirement;
  decision: ReturnType<typeof makeRoutingDecision>;
  evidence: {
    requirementSource: "model" | "fallback";
    evaluationSource: "model" | "fallback";
    fallbackReasons: string[];
  };
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

function fallbackAssessments(
  candidates: readonly RoutingCandidate[],
): CandidateAssessment[] {
  return candidates.map(({ offer, quote }) => ({
    offerId: offer.id,
    score: Math.max(
      0,
      100 -
        Math.min(70, quote.price.amountMinor) -
        Math.min(30, Math.floor(offer.expectedLatencyMs / 100)),
    ),
    rationale:
      "Deterministic fallback score derived from integer price and expected latency.",
  }));
}

function validateAssessments(
  assessments: CandidateAssessment[],
  candidates: readonly RoutingCandidate[],
): CandidateAssessment[] {
  const expected = new Set(candidates.map(({ offer }) => offer.id));
  const actual = new Set(assessments.map(({ offerId }) => offerId));

  if (
    assessments.length !== candidates.length ||
    actual.size !== assessments.length ||
    expected.size !== actual.size ||
    [...expected].some((offerId) => !actual.has(offerId))
  ) {
    throw new TypeError(
      "Model evaluations must cover every candidate exactly once",
    );
  }

  return assessments;
}

export async function planRoute(
  input: PlannerInput,
  generate: StructuredGenerator,
): Promise<PlannerResult> {
  const fallbackReasons: string[] = [];
  let requirementFields: ExtractedRequirement;
  let requirementSource: "model" | "fallback" = "model";

  try {
    requirementFields = await generate({
      name: "execution_requirement",
      schema: extractedRequirementSchema,
      timeoutMs: input.timeoutMs,
      prompt: [
        "Extract one execution requirement from the objective.",
        "Use confidential privacy only when the input or output requires private handling.",
        `Objective: ${input.objective}`,
      ].join("\n"),
    });
  } catch (error) {
    requirementFields = extractedRequirementSchema.parse(
      input.fallbackRequirement,
    );
    requirementSource = "fallback";
    fallbackReasons.push(`requirement:${errorName(error)}`);
  }

  const requirement: Requirement = {
    id: input.requirementId,
    ...requirementFields,
  };

  let assessments: CandidateAssessment[];
  let evaluationSource: "model" | "fallback" = "model";

  try {
    const generated = await generate({
      name: "provider_evaluations",
      schema: providerEvaluationsSchema,
      timeoutMs: input.timeoutMs,
      prompt: [
        "Score every candidate from 0 to 100 and provide a concise rationale.",
        "Do not decide eligibility or select a provider; policy code does that.",
        `Requirement: ${JSON.stringify(requirement)}`,
        `Candidates: ${JSON.stringify(
          input.candidates.map(({ provider, offer, quote }) => ({
            providerId: provider.id,
            offerId: offer.id,
            capabilities: provider.capabilities,
            privacyClasses: provider.privacyClasses,
            price: quote.price,
            expectedLatencyMs: offer.expectedLatencyMs,
          })),
        )}`,
      ].join("\n"),
    });
    assessments = validateAssessments(
      providerEvaluationsSchema.parse(generated).assessments,
      input.candidates,
    );
  } catch (error) {
    assessments = fallbackAssessments(input.candidates);
    evaluationSource = "fallback";
    fallbackReasons.push(`evaluation:${errorName(error)}`);
  }

  const assessmentMap = new Map(
    assessments.map((assessment) => [assessment.offerId, assessment]),
  );
  const decision = makeRoutingDecision({
    decisionId: input.decisionId,
    jobId: input.jobId,
    requirement,
    policy: input.policy,
    candidates: input.candidates,
    assessments: assessmentMap,
    evaluatedAt: input.evaluatedAt,
  });

  return {
    requirement,
    decision,
    evidence: {
      requirementSource,
      evaluationSource,
      fallbackReasons,
    },
  };
}
