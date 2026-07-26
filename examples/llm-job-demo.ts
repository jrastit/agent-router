import { z } from "zod";

export const demoProviders = ["scaleway", "0g"] as const;
export type DemoProvider = (typeof demoProviders)[number];

export const demoRequestSchema = z.object({
  provider: z.enum(demoProviders),
  prompt: z.string().min(1),
  maximumInputTokens: z.number().int().positive(),
  maximumOutputTokens: z.number().int().positive(),
  spendCeilingMicrousd: z.string().regex(/^\d+$/),
  idempotencyKey: z.string().min(1),
});

export type DemoRequest = z.infer<typeof demoRequestSchema>;

export type DemoExecution = Readonly<{
  model: string;
  executionId: string;
  promptTokens: number;
  completionTokens: number;
  verificationLabel: string;
  output: string;
}>;

export interface DemoAdapter {
  readonly instanceId: string;
  readonly provider: DemoProvider;
  readonly inputMicrousdPerMillionTokens: string;
  readonly outputMicrousdPerMillionTokens: string;
  execute(request: DemoRequest): Promise<DemoExecution>;
}

export type RedactedDemoResult = Readonly<{
  selectedInstance: string;
  provider: DemoProvider;
  model: string;
  lifecycleStates: readonly string[];
  tokenUsage: Readonly<{
    prompt: number;
    completion: number;
    total: number;
  }>;
  amountsMicrousd: Readonly<{
    reserved: string;
    charged: string;
    refunded: string;
  }>;
  executionId: string;
  verificationLabel: string;
}>;

function tokenCharge(tokens: number, rate: string) {
  return (BigInt(tokens) * BigInt(rate) + BigInt(999_999)) / BigInt(1_000_000);
}

function maximumCharge(request: DemoRequest, adapter: DemoAdapter) {
  return (
    tokenCharge(
      request.maximumInputTokens,
      adapter.inputMicrousdPerMillionTokens,
    ) +
    tokenCharge(
      request.maximumOutputTokens,
      adapter.outputMicrousdPerMillionTokens,
    )
  );
}

export async function runLlmJobDemo(
  adapter: DemoAdapter,
  unparsedRequest: DemoRequest,
): Promise<RedactedDemoResult> {
  const request = demoRequestSchema.parse(unparsedRequest);
  if (request.provider !== adapter.provider) {
    throw new Error("Selected provider does not match the execution adapter");
  }

  const reserved = maximumCharge(request, adapter);
  if (reserved > BigInt(request.spendCeilingMicrousd)) {
    throw new Error("Maximum charge exceeds the application-credit ceiling");
  }

  const states = ["accepted", "reserved", "executing"];
  const execution = await adapter.execute(request);
  if (
    execution.promptTokens > request.maximumInputTokens ||
    execution.completionTokens > request.maximumOutputTokens
  ) {
    throw new Error(
      "Provider-reported token usage exceeds the requested limit",
    );
  }
  if (!execution.output.trim()) {
    throw new Error("Provider returned an empty result");
  }

  const charged =
    tokenCharge(execution.promptTokens, adapter.inputMicrousdPerMillionTokens) +
    tokenCharge(
      execution.completionTokens,
      adapter.outputMicrousdPerMillionTokens,
    );
  if (charged > reserved) {
    throw new Error("Actual charge exceeds the reserved application credit");
  }

  states.push("validated", "charged", "delivered");
  return {
    selectedInstance: adapter.instanceId,
    provider: adapter.provider,
    model: execution.model,
    lifecycleStates: states,
    tokenUsage: {
      prompt: execution.promptTokens,
      completion: execution.completionTokens,
      total: execution.promptTokens + execution.completionTokens,
    },
    amountsMicrousd: {
      reserved: reserved.toString(),
      charged: charged.toString(),
      refunded: (reserved - charged).toString(),
    },
    executionId: execution.executionId,
    verificationLabel: execution.verificationLabel,
  };
}

