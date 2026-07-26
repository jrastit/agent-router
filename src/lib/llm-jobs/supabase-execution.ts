import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  executeDurableLlmJob,
  type ExecutableLlmJob,
  type LlmExecutionDependencies,
} from "./execution";
import type {
  LlmProviderAdapter,
  LlmProviderExecutionResult,
} from "./providers";

const userSchema = z.object({ id: z.string().uuid() });
const jobRowSchema = z.object({
  id: z.string(),
  state: z.enum([
    "accepted",
    "reserved",
    "executing",
    "validating",
    "delivered",
    "reconciliation_required",
    "failed",
  ]),
  instance_id: z.union([z.string(), z.number()]).transform(String),
  provider: z.enum(["scaleway", "0g"]),
  model: z.string(),
  privacy: z.enum(["public", "confidential"]),
  maximum_input_tokens: z.number().int().positive(),
  maximum_output_tokens: z.number().int().positive(),
});
const inputRowSchema = z.object({ prompt: z.string().min(1) });
const attemptRowSchema = z.object({ id: z.string() });
const instanceRowSchema = z.object({
  source_metadata: z
    .object({
      providers: z
        .array(
          z.object({
            address: z.string(),
            trustMode: z.string().nullable().optional(),
          }),
        )
        .optional(),
    })
    .passthrough(),
});

type ZgProvider = Readonly<{
  address: string;
  trustMode?: string | null;
}>;

export function selectZgProvider(
  privacy: "public" | "confidential",
  providers: ZgProvider[] | undefined,
) {
  const supported = providers?.filter(
    (
      provider,
    ): provider is ZgProvider & { trustMode: "private" | "verified" } =>
      provider.trustMode === "private" || provider.trustMode === "verified",
  );
  if (privacy === "confidential") {
    return supported?.find((provider) => provider.trustMode === "private");
  }
  return (
    supported?.find((provider) => provider.trustMode === "private") ??
    supported?.find((provider) => provider.trustMode === "verified")
  );
}

type SupabaseConfig = Readonly<{
  supabaseUrl: string;
  serviceRoleKey: string;
  userAccessToken: string;
  userId: string;
  scaleway: LlmProviderAdapter;
  zg: LlmProviderAdapter;
  fetcher?: typeof fetch;
  id?: () => string;
}>;

function headers(config: SupabaseConfig, asUser = false) {
  return {
    apikey: config.serviceRoleKey,
    authorization: `Bearer ${
      asUser ? config.userAccessToken : config.serviceRoleKey
    }`,
    "content-type": "application/json",
  };
}

async function parseResponse(response: Response) {
  if (!response.ok) {
    throw new Error(`Supabase LLM operation failed (${response.status})`);
  }
  if (response.status === 204) return null;
  return response.json() as Promise<unknown>;
}

