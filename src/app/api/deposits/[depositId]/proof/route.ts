import { createDepositProofHandler } from "../../../../../lib/deposit/http";
import { serverEnv } from "../../../../../lib/env/server";

export const POST = createDepositProofHandler({
  supabaseUrl: serverEnv.SUPABASE_URL,
  serviceRoleKey: serverEnv.SUPABASE_SERVICE_ROLE_KEY,
});
