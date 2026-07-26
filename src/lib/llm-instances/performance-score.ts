export const PERFORMANCE_SCORE_BASIS = "catalog-readiness-v1";

export function estimateAgentPerformanceScore(input: {
  enabled: boolean;
  capabilities: readonly string[];
  hasExactPrices: boolean;
  healthyProviderCount: number;
  expectedLatencyMs: number;
}) {
  const latencyPoints = Math.max(
    0,
    10 - Math.floor(input.expectedLatencyMs / 500),
  );
  const routePoints = Math.min(10, input.healthyProviderCount * 5);
  return Math.min(
    100,
    40 +
      (input.enabled ? 20 : 0) +
      (input.capabilities.includes("chat") ? 10 : 0) +
      (input.hasExactPrices ? 10 : 0) +
      routePoints +
      latencyPoints,
  );
}
