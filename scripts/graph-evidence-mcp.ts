import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { GraphPaymentEvidenceClient } from "../src/mcp/graph-evidence/graph-client";
import { createGraphEvidenceMcpServer } from "../src/mcp/graph-evidence/server";
import { createRunnableLlmCatalogHandler } from "../src/lib/llm-jobs/catalog";
import { createLlmJobSubmissionHandler } from "../src/lib/llm-jobs/submission";
import { createLlmMcpClient } from "../src/mcp/graph-evidence/llm-client";

const projectionEndpoint = process.env.HEDERA_PROJECTION_PUBLIC_QUERY_URL;
const economicEndpoint = process.env.HEDERA_ECONOMIC_PUBLIC_QUERY_URL;
if (!projectionEndpoint || !economicEndpoint) {
  throw new Error(
    "HEDERA_PROJECTION_PUBLIC_QUERY_URL and HEDERA_ECONOMIC_PUBLIC_QUERY_URL are required",
  );
}

async function main() {
  const config = {
    supabaseUrl: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const server = createGraphEvidenceMcpServer(
    new GraphPaymentEvidenceClient({
      projectionEndpoint: projectionEndpoint!,
      economicEndpoint: economicEndpoint!,
    }),
    createLlmMcpClient({
      catalogHandler: createRunnableLlmCatalogHandler(config),
      submissionHandler: createLlmJobSubmissionHandler(config),
      userAccessToken: process.env.SUPABASE_USER_ACCESS_TOKEN,
    }),
  );
  await server.connect(new StdioServerTransport());
}

void main();
