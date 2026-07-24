import "server-only";

import { serverEnvSchema } from "./schema";

export const serverEnv = serverEnvSchema.parse({
  APP_ENV: process.env.APP_ENV,
  HEDERA_NETWORK: process.env.HEDERA_NETWORK,
  HEDERA_OPERATOR_ID: process.env.HEDERA_OPERATOR_ID,
  HEDERA_OPERATOR_KEY: process.env.HEDERA_OPERATOR_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
});
