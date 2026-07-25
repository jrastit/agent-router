import type { DiscoveryResult } from "./schema";

export interface DiscoveryQuery {
  jobId: string;
  capability: string;
  inputType: string;
  outputType: string;
  now: string;
}

export interface DiscoveryAdapter {
  discover(query: DiscoveryQuery): Promise<DiscoveryResult>;
}
