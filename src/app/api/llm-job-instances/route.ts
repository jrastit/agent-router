import { serverEnv } from "../../../lib/env/server";
import { createRunnableLlmCatalogHandler } from "../../../lib/llm-jobs/catalog";

export const dynamic = "force-dynamic";

export const GET = createRunnableLlmCatalogHandler({
  supabaseUrl: serverEnv.SUPABASE_URL,
  serviceRoleKey: serverEnv.SUPABASE_SERVICE_ROLE_KEY,
});
