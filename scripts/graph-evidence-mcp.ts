import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { GraphPaymentEvidenceClient } from "../src/mcp/graph-evidence/graph-client";
import { createGraphEvidenceMcpServer } from "../src/mcp/graph-evidence/server";

const projectionEndpoint = process.env.HEDERA_PROJECTION_PUBLIC_QUERY_URL;
const economicEndpoint = process.env.HEDERA_ECONOMIC_PUBLIC_QUERY_URL;
if (!projectionEndpoint || !economicEndpoint) {
  throw new Error(
    "HEDERA_PROJECTION_PUBLIC_QUERY_URL and HEDERA_ECONOMIC_PUBLIC_QUERY_URL are required",
  );
}

async function main() {
  const server = createGraphEvidenceMcpServer(
    new GraphPaymentEvidenceClient({
      projectionEndpoint: projectionEndpoint!,
      economicEndpoint: economicEndpoint!,
    }),
  );
  await server.connect(new StdioServerTransport());
}

void main();
