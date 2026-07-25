import { describe, expect, it } from "vitest";

import type { ModelRoute } from "./contracts";
import { DeterministicModelRouter } from "./router";

function route(
  id: string,
  inputAmount: string,
  privacy: ModelRoute["privacy"],
): ModelRoute {
  return {
    id,
    providerAddress: `provider-${id}`,
    model: `model-${id}`,
    capability: "chat",
    privacy,
    expectedLatencyMs: id === "fast" ? 100 : 500,
    price: {
      currency: "0G",
      inputAmount,
      outputAmount: "1",
      unit: "million-tokens",
    },
    provenance: {
      network: "0g-mainnet",
      endpoint: "https://router-api.0g.ai/v1",
      verification: "provider-address",
    },
  };
}

describe("DeterministicModelRouter", () => {
  const router = new DeterministicModelRouter();
  const routes = [
    route("public", "0.0009", "public"),
    route("private", "0.001", "confidential"),
  ];

  it("selects the exact-decimal cheapest route", () => {
    expect(router.select(routes, {}).selected.id).toBe("public");
  });

  it("changes selection when confidentiality policy changes", () => {
    const decision = router.select(routes, { requireConfidential: true });

    expect(decision.selected.id).toBe("private");
    expect(decision.excluded[0]?.reasons).toContain("confidentiality-required");
  });

  it("fails closed when no route satisfies the budget", () => {
    expect(() =>
      router.select(routes, { maximumInputAmount: "0.0001" }),
    ).toThrow("No model route satisfies the routing policy");
  });
});
