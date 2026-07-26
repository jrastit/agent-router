import { describe, expect, it, vi } from "vitest";

import { createGraphEvidenceWebHandler } from "./web";

const reference = `0x${"11".repeat(32)}`;

function request(body: unknown) {
  return new Request("https://app.example.com/api/graph-evidence", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Graph evidence web adapter", () => {
  it("invokes the MCP tool and returns its structured call", async () => {
    const graphClient = {
      findPayment: vi.fn().mockResolvedValue({
        tool: "find_payment",
        reference,
        matches: [],
        provenance: {
          endpoint: "https://graph.example.com/query",
          subgraph: "agent-router/hedera-projection",
          indexedBlock: 2,
          hasIndexingErrors: false,
          completeness: "indexed",
          chainHeadBlock: null,
          lagBlocks: null,
          chain: {
            source: "hedera-testnet",
            destination: "ganache-local",
            destinationChainId: "1337",
          },
          authority:
            "monitoring-only; Hedera Mirror and Postgres remain authoritative",
        },
      }),
    };
    const response = await createGraphEvidenceWebHandler(graphClient as never)(
      request({
        tool: "find_payment",
        input: { reference },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      protocol: "mcp",
      toolCall: {
        name: "find_payment",
        arguments: { reference },
      },
      result: {
        tool: "find_payment",
        provenance: { indexedBlock: 2 },
      },
    });
    expect(graphClient.findPayment).toHaveBeenCalledOnce();
  });

  it("rejects unknown tools, malformed input, and secret-like fields", async () => {
    const handler = createGraphEvidenceWebHandler({} as never);
    for (const body of [
      { tool: "unknown", input: { reference } },
      { tool: "find_payment", input: { reference: "invalid" } },
      {
        tool: "find_payment",
        input: { reference, graphApiKey: "browser-secret" },
      },
    ]) {
      const response = await handler(request(body));
      expect(response.status).toBe(400);
      expect(JSON.stringify(await response.json())).not.toContain(
        "browser-secret",
      );
    }
  });
});