export function createSupabaseLlmExecutionDependencies(
  config: SupabaseConfig,
): LlmExecutionDependencies {
  const fetcher = config.fetcher ?? fetch;
  const baseUrl = config.supabaseUrl.replace(/\/$/, "");
  const rpc = async (name: string, body: Record<string, unknown>) =>
    parseResponse(
      await fetcher(`${baseUrl}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: headers(config, true),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      }),
    );
  const selectOne = async (path: string, schema: z.ZodType) => {
    const rows = z.array(schema).parse(
      await parseResponse(
        await fetcher(`${baseUrl}/rest/v1/${path}`, {
          headers: headers(config),
          signal: AbortSignal.timeout(15_000),
        }),
      ),
    );
    if (!rows[0]) throw new Error("Owned LLM job context is unavailable");
    return rows[0];
  };

  return {
    async load(jobId) {
      const job = jobRowSchema.parse(
        await selectOne(
          `llm_jobs?id=eq.${encodeURIComponent(jobId)}&user_id=eq.${encodeURIComponent(config.userId)}&select=id,state,instance_id,provider,model,privacy,maximum_input_tokens,maximum_output_tokens`,
          jobRowSchema,
        ),
      );
      const input = inputRowSchema.parse(
        await selectOne(
          `llm_job_inputs?job_id=eq.${encodeURIComponent(jobId)}&user_id=eq.${encodeURIComponent(config.userId)}&select=prompt`,
          inputRowSchema,
        ),
      );
      const instance = instanceRowSchema.parse(
        await selectOne(
          `llm_instances?id=eq.${encodeURIComponent(job.instance_id)}&select=source_metadata`,
          instanceRowSchema,
        ),
      );
      let attemptId: string | undefined;
      if (job.state === "executing" || job.state === "validating") {
        const attempt = attemptRowSchema.parse(
          await selectOne(
            `llm_job_attempts?job_id=eq.${encodeURIComponent(jobId)}&state=in.(started,provider_accepted)&order=attempt_number.desc&limit=1&select=id`,
            attemptRowSchema,
          ),
        );
        attemptId = attempt.id;
      }
      const zgProvider =
        job.provider === "0g"
          ? selectZgProvider(job.privacy, instance.source_metadata.providers)
          : undefined;
      return {
        id: job.id,
        state: job.state,
        provider: job.provider,
        model: job.model,
        privacy: job.privacy,
        prompt: input.prompt,
        maximumInputTokens: job.maximum_input_tokens,
        maximumOutputTokens: job.maximum_output_tokens,
        attemptId,
        providerAddress: zgProvider?.address,
        providerTrustMode: zgProvider?.trustMode,
      };
    },
    async reserve(jobId) {
      await rpc("reserve_llm_job_credit", {
        target_job_id: jobId,
        target_reservation_id: `llm-reservation:${config.id?.() ?? randomUUID()}`,
        request_key: `reserve:${jobId}`,
      });
    },
    async startAttempt(jobId) {
      await rpc("start_llm_job_attempt", {
        target_job_id: jobId,
        target_attempt_id: `llm-attempt:${config.id?.() ?? randomUUID()}`,
        request_key: `attempt:${jobId}`,
      });
    },
    scaleway: config.scaleway,
    zg: config.zg,
    async settle(job: ExecutableLlmJob, result: LlmProviderExecutionResult) {
      await rpc("settle_llm_job_credit", {
        target_job_id: job.id,
        target_attempt_id: job.attemptId,
        prompt_token_count: result.usage.promptTokens,
        completion_token_count: result.usage.completionTokens,
        provider_execution_id: result.evidence.executionId,
        returned_model: result.evidence.model,
        private_output: result.output,
        verification_label: result.evidence.verificationLabel,
        provider_address: result.evidence.providerAddress,
        trust_mode: result.evidence.trustMode,
        request_key: `settle:${job.id}`,
      });
    },
    async reconcile(job, failure) {
      await rpc("reconcile_ambiguous_llm_job", {
        target_job_id: job.id,
        target_attempt_id: job.attemptId,
        failure,
        request_key: `reconcile:${job.id}`,
      });
    },
    async failAndRelease(job, failure) {
      await rpc("fail_llm_job_and_release_credit", {
        target_job_id: job.id,
        target_attempt_id: job.attemptId,
        failure,
        request_key: `release:${job.id}`,
      });
    },
  };
}

function bearerToken(request: Request) {
  return request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/)?.[1];
}

export function createLlmJobExecutionHandler(input: {
  supabaseUrl?: string;
  serviceRoleKey?: string;
  createDependencies: (
    userId: string,
    token: string,
  ) => LlmExecutionDependencies;
  fetcher?: typeof fetch;
}) {
  return async function POST(
    request: Request,
    context: { params: Promise<{ jobId: string }> },
  ) {
    const token = bearerToken(request);
    if (!token) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }
    if (!input.supabaseUrl || !input.serviceRoleKey) {
      return Response.json(
        { error: "LLM execution service unavailable" },
        { status: 503 },
      );
    }
    const { jobId } = await context.params;
    if (!jobId || jobId.length > 200) {
      return Response.json({ error: "Invalid LLM job" }, { status: 400 });
    }

    try {
      const fetcher = input.fetcher ?? fetch;
      const user = userSchema.parse(
        await parseResponse(
          await fetcher(
            `${input.supabaseUrl.replace(/\/$/, "")}/auth/v1/user`,
            {
              headers: {
                apikey: input.serviceRoleKey,
                authorization: `Bearer ${token}`,
              },
              signal: AbortSignal.timeout(10_000),
            },
          ),
        ),
      );
      const outcome = await executeDurableLlmJob(
        input.createDependencies(user.id, token),
        jobId,
      );
      return Response.json(outcome, {
        headers: { "cache-control": "no-store" },
      });
    } catch {
      return Response.json({ error: "LLM execution failed" }, { status: 409 });
    }
  };
}
