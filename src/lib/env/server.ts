import "server-only";

import { serverEnvSchema } from "./schema";

export const serverEnv = serverEnvSchema.parse({
  APP_ENV: process.env.APP_ENV,
  HEDERA_NETWORK: process.env.HEDERA_NETWORK,
  HEDERA_OPERATOR_ID: process.env.HEDERA_OPERATOR_ID,
  HEDERA_OPERATOR_KEY: process.env.HEDERA_OPERATOR_KEY,
  DISCOVERY_SOURCE: process.env.DISCOVERY_SOURCE,
  GRAPH_ENDPOINT: process.env.GRAPH_ENDPOINT,
  GRAPH_DEPLOYMENT_ID: process.env.GRAPH_DEPLOYMENT_ID,
  GRAPH_NETWORK: process.env.GRAPH_NETWORK,
  GRAPH_MAX_STALENESS_MS: process.env.GRAPH_MAX_STALENESS_MS,
  GRAPH_ACCESS_TOKEN: process.env.GRAPH_ACCESS_TOKEN,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
});
