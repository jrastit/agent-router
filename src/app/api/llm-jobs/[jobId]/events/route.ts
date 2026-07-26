import { serverEnv } from "../../../../../lib/env/server";
import {
  createLlmJobEventHandler,
  createLlmJobSnapshotReader,
} from "../../../../../lib/llm-jobs/snapshot";

export const dynamic = "force-dynamic";

const reader =
  serverEnv.SUPABASE_URL && serverEnv.SUPABASE_SERVICE_ROLE_KEY
    ? createLlmJobSnapshotReader({
        supabaseUrl: serverEnv.SUPABASE_URL,
        serviceRoleKey: serverEnv.SUPABASE_SERVICE_ROLE_KEY,
      })
    : async () => null;

export const GET = createLlmJobEventHandler({ reader });
