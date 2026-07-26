import { serverEnv } from "../../../../../lib/env/server";
import {
  createScalewayWorkloadAdapter,
  createZgWorkloadAdapter,
} from "../../../../../lib/llm-jobs/providers";
import {
  createLlmJobExecutionHandler,
  createSupabaseLlmExecutionDependencies,
} from "../../../../../lib/llm-jobs/supabase-execution";

export const dynamic = "force-dynamic";

export const POST = createLlmJobExecutionHandler({
  supabaseUrl: serverEnv.SUPABASE_URL,
  serviceRoleKey: serverEnv.SUPABASE_SERVICE_ROLE_KEY,
  createDependencies: (userId, userAccessToken) =>
    createSupabaseLlmExecutionDependencies({
      supabaseUrl: serverEnv.SUPABASE_URL!,
      serviceRoleKey: serverEnv.SUPABASE_SERVICE_ROLE_KEY!,
      userId,
      userAccessToken,
      scaleway: createScalewayWorkloadAdapter({
        apiKey: serverEnv.SCALEWAY_GENAI_API_KEY ?? "",
        baseUrl: serverEnv.SCALEWAY_GENAI_BASE_URL,
        timeoutMs: 30_000,
      }),
      zg: createZgWorkloadAdapter({
        apiKey: serverEnv.G_API_KEY_PRIVATE ?? "",
        baseUrl: serverEnv.ZG_ROUTER_BASE_URL,
        timeoutMs: serverEnv.ZG_COMPUTE_TIMEOUT_MS,
        maximumAttempts: serverEnv.ZG_COMPUTE_MAX_ATTEMPTS,
      }),
    }),
});
