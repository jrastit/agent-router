import type {
  ModelRoute,
  ModelRouter,
  RoutingDecision,
  RoutingPolicy,
} from "./contracts";

export class DeterministicModelRouter implements ModelRouter {
  select(
    routes: readonly ModelRoute[],
    policy: RoutingPolicy,
  ): RoutingDecision {
    const excluded: {
      route: ModelRoute;
      reasons: readonly string[];
    }[] = [];
    const candidates: ModelRoute[] = [];

    for (const route of routes) {
      const reasons = exclusionReasons(route, policy);
      if (reasons.length > 0) excluded.push({ route, reasons });
      else candidates.push(route);
    }
    candidates.sort(compareRoutes);
    if (!candidates[0]) {
      throw new Error("No model route satisfies the routing policy");
    }

    return {
      selected: candidates[0],
      candidates,
      excluded,
    };
  }
}

function exclusionReasons(route: ModelRoute, policy: RoutingPolicy): string[] {
  const reasons: string[] = [];
  if (policy.requireConfidential && route.privacy !== "confidential") {
    reasons.push("confidentiality-required");
  }
  if (
    policy.maximumLatencyMs !== undefined &&
    route.expectedLatencyMs > policy.maximumLatencyMs
  ) {
    reasons.push("latency-exceeds-maximum");
  }
  if (
    policy.maximumInputAmount !== undefined &&
    compareDecimal(route.price.inputAmount, policy.maximumInputAmount) > 0
  ) {
    reasons.push("input-price-exceeds-maximum");
  }
  if (
    policy.maximumOutputAmount !== undefined &&
    compareDecimal(route.price.outputAmount, policy.maximumOutputAmount) > 0
  ) {
    reasons.push("output-price-exceeds-maximum");
  }
  return reasons;
}

function compareRoutes(left: ModelRoute, right: ModelRoute): number {
  return (
    compareDecimal(left.price.inputAmount, right.price.inputAmount) ||
    compareDecimal(left.price.outputAmount, right.price.outputAmount) ||
    left.expectedLatencyMs - right.expectedLatencyMs ||
    left.id.localeCompare(right.id)
  );
}

function compareDecimal(left: string, right: string): number {
  const normalizedLeft = normalizeDecimal(left);
  const normalizedRight = normalizeDecimal(right);
  const scale = Math.max(
    normalizedLeft.fraction.length,
    normalizedRight.fraction.length,
  );
  const leftDigits =
    `${normalizedLeft.integer}${normalizedLeft.fraction.padEnd(scale, "0")}`.replace(
      /^0+(?=\d)/,
      "",
    );
  const rightDigits =
    `${normalizedRight.integer}${normalizedRight.fraction.padEnd(scale, "0")}`.replace(
      /^0+(?=\d)/,
      "",
    );
  return (
    leftDigits.length - rightDigits.length ||
    leftDigits.localeCompare(rightDigits)
  );
}

function normalizeDecimal(value: string): {
  integer: string;
  fraction: string;
} {
  if (!/^\d+(?:\.\d+)?$/.test(value)) {
    throw new Error(`Invalid exact decimal amount: ${value}`);
  }
  const [integer = "0", fraction = ""] = value.split(".");
  return {
    integer: integer.replace(/^0+(?=\d)/, ""),
    fraction: fraction.replace(/0+$/, ""),
  };
}
