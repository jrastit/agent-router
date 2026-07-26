import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import type { GraphPaymentEvidenceClient } from "./graph-client";
import { createGraphEvidenceMcpServer } from "./server";

export async function handleGraphEvidenceMcpHttp(
  request: Request,
  graphClient: GraphPaymentEvidenceClient,
) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json(
      {
        jsonrpc: "2.0",
        error: { code: -32000, message: "Origin not allowed" },
        id: null,
      },
      { status: 403 },
    );
  }
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = createGraphEvidenceMcpServer(graphClient);
  await server.connect(transport);
  return transport.handleRequest(request);
}
