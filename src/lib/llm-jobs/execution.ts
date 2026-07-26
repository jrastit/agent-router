import type {
  LlmProviderAdapter,
  LlmProviderExecutionResult,
} from "./providers";
import { LlmProviderError } from "./providers";

export type ExecutableLlmJob = Readonly<{
  id: string;
  state:
    | "accepted"
    | "reserved"
    | "executing"
    | "validating"
    | "delivered"
    | "reconciliation_required"
    | "failed";
  provider: "scaleway" | "0g";
  model: string;
  privacy: "public" | "confidential";
  prompt: string;
  maximumInputTokens: number;
  maximumOutputTokens: number;
  attemptId?: string;
  providerAddress?: string;
  providerTrustMode?: "private" | "verified";
}>;

export type LlmExecutionDependencies = Readonly<{
  load(jobId: string): Promise<ExecutableLlmJob>;
  reserve(jobId: string): Promise<void>;
  startAttempt(jobId: string): Promise<void>;
  scaleway: LlmProviderAdapter;
  zg: LlmProviderAdapter;
  settle(
    job: ExecutableLlmJob,
    result: LlmProviderExecutionResult,
  ): Promise<void>;
  reconcile(
    job: ExecutableLlmJob,
    failure: "COMPLETION_AMBIGUOUS" | "SETTLEMENT_AMBIGUOUS",
  ): Promise<void>;
  failAndRelease(
    job: ExecutableLlmJob,
    failure: "PROVIDER_AUTHENTICATION",
  ): Promise<void>;
}>;

export type LlmExecutionOutcome =
  | Readonly<{ state: "delivered"; jobId: string }>
  | Readonly<{
      state: "executing" | "reconciliation_required" | "failed";
      jobId: string;
    }>;

export async function executeDurableLlmJob(
  dependencies: LlmExecutionDependencies,
  jobId: string,
): Promise<LlmExecutionOutcome> {
  let job = await dependencies.load(jobId);
  if (
    job.state === "delivered" ||
    job.state === "reconciliation_required" ||
    job.state === "failed"
  ) {
    return { state: job.state, jobId };
  }
  if (job.state === "executing" || job.state === "validating") {
    return { state: "executing", jobId };
  }

  if (job.state === "accepted") {
    await dependencies.reserve(jobId);
    job = await dependencies.load(jobId);
  }
  if (job.state !== "reserved") {
    throw new Error(`LLM job reached unexpected state ${job.state}`);
  }

  await dependencies.startAttempt(jobId);
  job = await dependencies.load(jobId);
  if (job.state !== "executing" || !job.attemptId) {
    throw new Error("LLM attempt did not enter executing state");
  }

  const adapter =
    job.provider === "scaleway" ? dependencies.scaleway : dependencies.zg;
  try {
    const result = await adapter.execute({
      model: job.model,
      prompt: job.prompt,
      maximumInputTokens: job.maximumInputTokens,
      maximumOutputTokens: job.maximumOutputTokens,
      idempotencyKey: `llm-attempt:${job.attemptId}`,
      providerAddress: job.providerAddress,
      providerTrustMode: job.providerTrustMode,
    });
    try {
      await dependencies.settle(job, result);
      return { state: "delivered", jobId };
    } catch {
      await dependencies.reconcile(job, "SETTLEMENT_AMBIGUOUS");
      return { state: "reconciliation_required", jobId };
    }
  } catch (error) {
    if (
      error instanceof LlmProviderError &&
      error.code === "PROVIDER_AUTHENTICATION"
    ) {
      await dependencies.failAndRelease(job, "PROVIDER_AUTHENTICATION");
      return { state: "failed", jobId };
    }
    await dependencies.reconcile(job, "COMPLETION_AMBIGUOUS");
    return { state: "reconciliation_required", jobId };
  }
}
