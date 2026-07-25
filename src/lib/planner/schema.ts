import { z } from "zod";

export const extractedRequirementSchema = z.strictObject({
  capability: z.string().min(1),
  privacyClass: z.enum(["public", "confidential"]),
  inputType: z.string().min(1),
  outputType: z.string().min(1),
});

export const candidateAssessmentSchema = z.strictObject({
  offerId: z.string().min(1),
  score: z.number().int().min(0).max(100),
  rationale: z.string().min(1).max(500),
});

export const providerEvaluationsSchema = z.strictObject({
  assessments: z.array(candidateAssessmentSchema).min(1),
});

export type ExtractedRequirement = z.infer<typeof extractedRequirementSchema>;
export type CandidateAssessment = z.infer<typeof candidateAssessmentSchema>;
export type ProviderEvaluations = z.infer<typeof providerEvaluationsSchema>;
