import { randomUUID } from "node:crypto";

import { z } from "zod";

import { llmJobFailureCodeSchema } from "./schema";

const exactPositiveInteger = z
  .string()
  .regex(/^[1-9]\d*$/)
  .refine((value) => BigInt(value) <= BigInt("9223372036854775807"));
const idempotencyKeySchema = z.string().min(8).max(200);

export const llmJobSubmissionSchema = z.strictObject({
  instanceId: exactPositiveInteger,
  prompt: z.string().trim().min(1).max(100_000),
  capability: z.string().regex(/^[a-z0-9][a-z0-9._-]*$/),
  privacy: z.enum(["public", "confidential"]),
  maximumInputTokens: z.number().int().positive().max(1_000_000),
  maximumOutputTokens: z.number().int().positive().max(1_000_000),
  spendCeilingTinybars: exactPositiveInteger,
});

const userSchema = z.object({ id: z.string().uuid() });
const instanceSchema = z.strictObject({
  id: z.union([z.string(), z.number()]).transform(String),
  provider: z.enum(["scaleway", "0g"]),
  model_id: z.string().min(1).max(300),
  base_url: z.string().url(),
  capabilities: z.array(z.string()),
  privacy: z.enum(["public", "confidential"]),
  enabled: z.boolean(),
  input_price_tinybar_per_million: z
    .union([z.string(), z.number()])
    .transform(String)
    .nullable(),
  output_price_tinybar_per_million: z
    .union([z.string(), z.number()])
    .transform(String)
    .nullable(),
  price_synced_at: z.string().datetime({ offset: true }).nullable(),
  source_metadata: z.record(z.string(), z.unknown()),
});

type LlmJobSubmission = z.infer<typeof llmJobSubmissionSchema>;
type Instance = z.infer<typeof instanceSchema>;
type FailureCode = z.infer<typeof llmJobFailureCodeSchema>;

export class LlmJobSubmissionError extends Error {
  constructor(
    readonly code: FailureCode | "AUTHENTICATION_REQUIRED" | "INVALID_REQUEST",
    readonly status: number,
  ) {
    super(code);
    this.name = "LlmJobSubmissionError";
  }
}

function bearerToken(request: Request) {
  return request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/)?.[1];
}

function credentialFor(
  provider: Instance["provider"],
  environment: Readonly<Record<string, string | undefined>>,
) {
  return provider === "scaleway"
    ? environment.SCALEWAY_GENAI_API_KEY
    : environment.G_API_KEY_PRIVATE;
}

function eligibilityFailure(input: {
  instance: Instance;
  request: LlmJobSubmission;
  now: Date;
  maximumPriceAgeMs: number;
  environment: Readonly<Record<string, string | undefined>>;
}): FailureCode | undefined {
  if (!input.instance.enabled) return "INSTANCE_DISABLED";
  if (!input.instance.capabilities.includes(input.request.capability)) {
    return "CAPABILITY_INCOMPATIBLE";
  }
  if (
    input.request.privacy === "confidential" &&
    input.instance.privacy !== "confidential"
  ) {
    return "PRIVACY_INCOMPATIBLE";
  }
  if (
    input.instance.input_price_tinybar_per_million === null ||
    input.instance.output_price_tinybar_per_million === null ||
    input.instance.price_synced_at === null ||
    input.now.getTime() - new Date(input.instance.price_synced_at).getTime() >
      input.maximumPriceAgeMs
  ) {
    return "PRICE_STALE";
  }
  if (!credentialFor(input.instance.provider, input.environment)) {
    return "PROVIDER_UNCREDENTIALLED";
  }
  return undefined;
}

async function jsonOrThrow(response: Response) {
  if (!response.ok) {
    throw new Error(`Supabase request failed (${response.status})`);
  }
  return response.json() as Promise<unknown>;
}

