import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { describe, expect, it } from "vitest";

describe("Graph evidence MCP stdio transport", () => {
  it("initializes and lists the stable external tool surface", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["node_modules/tsx/dist/cli.mjs", "scripts/graph-evidence-mcp.ts"],
      env: {
        HEDERA_PROJECTION_PUBLIC_QUERY_URL:
          "https://graph.example.com/subgraphs/name/agent-router/hedera-projection",
        HEDERA_ECONOMIC_PUBLIC_QUERY_URL:
          "https://graph.example.com/subgraphs/name/agent-router/app-events",
      },
      stderr: "pipe",
    });
    const client = new Client({
      name: "agent-router-stdio-contract-test",
      version: "1.0.0",
    });
    let stderr = "";
    transport.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    try {
      await client.connect(transport).catch((error: unknown) => {
        throw new Error(`stdio MCP failed: ${stderr}`, { cause: error });
      });
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual([
        "find_payment",
        "list_agent_transactions",
        "verify_receipt_history",
        "list_llm_instances",
        "create_llm_job",
      ]);
      expect(tools.tools.every((tool) => tool.inputSchema)).toBe(true);
    } finally {
      await client.close();
    }
  });
});
