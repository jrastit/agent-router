import { z } from "zod";

import type {
  ComputeExecutionAdapter,
  ComputeExecutionRequest,
  ComputeExecutionResult,
} from "../contracts";

const completionSchema = z.object({
  id: z.string().min(1),
  choices: z
    .array(z.object({ message: z.object({ content: z.string() }) }))
    .min(1),
});

export const zgComputeFailureCodes = [
  "ZG_COMPUTE_CONFIGURATION",
  "ZG_COMPUTE_TIMEOUT",
  "ZG_COMPUTE_AUTHENTICATION",
  "ZG_COMPUTE_POLICY_REJECTED",
  "ZG_COMPUTE_UNAVAILABLE",
  "ZG_COMPUTE_RESPONSE_INVALID",
] as const;

export type ZgComputeFailureCode = (typeof zgComputeFailureCodes)[number];

export class ZgComputeError extends Error {
  constructor(
    readonly code: ZgComputeFailureCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ZgComputeError";
  }
}

type ZgRouterComputeOptions = Readonly<{
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  maxAttempts?: number;
  timeoutMs?: number;
  retryDelay?: (attempt: number) => Promise<void>;
}>;

function responseCode(status: number): ZgComputeFailureCode {
  if (status === 401 || status === 403) return "ZG_COMPUTE_AUTHENTICATION";
  if (status === 400 || status === 409 || status === 422)
    return "ZG_COMPUTE_POLICY_REJECTED";
  return "ZG_COMPUTE_UNAVAILABLE";
}

export class ZgRouterComputeAdapter implements ComputeExecutionAdapter {
  private readonly baseUrl: string;
  private readonly fetch: typeof globalThis.fetch;
  private readonly maxAttempts: number;
  private readonly timeoutMs: number;
  private readonly retryDelay: (attempt: number) => Promise<void>;

  constructor(private readonly options: ZgRouterComputeOptions) {
    if (!options.apiKey.startsWith("sk-")) {
      throw new ZgComputeError(
        "ZG_COMPUTE_CONFIGURATION",
        "0G Router inference requires an sk- API key",
      );
    }
    this.baseUrl = (options.baseUrl ?? "https://router-api.0g.ai/v1").replace(
      /\/$/,
      "",
    );
    this.fetch = options.fetch ?? globalThis.fetch;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.retryDelay =
      options.retryDelay ??
      ((attempt) =>
        new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt)));
  }

  async execute(
    request: ComputeExecutionRequest,
  ): Promise<ComputeExecutionResult> {
    if (
      request.route.privacy !== "confidential" ||
      request.route.provenance.verification !== "TeeML"
    ) {
      throw new ZgComputeError(
        "ZG_COMPUTE_POLICY_REJECTED",
        "Private 0G execution requires a confidential TeeML route",
      );
    }

    const controller = new AbortController();
    const timeoutMs = request.timeoutMs ?? this.timeoutMs;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
        let response: Response;
        try {
          response = await this.fetch(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.options.apiKey}`,
              "Content-Type": "application/json",
              "Idempotency-Key": request.idempotencyKey,
              "X-0G-Provider-Address": request.route.providerAddress,
              "X-0G-Provider-Allow-Fallbacks": "false",
              "X-0G-Provider-Trust-Mode": "private",
            },
            body: JSON.stringify({
              model: request.route.model,
              messages: [{ role: "user", content: request.prompt }],
              stream: false,
            }),
            signal: controller.signal,
          });
        } catch (error) {
          if (controller.signal.aborted) {
            throw new ZgComputeError(
              "ZG_COMPUTE_TIMEOUT",
              `0G Router exceeded ${timeoutMs}ms`,
              { cause: error },
            );
          }
          if (attempt + 1 < this.maxAttempts) {
            await this.retryDelay(attempt);
            continue;
          }
          throw new ZgComputeError(
            "ZG_COMPUTE_UNAVAILABLE",
            "0G Router request failed",
            { cause: error },
          );
        }

        if (!response.ok) {
          if (
            (response.status === 408 ||
              response.status === 429 ||
              response.status >= 500) &&
            attempt + 1 < this.maxAttempts
          ) {
            await this.retryDelay(attempt);
            continue;
          }
          throw new ZgComputeError(
            responseCode(response.status),
            `0G Router returned HTTP ${response.status}`,
          );
        }

        const parsed = completionSchema.safeParse(await response.json());
        if (!parsed.success) {
          throw new ZgComputeError(
            "ZG_COMPUTE_RESPONSE_INVALID",
            "0G Router returned an invalid chat completion",
            { cause: parsed.error },
          );
        }

        return {
          output: parsed.data.choices[0].message.content,
          evidence: {
            providerAddress: request.route.providerAddress,
            model: request.route.model,
            network: "0g-mainnet",
            executionId: parsed.data.id,
            verification: "TeeML via Router private trust-mode enforcement",
            verified: true,
          },
        };
      }
      throw new ZgComputeError(
        "ZG_COMPUTE_UNAVAILABLE",
        "0G Router exhausted all attempts",
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
