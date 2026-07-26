import { describe, expect, it } from "vitest";

import { estimateAgentPerformanceScore } from "./performance-score";

describe("agent performance estimate", () => {
  it("scores complete healthy chat routes higher than unavailable routes", () => {
    expect(
      estimateAgentPerformanceScore({
        enabled: true,
        capabilities: ["chat"],
        hasExactPrices: true,
        healthyProviderCount: 2,
        expectedLatencyMs: 500,
      }),
    ).toBe(99);
    expect(
      estimateAgentPerformanceScore({
        enabled: false,
        capabilities: ["chat"],
        hasExactPrices: false,
        healthyProviderCount: 0,
        expectedLatencyMs: 5000,
      }),
    ).toBe(50);
  });

  it("clamps route and latency contributions to the 0-100 range", () => {
    expect(
      estimateAgentPerformanceScore({
        enabled: true,
        capabilities: ["chat"],
        hasExactPrices: true,
        healthyProviderCount: 100,
        expectedLatencyMs: 0,
      }),
    ).toBe(100);
  });
});
