import { createDepositVerificationHandler } from "../../../../../lib/deposit/verify-http";
import { serverEnv } from "../../../../../lib/env/server";

export const POST = createDepositVerificationHandler({
  supabaseUrl: serverEnv.SUPABASE_URL,
  serviceRoleKey: serverEnv.SUPABASE_SERVICE_ROLE_KEY,
  mirrorNodeUrl: serverEnv.HEDERA_MIRROR_NODE_URL,
  pseudonymSalt: serverEnv.DEPOSIT_PSEUDONYM_SALT,
});
