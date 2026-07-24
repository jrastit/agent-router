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

describe("deterministic policy routing", () => {
  it("selects the lowest-priced eligible candidate regardless of input order", () => {
    const expensive = candidate("prv_expensive", 200, 100);
    const inexpensive = candidate("prv_inexpensive", 100, 500);
    const decide = (candidates: RoutingCandidate[]) =>
      makeRoutingDecision({
        decisionId: "dec_1",
        jobId: "job_1",
        requirement,
        policy,
        candidates,
        evaluatedAt,
      });

    expect(decide([expensive, inexpensive]).selectedProviderId).toBe(
      "prv_inexpensive",
    );
    expect(decide([inexpensive, expensive]).selectedProviderId).toBe(
      "prv_inexpensive",
    );
  });
});
