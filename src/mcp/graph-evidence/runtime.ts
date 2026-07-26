import "server-only";

import { serverEnv } from "../../lib/env/server";
import { createRunnableLlmCatalogHandler } from "../../lib/llm-jobs/catalog";
import { createLlmJobSubmissionHandler } from "../../lib/llm-jobs/submission";
import { GraphPaymentEvidenceClient } from "./graph-client";
import { createLlmMcpClient } from "./llm-client";

export function createServerGraphEvidenceClient() {
  return new GraphPaymentEvidenceClient({
    projectionEndpoint: serverEnv.HEDERA_PROJECTION_PUBLIC_QUERY_URL,
    economicEndpoint: serverEnv.HEDERA_ECONOMIC_PUBLIC_QUERY_URL,
  });
}

export function createServerLlmMcpClient(userAccessToken?: string) {
  const config = {
    supabaseUrl: serverEnv.SUPABASE_URL,
    serviceRoleKey: serverEnv.SUPABASE_SERVICE_ROLE_KEY,
  };
  return createLlmMcpClient({
    catalogHandler: createRunnableLlmCatalogHandler(config),
    submissionHandler: createLlmJobSubmissionHandler(config),
    userAccessToken,
  });
}
