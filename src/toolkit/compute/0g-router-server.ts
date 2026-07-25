import "server-only";

import { serverEnv } from "../../lib/env/server";
import { ZgComputeError, ZgRouterComputeAdapter } from "./0g-router";

export function createLiveZgRouterComputeAdapter() {
  if (!serverEnv.G_API_KEY_PRIVATE) {
    throw new ZgComputeError(
      "ZG_COMPUTE_CONFIGURATION",
      "G_API_KEY_PRIVATE is required for live 0G Router inference",
    );
  }

  return new ZgRouterComputeAdapter({
    apiKey: serverEnv.G_API_KEY_PRIVATE,
    baseUrl: serverEnv.ZG_ROUTER_BASE_URL,
    maxAttempts: serverEnv.ZG_COMPUTE_MAX_ATTEMPTS,
    timeoutMs: serverEnv.ZG_COMPUTE_TIMEOUT_MS,
  });
}
