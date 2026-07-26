import { z } from "zod";

export const llmProviderFailureCodes = [
  "PROVIDER_AUTHENTICATION",
  "PROVIDER_TIMEOUT",
  "PROVIDER_UNAVAILABLE",
  "OUTPUT_INVALID",
  "USAGE_MISSING",
  "USAGE_EXCEEDED",
] as const;

export type LlmProviderFailureCode = (typeof llmProviderFailureCodes)[number];

export class LlmProviderError extends Error {
  constructor(
    readonly code: LlmProviderFailureCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "LlmProviderError";
  }
}

export type LlmProviderExecutionRequest = Readonly<{
  model: string;
  prompt: string;
  maximumInputTokens: number;
  maximumOutputTokens: number;
  idempotencyKey: string;
  providerAddress?: string;
}>;

export type LlmProviderExecutionResult = Readonly<{
  output: string;
  usage: Readonly<{
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }>;
  evidence: Readonly<{
    provider: "scaleway" | "0g";
    model: string;
    executionId: string;
    verificationLabel: string;
    providerAddress: string | null;
    trustMode: "standard" | "private" | null;
  }>;
}>;

export interface LlmProviderAdapter {
  execute(
    request: LlmProviderExecutionRequest,
  ): Promise<LlmProviderExecutionResult>;
}

const completionSchema = z.object({
  id: z.string().min(1).max(300),
  model: z.string().min(1).max(300),
  choices: z
    .array(z.object({ message: z.object({ content: z.string() }) }))
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative(),
      completion_tokens: z.number().int().nonnegative(),
      total_tokens: z.number().int().nonnegative(),
    })
    .optional(),
});

type Provider = "scaleway" | "0g";

type AdapterOptions = Readonly<{
  provider: Provider;
  apiKey: string;
  baseUrl: string;
  timeoutMs?: number;
  maximumAttempts?: number;
  fetcher?: typeof fetch;
  retryDelay?: (attempt: number) => Promise<void>;
}>;

function responseFailure(status: number): LlmProviderFailureCode {
  return status === 401 || status === 403
    ? "PROVIDER_AUTHENTICATION"
    : "PROVIDER_UNAVAILABLE";
}

class OpenAiCompatibleWorkloadAdapter implements LlmProviderAdapter {
  constructor(private readonly options: AdapterOptions) {
    if (!options.apiKey) {
      throw new LlmProviderError(
        "PROVIDER_AUTHENTICATION",
        `${options.provider} credential is unavailable`,
      );
    }
  }

  async execute(
    request: LlmProviderExecutionRequest,
  ): Promise<LlmProviderExecutionResult> {
    if (this.options.provider === "0g" && !request.providerAddress) {
      throw new LlmProviderError(
        "OUTPUT_INVALID",
        "0G execution requires a pinned provider address",
      );
    }

    const timeoutMs = this.options.timeoutMs ?? 30_000;
    const maximumAttempts = this.options.maximumAttempts ?? 1;
    const fetcher = this.options.fetcher ?? fetch;
    const retryDelay =
      this.options.retryDelay ??
      ((attempt: number) =>
        new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt)));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
        let response: Response;
        try {
          response = await fetcher(
            `${this.options.baseUrl.replace(/\/$/, "")}/chat/completions`,
            {
              method: "POST",
              headers: {
                authorization: `Bearer ${this.options.apiKey}`,
                "content-type": "application/json",
                "idempotency-key": request.idempotencyKey,
                ...(this.options.provider === "0g"
                  ? {
                      "x-0g-provider-address": request.providerAddress!,
                      "x-0g-provider-allow-fallbacks": "false",
                      "x-0g-provider-trust-mode": "private",
                    }
                  : {}),
              },
              body: JSON.stringify({
                model: request.model,
                messages: [{ role: "user", content: request.prompt }],
                max_tokens: request.maximumOutputTokens,
                stream: false,
              }),
              signal: controller.signal,
            },
          );
        } catch (error) {
          if (controller.signal.aborted) {
            throw new LlmProviderError(
              "PROVIDER_TIMEOUT",
              `${this.options.provider} request exceeded its timeout`,
              { cause: error },
            );
          }
          if (attempt + 1 < maximumAttempts) {
            await retryDelay(attempt);
            continue;
          }
          throw new LlmProviderError(
            "PROVIDER_UNAVAILABLE",
            `${this.options.provider} request failed`,
            { cause: error },
          );
        }

        if (!response.ok) {
          if (
            (response.status === 408 ||
              response.status === 429 ||
              response.status >= 500) &&
            attempt + 1 < maximumAttempts
          ) {
            await retryDelay(attempt);
            continue;
          }
          throw new LlmProviderError(
            responseFailure(response.status),
            `${this.options.provider} returned HTTP ${response.status}`,
          );
        }

        const parsed = completionSchema.safeParse(await response.json());
        if (!parsed.success) {
          throw new LlmProviderError(
            "OUTPUT_INVALID",
            `${this.options.provider} returned an invalid completion`,
            { cause: parsed.error },
          );
        }
        if (parsed.data.model !== request.model) {
          throw new LlmProviderError(
            "OUTPUT_INVALID",
            `${this.options.provider} returned an unexpected model`,
          );
        }
        const output = parsed.data.choices[0].message.content.trim();
        if (!output) {
          throw new LlmProviderError(
            "OUTPUT_INVALID",
            `${this.options.provider} returned an empty completion`,
          );
        }
        if (!parsed.data.usage) {
          throw new LlmProviderError(
            "USAGE_MISSING",
            `${this.options.provider} omitted token usage`,
          );
        }
        const usage = parsed.data.usage;
        if (
          usage.total_tokens !==
          usage.prompt_tokens + usage.completion_tokens
        ) {
          throw new LlmProviderError(
            "USAGE_MISSING",
            `${this.options.provider} returned inconsistent token usage`,
          );
        }
        if (
          usage.prompt_tokens > request.maximumInputTokens ||
          usage.completion_tokens > request.maximumOutputTokens
        ) {
          throw new LlmProviderError(
            "USAGE_EXCEEDED",
            `${this.options.provider} usage exceeded requested limits`,
          );
        }

        return {
          output,
          usage: {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
          },
          evidence: {
            provider: this.options.provider,
            model: parsed.data.model,
            executionId: parsed.data.id,
            verificationLabel:
              this.options.provider === "0g"
                ? "0G Router private trust-mode response; TeeML catalog claim not independently attested"
                : "provider-reported Scaleway chat completion",
            providerAddress: request.providerAddress ?? null,
            trustMode: this.options.provider === "0g" ? "private" : "standard",
          },
        };
      }
      throw new LlmProviderError(
        "PROVIDER_UNAVAILABLE",
        `${this.options.provider} exhausted all attempts`,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

export function createScalewayWorkloadAdapter(
  options: Omit<AdapterOptions, "provider" | "maximumAttempts">,
) {
  return new OpenAiCompatibleWorkloadAdapter({
    ...options,
    provider: "scaleway",
    maximumAttempts: 1,
  });
}

export function createZgWorkloadAdapter(
  options: Omit<AdapterOptions, "provider">,
) {
  return new OpenAiCompatibleWorkloadAdapter({
    ...options,
    provider: "0g",
  });
}
