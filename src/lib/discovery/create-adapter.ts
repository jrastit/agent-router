import type { DiscoveryAdapter } from "./adapter";
import { FixtureDiscoveryAdapter } from "./fixtures";
import { GraphDiscoveryAdapter } from "./graph";

export type DiscoveryAdapterConfig =
  | { source: "fixture" }
  | {
      source: "the-graph";
      endpoint: string;
      deploymentId: string;
      network: string;
      maxStalenessMs: number;
      accessToken?: string;
    };

export function createDiscoveryAdapter(
  config: DiscoveryAdapterConfig,
): DiscoveryAdapter {
  if (config.source === "fixture") {
    return new FixtureDiscoveryAdapter();
  }

  return new GraphDiscoveryAdapter(config);
}
