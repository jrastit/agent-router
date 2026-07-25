export const discoveryFailureCodes = [
  "DISCOVERY_EMPTY",
  "DISCOVERY_STALE",
  "DISCOVERY_MALFORMED",
  "DISCOVERY_UNAVAILABLE",
] as const;

export type DiscoveryFailureCode = (typeof discoveryFailureCodes)[number];

export class DiscoveryError extends Error {
  constructor(
    readonly code: DiscoveryFailureCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "DiscoveryError";
  }
}
