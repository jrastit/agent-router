import { serverEnv } from "../../../lib/env/server";
import { createLlmJobSubmissionHandler } from "../../../lib/llm-jobs/submission";

export const dynamic = "force-dynamic";

export const POST = createLlmJobSubmissionHandler({
  supabaseUrl: serverEnv.SUPABASE_URL,
  serviceRoleKey: serverEnv.SUPABASE_SERVICE_ROLE_KEY,
});
