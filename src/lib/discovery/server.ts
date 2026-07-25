import "server-only";

import { serverEnv } from "../env/server";
import { createDiscoveryAdapter } from "./create-adapter";

export function createServerDiscoveryAdapter() {
  if (serverEnv.DISCOVERY_SOURCE === "fixture") {
    return createDiscoveryAdapter({ source: "fixture" });
  }

  if (
    !serverEnv.GRAPH_ENDPOINT ||
    !serverEnv.GRAPH_DEPLOYMENT_ID ||
    !serverEnv.GRAPH_NETWORK
  ) {
    throw new Error(
      "Live discovery requires GRAPH_ENDPOINT, GRAPH_DEPLOYMENT_ID, and GRAPH_NETWORK",
    );
  }

  return createDiscoveryAdapter({
    source: "the-graph",
    endpoint: serverEnv.GRAPH_ENDPOINT,
    deploymentId: serverEnv.GRAPH_DEPLOYMENT_ID,
    network: serverEnv.GRAPH_NETWORK,
    maxStalenessMs: serverEnv.GRAPH_MAX_STALENESS_MS,
    accessToken: serverEnv.GRAPH_ACCESS_TOKEN,
  });
}
