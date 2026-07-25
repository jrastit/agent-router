import { createDepositIntentHandler } from "../../../../lib/deposit/http";
import { serverEnv } from "../../../../lib/env/server";

export const POST = createDepositIntentHandler({
  supabaseUrl: serverEnv.SUPABASE_URL,
  serviceRoleKey: serverEnv.SUPABASE_SERVICE_ROLE_KEY,
  treasuryAccount: serverEnv.HEDERA_RECIPIENT_ID,
});
