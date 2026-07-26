import { describe, expect, it } from "vitest";

import { handleGraphEvidenceMcpHttp } from "./http";

function initialize(origin?: string) {
  return new Request("https://app.example.com/api/mcp/graph-evidence", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      ...(origin ? { origin } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "contract-test", version: "1.0.0" },
      },
    }),
  });
}

describe("Graph evidence Streamable HTTP transport", () => {
  it("negotiates the MCP protocol over a Web Standard request", async () => {
    const response = await handleGraphEvidenceMcpHttp(
      initialize(),
      {} as never,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        serverInfo: {
          name: "agent-router-graph-evidence",
          version: "1.0.0",
        },
      },
    });
  });

  it("rejects cross-origin browser requests", async () => {
    const response = await handleGraphEvidenceMcpHttp(
      initialize("https://malicious.example.com"),
      {} as never,
    );
    expect(response.status).toBe(403);
  });
});
