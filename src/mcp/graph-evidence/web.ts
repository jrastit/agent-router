import { z } from "zod";

import {
  createLlmJobInputSchema,
  findPaymentInputSchema,
  listLlmInstancesInputSchema,
  listAgentTransactionsInputSchema,
  verifyReceiptHistoryInputSchema,
} from "./contracts";
import type { GraphPaymentEvidenceClient } from "./graph-client";
import type { LlmMcpClient } from "./llm-client";
import {
  graphEvidenceToolNames,
  invokeGraphEvidenceToolThroughMcp,
  type GraphEvidenceToolName,
} from "./server";

const webRequestSchema = z.discriminatedUnion("tool", [
  z.strictObject({
    tool: z.literal("find_payment"),
    input: findPaymentInputSchema,
  }),
  z.strictObject({
    tool: z.literal("list_agent_transactions"),
    input: listAgentTransactionsInputSchema,
  }),
  z.strictObject({
    tool: z.literal("verify_receipt_history"),
    input: verifyReceiptHistoryInputSchema,
  }),
  z.strictObject({
    tool: z.literal("list_llm_instances"),
    input: listLlmInstancesInputSchema,
  }),
  z.strictObject({
    tool: z.literal("create_llm_job"),
    input: createLlmJobInputSchema,
  }),
]);

export function createGraphEvidenceWebHandler(
  graphClient: GraphPaymentEvidenceClient,
  llmClient?: LlmMcpClient,
) {
  return async function POST(request: Request) {
    let parsed: z.infer<typeof webRequestSchema>;
    try {
      parsed = webRequestSchema.parse(await request.json());
    } catch {
      return Response.json(
        {
          error: "Malformed Graph evidence request",
          tools: graphEvidenceToolNames,
        },
        { status: 400 },
      );
    }
    try {
      const result = await invokeGraphEvidenceToolThroughMcp(
        graphClient,
        parsed.tool as GraphEvidenceToolName,
        parsed.input,
        llmClient,
      );
      return Response.json(
        {
          protocol: "mcp",
          toolCall: { name: parsed.tool, arguments: parsed.input },
          result,
        },
        {
          headers: {
            "cache-control": "no-store",
            "content-security-policy": "default-src 'none'",
          },
        },
      );
    } catch {
      return Response.json(
        { error: "Graph evidence is temporarily unavailable" },
        { status: 503 },
      );
    }
  };
}
