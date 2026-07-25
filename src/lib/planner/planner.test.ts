import { describe, expect, it, vi } from "vitest";

import type { Policy } from "../domain/schema";
import type { RoutingCandidate } from "../domain/policy";
import type { StructuredGenerator } from "./generate";
import { planRoute } from "./planner";

const policy: Policy = {
  id: "pol_1",
  version: 3,
  budget: { currency: "EUR", amountMinor: 100 },
  maxTransaction: { currency: "EUR", amountMinor: 100 },
  allowedPrivacyClasses: ["public"],
  requiredCapabilities: [],
};

function candidate(providerId: string, amountMinor: number): RoutingCandidate {
  const offerId = `off_${providerId}`;
  return {
    provider: {
      id: providerId,
      name: providerId,
      capabilities: ["summarize"],
      privacyClasses: ["public"],
      settlementAccount: "0.0.123",
    },
    offer: {
      id: offerId,
      providerId,
      capability: "summarize",
      inputType: "text",
      outputType: "text",
      price: { currency: "EUR", amountMinor },
      expectedLatencyMs: 500,
    },
    quote: {
      id: `quo_${providerId}`,
      jobId: "job_1",
      offerId,
      price: { currency: "EUR", amountMinor },
      expiresAt: "2026-07-25T12:10:00.000Z",
    },
  };
}

const candidates = [candidate("expensive", 80), candidate("cheap", 20)];

function input() {
  return {
    jobId: "job_1",
    decisionId: "dec_1",
    requirementId: "req_1",
    objective: "Summarize this public text",
    fallbackRequirement: {
      capability: "summarize",
      privacyClass: "public" as const,
      inputType: "text",
      outputType: "text",
    },
    policy,
    candidates,
    evaluatedAt: "2026-07-25T12:00:00.000Z",
    timeoutMs: 50,
  };
}

describe("planner", () => {
  it("uses typed model output while deterministic policy owns selection", async () => {
    const generate = vi
      .fn<StructuredGenerator>()
      .mockResolvedValueOnce({
        capability: "summarize",
        privacyClass: "public",
        inputType: "text",
        outputType: "text",
      })
      .mockResolvedValueOnce({
        assessments: [
          {
            offerId: "off_expensive",
            score: 100,
            rationale: "Model prefers this provider",
          },
          {
            offerId: "off_cheap",
            score: 1,
            rationale: "Model dislikes this provider",
          },
        ],
      });

    const result = await planRoute(
      input(),
      generate as unknown as StructuredGenerator,
    );

    expect(result.decision.selectedProviderId).toBe("cheap");
    expect(result.decision.policyVersion).toBe(3);
    expect(result.decision.considered).toEqual([
      expect.objectContaining({ offerId: "off_expensive", modelScore: 100 }),
      expect.objectContaining({ offerId: "off_cheap", modelScore: 1, rank: 1 }),
    ]);
    expect(result.evidence).toEqual({
      requirementSource: "model",
      evaluationSource: "model",
      fallbackReasons: [],
    });
  });

  it("falls back on extraction timeout and incomplete evaluations", async () => {
    const generate = vi
      .fn<StructuredGenerator>()
      .mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"))
      .mockResolvedValueOnce({
        assessments: [
          { offerId: "off_cheap", score: 99, rationale: "Only one result" },
        ],
      });

    const result = await planRoute(
      input(),
      generate as unknown as StructuredGenerator,
    );

    expect(result.requirement).toMatchObject(input().fallbackRequirement);
    expect(result.decision.selectedProviderId).toBe("cheap");
    expect(result.decision.considered).toEqual([
      expect.objectContaining({
        offerId: "off_expensive",
        rationale: expect.stringContaining("Deterministic fallback"),
      }),
      expect.objectContaining({ offerId: "off_cheap", rank: 1 }),
    ]);
    expect(result.evidence).toEqual({
      requirementSource: "fallback",
      evaluationSource: "fallback",
      fallbackReasons: ["requirement:TimeoutError", "evaluation:TypeError"],
    });
  });

  it("fails closed when the deterministic fallback requirement is invalid", async () => {
    const invalid = input();
    invalid.fallbackRequirement.capability = "";
    const generate = vi
      .fn<StructuredGenerator>()
      .mockRejectedValue(new Error("model unavailable"));

    await expect(
      planRoute(invalid, generate as unknown as StructuredGenerator),
    ).rejects.toThrow();
  });
});
