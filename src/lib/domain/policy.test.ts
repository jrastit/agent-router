import { describe, expect, it } from "vitest";

import type { RoutingCandidate } from "./policy";
import { makeRoutingDecision } from "./policy";
import type { Policy, Requirement } from "./schema";

const evaluatedAt = "2026-07-25T12:00:00.000Z";
const requirement: Requirement = {
  id: "req_1",
  capability: "summarize",
  privacyClass: "public",
  inputType: "text",
  outputType: "text",
};
const policy: Policy = {
  id: "pol_1",
  version: 1,
  budget: { currency: "EUR", amountMinor: 500 },
  maxTransaction: { currency: "EUR", amountMinor: 300 },
  allowedPrivacyClasses: ["public"],
  requiredCapabilities: [],
};

function candidate(
  providerId: string,
  amountMinor: number,
  expectedLatencyMs: number,
): RoutingCandidate {
  const offerId = `off_${providerId}`;
  return {
    provider: {
      id: providerId,
      name: providerId,
      capabilities: ["summarize"],
      privacyClasses: ["public"],
      settlementAccount: "0.0.1001",
    },
    offer: {
      id: offerId,
      providerId,
      capability: "summarize",
      inputType: "text",
      outputType: "text",
      price: { currency: "EUR", amountMinor },
      expectedLatencyMs,
    },
    quote: {
      id: `quo_${providerId}`,
      jobId: "job_1",
      offerId,
      price: { currency: "EUR", amountMinor },
      expiresAt: "2026-07-25T13:00:00.000Z",
    },
  };
}

function decide(
  candidates: RoutingCandidate[],
  overrides: Partial<{
    requirement: Requirement;
    policy: Policy;
    evaluatedAt: string;
  }> = {},
) {
  return makeRoutingDecision({
    decisionId: "dec_1",
    jobId: "job_1",
    requirement: overrides.requirement ?? requirement,
    policy: overrides.policy ?? policy,
    candidates,
    evaluatedAt: overrides.evaluatedAt ?? evaluatedAt,
  });
}

describe("deterministic policy routing", () => {
  it("selects the lowest-priced eligible candidate regardless of input order", () => {
    const expensive = candidate("prv_expensive", 200, 100);
    const inexpensive = candidate("prv_inexpensive", 100, 500);

    expect(decide([expensive, inexpensive]).selectedProviderId).toBe(
      "prv_inexpensive",
    );
    expect(decide([inexpensive, expensive]).selectedProviderId).toBe(
      "prv_inexpensive",
    );
  });

  it("excludes candidates outside the budget or transaction limit", () => {
    const overLimit = candidate("prv_over_limit", 301, 100);
    const decision = decide([overLimit]);

    expect(decision.selectedProviderId).toBeUndefined();
    expect(decision.considered[0]).toMatchObject({
      eligible: false,
      reasonCodes: ["BUDGET_EXCEEDED"],
    });
  });

  it("requires private execution for confidential requirements", () => {
    const standard = candidate("prv_standard", 100, 100);
    const confidentialRequirement: Requirement = {
      ...requirement,
      privacyClass: "confidential",
    };
    const confidentialPolicy: Policy = {
      ...policy,
      allowedPrivacyClasses: ["confidential"],
    };
    const decision = decide([standard], {
      requirement: confidentialRequirement,
      policy: confidentialPolicy,
    });

    expect(decision.considered[0]?.reasonCodes).toEqual([
      "PRIVATE_COMPUTE_REQUIRED",
    ]);
  });

  it("requires every policy and task capability", () => {
    const incomplete = candidate("prv_incomplete", 100, 100);
    const decision = decide([incomplete], {
      policy: { ...policy, requiredCapabilities: ["structured-output"] },
    });

    expect(decision.considered[0]?.reasonCodes).toEqual([
      "CAPABILITY_REQUIRED",
    ]);
  });

  it("treats a quote expiring at evaluation time as expired", () => {
    const expired = candidate("prv_expired", 100, 100);
    expired.quote.expiresAt = evaluatedAt;
    const decision = decide([expired]);

    expect(decision.considered[0]?.reasonCodes).toEqual(["QUOTE_EXPIRED"]);
  });

  it("breaks equal-price ties by latency, provider ID, then offer ID", () => {
    const slow = candidate("prv_slow", 100, 200);
    const fast = candidate("prv_fast", 100, 100);
    expect(decide([slow, fast]).selectedProviderId).toBe("prv_fast");

    const providerB = candidate("prv_b", 100, 100);
    const providerA = candidate("prv_a", 100, 100);
    expect(decide([providerB, providerA]).selectedProviderId).toBe("prv_a");

    const offerB = candidate("prv_same", 100, 100);
    offerB.offer.id = "off_b";
    offerB.quote.offerId = "off_b";
    const offerA = structuredClone(offerB);
    offerA.offer.id = "off_a";
    offerA.quote.id = "quo_a";
    offerA.quote.offerId = "off_a";
    expect(decide([offerB, offerA]).selectedOfferId).toBe("off_a");
  });

  it("changes a schema-valid decision when policy and provider data change", () => {
    const standard = candidate("prv_standard", 100, 100);
    const privateProvider = candidate("prv_private", 200, 100);
    privateProvider.provider.privacyClasses.push("confidential");
    const publicDecision = decide([standard, privateProvider]);

    const confidentialDecision = decide([standard, privateProvider], {
      requirement: { ...requirement, privacyClass: "confidential" },
      policy: { ...policy, allowedPrivacyClasses: ["confidential"] },
    });

    expect(publicDecision.selectedProviderId).toBe("prv_standard");
    expect(confidentialDecision.selectedProviderId).toBe("prv_private");
  });
});
