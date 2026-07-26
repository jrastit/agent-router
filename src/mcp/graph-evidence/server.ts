import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  findPaymentInputSchema,
  findPaymentOutputSchema,
  createLlmJobInputSchema,
  createLlmJobOutputSchema,
  listLlmInstancesInputSchema,
  listLlmInstancesOutputSchema,
  listAgentTransactionsInputSchema,
  listAgentTransactionsOutputSchema,
  verifyReceiptHistoryInputSchema,
  verifyReceiptHistoryOutputSchema,
} from "./contracts";
import type { GraphPaymentEvidenceClient } from "./graph-client";
import type { LlmMcpClient } from "./llm-client";

export const graphEvidenceToolNames = [
  "find_payment",
  "list_agent_transactions",
  "verify_receipt_history",
  "list_llm_instances",
  "create_llm_job",
] as const;

export type GraphEvidenceToolName = (typeof graphEvidenceToolNames)[number];

export function createGraphEvidenceMcpServer(
  client: GraphPaymentEvidenceClient,
  llmClient?: LlmMcpClient,
) {
  const server = new McpServer({
    name: "agent-router-graph-evidence",
    version: "1.0.0",
  });

  server.registerTool(
    "find_payment",
    {
      title: "Find payment evidence",
      description:
        "Find relayer-mediated Graph monitoring evidence by source-event, Hedera transaction-hash, or destination transaction-hash reference.",
      inputSchema: findPaymentInputSchema,
      outputSchema: findPaymentOutputSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ reference }) => toolResult(await client.findPayment(reference)),
  );

  server.registerTool(
    "list_agent_transactions",
    {
      title: "List agent transactions",
      description:
        "List public Graph projection and economic-monitoring events associated with a pseudonymous account or relayer.",
      inputSchema: listAgentTransactionsInputSchema,
      outputSchema: listAgentTransactionsOutputSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ account, limit }) =>
      toolResult(await client.listAgentTransactions(account, limit)),
  );

  server.registerTool(
    "verify_receipt_history",
    {
      title: "Verify receipt history",
      description:
        "Check that every supplied receipt reference has indexed Graph evidence and that no destination transaction is reused across distinct source events.",
      inputSchema: verifyReceiptHistoryInputSchema,
      outputSchema: verifyReceiptHistoryOutputSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ references }) =>
      toolResult(await client.verifyReceiptHistory(references)),
  );

  if (llmClient) {
    server.registerTool(
      "list_llm_instances",
      {
        title: "List runnable LLM instances",
        description:
          "List enabled, chat-capable LLM instances with exact tinybar token prices that can be selected for a job.",
        inputSchema: listLlmInstancesInputSchema,
        outputSchema: listLlmInstancesOutputSchema,
        annotations: { readOnlyHint: true, openWorldHint: true },
      },
      async () => toolResult(await llmClient.listInstances()),
    );

    server.registerTool(
      "create_llm_job",
      {
        title: "Create an LLM job on a selected instance",
        description:
          "Create an authenticated LLM job using an exact instance ID returned by list_llm_instances. Server-side policy revalidates instance eligibility, privacy, pricing, and provider credentials.",
        inputSchema: createLlmJobInputSchema,
        outputSchema: createLlmJobOutputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      async (input) => toolResult(await llmClient.createJob(input)),
    );
  }

  return server;
}

export async function invokeGraphEvidenceToolThroughMcp(
  graphClient: GraphPaymentEvidenceClient,
  name: GraphEvidenceToolName,
  args: Record<string, unknown>,
  llmClient?: LlmMcpClient,
) {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const server = createGraphEvidenceMcpServer(graphClient, llmClient);
  const client = new Client({
    name: "agent-router-web-adapter",
    version: "1.0.0",
  });
  try {
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    const result = await client.callTool({ name, arguments: args });
    if (result.isError || !result.structuredContent) {
      throw new Error("Graph evidence MCP tool failed");
    }
    return result.structuredContent;
  } finally {
    await client.close();
    await server.close();
  }
}

function toolResult(value: object) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value as Record<string, unknown>,
  };
}
