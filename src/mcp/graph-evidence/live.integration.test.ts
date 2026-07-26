import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { describe, expect, it } from "vitest";

import { findPaymentOutputSchema } from "./contracts";

const live = process.env.GRAPH_EVIDENCE_LIVE_TEST === "true";
const reference =
  process.env.GRAPH_EVIDENCE_LIVE_REFERENCE ??
  "0xdb3a831451eedd88f68ff90d2d2a6343283b6164282cd600540babb673183a65";

describe.skipIf(!live)("live Graph evidence MCP", () => {
  it("returns current blockchain evidence through an external stdio client", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["node_modules/tsx/dist/cli.mjs", "scripts/graph-evidence-mcp.ts"],
      env: {
        HEDERA_PROJECTION_PUBLIC_QUERY_URL:
          process.env.HEDERA_PROJECTION_PUBLIC_QUERY_URL ??
          "https://graph.router.fexhu.com/subgraphs/name/agent-router/hedera-projection",
        HEDERA_ECONOMIC_PUBLIC_QUERY_URL:
          process.env.HEDERA_ECONOMIC_PUBLIC_QUERY_URL ??
          "https://graph.router.fexhu.com/subgraphs/name/agent-router/app-events",
      },
      stderr: "pipe",
    });
    const client = new Client({
      name: "agent-router-live-proof",
      version: "1.0.0",
    });
    try {
      await client.connect(transport);
      const call = await client.callTool({
        name: "find_payment",
        arguments: { reference },
      });
      const result = findPaymentOutputSchema.parse(call.structuredContent);
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches[0]).toMatchObject({
        sourceEventId: reference,
        eventKind: "deposit.credited",
      });
      expect(result.provenance).toMatchObject({
        endpoint:
          "https://graph.router.fexhu.com/subgraphs/name/agent-router/hedera-projection",
        indexedBlock: 10,
        hasIndexingErrors: false,
        completeness: "indexed",
      });
    } finally {
      await client.close();
    }
  });
});