export function createFixtureAdapter(provider: DemoProvider): DemoAdapter {
  const scaleway = provider === "scaleway";
  return {
    provider,
    instanceId: scaleway ? "fixture-scaleway-qwen" : "fixture-0g-private-llama",
    inputMicrousdPerMillionTokens: scaleway ? "200000" : "300000",
    outputMicrousdPerMillionTokens: scaleway ? "600000" : "900000",
    async execute() {
      return {
        model: scaleway ? "qwen3.5-27b" : "llama-3.3-70b-instruct",
        executionId: scaleway
          ? "fixture-scaleway-execution-001"
          : "fixture-0g-execution-001",
        promptTokens: 12,
        completionTokens: 18,
        output: "Private fixture output; intentionally omitted from summary.",
        verificationLabel: scaleway
          ? "deterministic offline Scaleway fixture; not provider-verified"
          : "deterministic offline 0G private-mode fixture; not a TEE attestation",
      };
    },
  };
}

const completionSchema = z.object({
  id: z.string().min(1),
  model: z.string().min(1).optional(),
  choices: z
    .array(z.object({ message: z.object({ content: z.string().min(1) }) }))
    .min(1),
  usage: z.object({
    prompt_tokens: z.number().int().nonnegative(),
    completion_tokens: z.number().int().nonnegative(),
    total_tokens: z.number().int().nonnegative(),
  }),
});

export function createLiveAdapter(
  provider: DemoProvider,
  environment: Readonly<Record<string, string | undefined>> = process.env,
  fetchImpl: typeof fetch = fetch,
): DemoAdapter {
  const scaleway = provider === "scaleway";
  const apiKey = scaleway
    ? environment.SCALEWAY_GENAI_API_KEY
    : environment.G_API_KEY_PRIVATE;
  if (!apiKey) {
    throw new Error(
      `${scaleway ? "SCALEWAY_GENAI_API_KEY" : "G_API_KEY_PRIVATE"} is required for live ${provider} execution`,
    );
  }
  if (environment.CONFIRM_LIVE_LLM_DEMO !== "yes") {
    throw new Error(
      "Set CONFIRM_LIVE_LLM_DEMO=yes to acknowledge real provider usage",
    );
  }

  const model = scaleway
    ? (environment.SCALEWAY_GENAI_MODEL ?? "llama-3.3-70b-instruct")
    : (environment.ZG_DEMO_MODEL ?? "llama-3.3-70b-instruct");
  const baseUrl = (
    scaleway
      ? (environment.SCALEWAY_GENAI_BASE_URL ??
        environment.SCALEWAY_GENAI_API_BASE ??
        "https://api.scaleway.ai/v1")
      : (environment.ZG_ROUTER_BASE_URL ?? "https://router-api.0g.ai/v1")
  ).replace(/\/$/, "");

  return {
    provider,
    instanceId: scaleway ? `scaleway:${model}` : `0g-private:${model}`,
    inputMicrousdPerMillionTokens: scaleway ? "200000" : "300000",
    outputMicrousdPerMillionTokens: scaleway ? "600000" : "900000",
    async execute(request) {
      const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": request.idempotencyKey,
          ...(scaleway
            ? {}
            : {
                "X-0G-Provider-Allow-Fallbacks": "false",
                "X-0G-Provider-Trust-Mode": "private",
              }),
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: request.prompt }],
          max_tokens: request.maximumOutputTokens,
          stream: false,
          ...(scaleway ? {} : { reasoning_effort: "low" }),
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        throw new Error(`${provider} returned HTTP ${response.status}`);
      }
      const parsed = completionSchema.parse(await response.json());
      return {
        model: parsed.model ?? model,
        executionId: parsed.id,
        promptTokens: parsed.usage.prompt_tokens,
        completionTokens: parsed.usage.completion_tokens,
        output: parsed.choices[0].message.content,
        verificationLabel: scaleway
          ? "provider-reported Scaleway chat completion"
          : "0G Router private trust-mode response; not independently attested",
      };
    },
  };
}
