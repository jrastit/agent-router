import { serverEnv } from "../../../lib/env/server";
import { createSupabaseLlmCatalogHandler } from "../../../lib/llm-instances/supabase-catalog";

export const dynamic = "force-dynamic";

export const GET = createSupabaseLlmCatalogHandler({
  supabaseUrl: serverEnv.SUPABASE_URL,
  serviceRoleKey: serverEnv.SUPABASE_SERVICE_ROLE_KEY,
});
