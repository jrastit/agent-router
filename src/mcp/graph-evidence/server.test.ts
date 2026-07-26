import { describe, expect, it, vi } from "vitest";

import {
  createGraphEvidenceMcpServer,
  graphEvidenceToolNames,
  invokeGraphEvidenceToolThroughMcp,
} from "./server";

const reference = `0x${"11".repeat(32)}`;
const account = `0x${"22".repeat(20)}`;
const provenance = {
  endpoint:
    "https://graph.example.com/subgraphs/name/agent-router/hedera-projection",
  subgraph: "agent-router/hedera-projection",
  indexedBlock: 2,
  hasIndexingErrors: false,
  completeness: "indexed" as const,
  chainHeadBlock: null,
  lagBlocks: null,
  chain: {
    source: "hedera-testnet" as const,
    destination: "ganache-local" as const,
    destinationChainId: "1337" as const,
  },
  authority:
    "monitoring-only; Hedera Mirror and Postgres remain authoritative" as const,
};

function graphClient() {
  return {
    findPayment: vi.fn().mockResolvedValue({
      tool: "find_payment",
      reference,
      matches: [],
      provenance,
    }),
    listAgentTransactions: vi.fn().mockResolvedValue({
      tool: "list_agent_transactions",
      account,
      anchors: [],
      economicEvents: [],
      provenance: { projection: provenance, economic: provenance },
    }),
    verifyReceiptHistory: vi.fn().mockResolvedValue({
      tool: "verify_receipt_history",
      verified: true,
      missingReferences: [],
      duplicateDestinationTransactions: [],
      entries: [],
      provenance,
    }),
  };
}

describe("Graph evidence MCP server", () => {
  it("publishes the stable three-tool surface", () => {
    const server = createGraphEvidenceMcpServer(graphClient() as never);
    expect(graphEvidenceToolNames).toEqual([
      "find_payment",
      "list_agent_transactions",
      "verify_receipt_history",
    ]);
    expect(server).toBeDefined();
  });

  it("invokes find_payment through an MCP transport", async () => {
    const graph = graphClient();
    await expect(
      invokeGraphEvidenceToolThroughMcp(graph as never, "find_payment", {
        reference,
      }),
    ).resolves.toMatchObject({
      tool: "find_payment",
      reference,
      provenance: { indexedBlock: 2 },
    });
    expect(graph.findPayment).toHaveBeenCalledWith(reference);
  });

  it("rejects malformed tool arguments at the MCP contract boundary", async () => {
    await expect(
      invokeGraphEvidenceToolThroughMcp(
        graphClient() as never,
        "list_agent_transactions",
        { account: "not-an-account", limit: 1000 },
      ),
    ).rejects.toThrow("MCP tool failed");
  });
});
