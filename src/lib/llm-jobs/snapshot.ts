import { z } from "zod";

const exactInteger = z.string().regex(/^(0|[1-9]\d*)$/);

export const llmJobSnapshotSchema = z.object({
  id: z.string(),
  state: z.string(),
  failureCode: z.string().nullable(),
  provider: z.enum(["scaleway", "0g"]),
  model: z.string(),
  capability: z.string(),
  privacy: z.enum(["public", "confidential"]),
  maximumInputTokens: z.number().int().positive(),
  maximumOutputTokens: z.number().int().positive(),
  spendCeilingTinybars: exactInteger,
  selectedInstance: z.object({
    id: z.string(),
    name: z.string(),
    provider: z.string(),
    model: z.string(),
    privacy: z.string(),
  }),
  usage: z
    .object({
      promptTokens: z.number().int().nonnegative(),
      completionTokens: z.number().int().nonnegative(),
      totalTokens: z.number().int().nonnegative(),
    })
    .nullable(),
  accounting: z
    .object({
      reservedTinybars: exactInteger,
      chargedTinybars: exactInteger,
      refundedTinybars: exactInteger,
      priceSnapshot: z.record(z.string(), z.unknown()),
    })
    .nullable(),
  remainingBalanceTinybars: exactInteger,
  output: z.string().nullable(),
  evidence: z
    .object({
      executionId: z.string(),
      verificationLabel: z.string(),
      providerAddress: z.string().nullable(),
      trustMode: z.string().nullable(),
    })
    .nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type LlmJobSnapshot = z.infer<typeof llmJobSnapshotSchema>;

function bearerToken(request: Request) {
  return request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/)?.[1];
}

export function createLlmJobSnapshotReader(input: {
  supabaseUrl: string;
  serviceRoleKey: string;
  fetcher?: typeof fetch;
}) {
  return async (token: string, jobId: string) => {
    const response = await (input.fetcher ?? fetch)(
      `${input.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/get_my_llm_job_snapshot`,
      {
        method: "POST",
        headers: {
          apikey: input.serviceRoleKey,
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ target_job_id: jobId }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) {
      throw new Error(`LLM snapshot failed (${response.status})`);
    }
    const payload: unknown = await response.json();
    if (payload === null) return null;
    return llmJobSnapshotSchema.parse(payload);
  };
}

export function createLlmJobSnapshotHandler(input: {
  reader: (token: string, jobId: string) => Promise<LlmJobSnapshot | null>;
}) {
  return async function GET(
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
    const { jobId } = await context.params;
    try {
      const snapshot = await input.reader(token, jobId);
      if (!snapshot) {
        return Response.json({ error: "LLM job not found" }, { status: 404 });
      }
      return Response.json(snapshot, {
        headers: { "cache-control": "no-store" },
      });
    } catch {
      return Response.json(
        { error: "LLM job snapshot unavailable" },
        { status: 502 },
      );
    }
  };
}

export function createLlmJobEventHandler(input: {
  reader: (token: string, jobId: string) => Promise<LlmJobSnapshot | null>;
}) {
  return async function GET(
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
    const { jobId } = await context.params;
    try {
      const snapshot = await input.reader(token, jobId);
      if (!snapshot) {
        return Response.json({ error: "LLM job not found" }, { status: 404 });
      }
      const event = `event: llm-job\ndata: ${JSON.stringify(snapshot)}\n\n`;
      const terminal = [
        "delivered",
        "failed",
        "reconciliation_required",
      ].includes(snapshot.state);
      return new Response(
        `${event}${terminal ? "event: complete\ndata: {}\n\n" : "retry: 1000\n\n"}`,
        {
          headers: {
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "Content-Type": "text/event-stream; charset=utf-8",
            "X-Accel-Buffering": "no",
          },
        },
      );
    } catch {
      return Response.json(
        { error: "LLM job stream unavailable" },
        { status: 502 },
      );
    }
  };
}