export function createLlmJobSubmissionHandler(input: {
  supabaseUrl?: string;
  serviceRoleKey?: string;
  environment?: Readonly<Record<string, string | undefined>>;
  maximumPriceAgeMs?: number;
  now?: () => Date;
  id?: () => string;
  fetcher?: typeof fetch;
}) {
  return async function POST(request: Request) {
    const token = bearerToken(request);
    if (!token) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }
    if (!input.supabaseUrl || !input.serviceRoleKey) {
      return Response.json(
        { error: "LLM job service unavailable" },
        { status: 503 },
      );
    }

    const parsedRequest = llmJobSubmissionSchema.safeParse(
      await request.json().catch(() => null),
    );
    const parsedIdempotencyKey = idempotencyKeySchema.safeParse(
      request.headers.get("idempotency-key"),
    );
    if (!parsedRequest.success || !parsedIdempotencyKey.success) {
      return Response.json(
        { error: "Invalid LLM job request" },
        { status: 400 },
      );
    }

    const fetcher = input.fetcher ?? fetch;
    const baseUrl = input.supabaseUrl.replace(/\/$/, "");
    const serviceHeaders = {
      apikey: input.serviceRoleKey,
      authorization: `Bearer ${input.serviceRoleKey}`,
    };

    try {
      const user = userSchema.parse(
        await jsonOrThrow(
          await fetcher(`${baseUrl}/auth/v1/user`, {
            headers: {
              apikey: input.serviceRoleKey,
              authorization: `Bearer ${token}`,
            },
            signal: AbortSignal.timeout(10_000),
          }),
        ),
      );
      const instances = z.array(instanceSchema).parse(
        await jsonOrThrow(
          await fetcher(
            `${baseUrl}/rest/v1/llm_instances?id=eq.${encodeURIComponent(parsedRequest.data.instanceId)}&select=id,provider,model_id,base_url,capabilities,privacy,enabled,input_price_tinybar_per_million,output_price_tinybar_per_million,price_synced_at,source_metadata`,
            {
              headers: serviceHeaders,
              signal: AbortSignal.timeout(10_000),
            },
          ),
        ),
      );
      const instance = instances[0];
      if (!instance) {
        return Response.json({ error: "INSTANCE_UNKNOWN" }, { status: 422 });
      }

      const failure = eligibilityFailure({
        instance,
        request: parsedRequest.data,
        now: input.now?.() ?? new Date(),
        maximumPriceAgeMs: input.maximumPriceAgeMs ?? 24 * 60 * 60_000,
        environment: input.environment ?? process.env,
      });
      if (failure) {
        return Response.json({ error: failure }, { status: 422 });
      }

      const existing = z
        .array(z.object({ id: z.string(), state: z.string() }))
        .parse(
          await jsonOrThrow(
            await fetcher(
              `${baseUrl}/rest/v1/llm_jobs?user_id=eq.${encodeURIComponent(user.id)}&idempotency_key=eq.${encodeURIComponent(parsedIdempotencyKey.data)}&select=id,state`,
              {
                headers: serviceHeaders,
                signal: AbortSignal.timeout(10_000),
              },
            ),
          ),
        )[0];
      if (existing) {
        return Response.json(existing, {
          status: 200,
          headers: { "cache-control": "no-store" },
        });
      }

      const jobId = input.id?.() ?? `llm-job:${randomUUID()}`;
      const jobs = z
        .array(z.object({ id: z.string(), state: z.string() }))
        .parse(
          await jsonOrThrow(
            await fetcher(`${baseUrl}/rest/v1/llm_jobs`, {
              method: "POST",
              headers: {
                ...serviceHeaders,
                "content-type": "application/json",
                prefer: "return=representation",
              },
              body: JSON.stringify({
                id: jobId,
                user_id: user.id,
                instance_id: instance.id,
                provider: instance.provider,
                model: instance.model_id,
                capability: parsedRequest.data.capability,
                privacy: parsedRequest.data.privacy,
                maximum_input_tokens: parsedRequest.data.maximumInputTokens,
                maximum_output_tokens: parsedRequest.data.maximumOutputTokens,
                spend_ceiling_tinybar: parsedRequest.data.spendCeilingTinybars,
                idempotency_key: parsedIdempotencyKey.data,
              }),
              signal: AbortSignal.timeout(10_000),
            }),
          ),
        );
      const inputResponse = await fetcher(`${baseUrl}/rest/v1/llm_job_inputs`, {
        method: "POST",
        headers: {
          ...serviceHeaders,
          "content-type": "application/json",
          prefer: "return=minimal",
        },
        body: JSON.stringify({
          job_id: jobId,
          user_id: user.id,
          prompt: parsedRequest.data.prompt,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!inputResponse.ok) {
        throw new Error(`Supabase request failed (${inputResponse.status})`);
      }

      return Response.json(jobs[0], {
        status: 201,
        headers: { "cache-control": "no-store" },
      });
    } catch {
      return Response.json(
        { error: "LLM job submission failed" },
        { status: 502 },
      );
    }
  };
}
