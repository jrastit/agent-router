import { describe, expect, it, vi } from "vitest";

import type { PlannerResult } from "./planner";
import { persistPlannerResult } from "./persistence";

const result: PlannerResult = {
  requirement: {
    id: "req_1",
    capability: "summarize",
    privacyClass: "public",
    inputType: "text",
    outputType: "text",
  },
  decision: {
    id: "dec_1",
    jobId: "job_1",
    requirementId: "req_1",
    policyId: "pol_1",
    policyVersion: 2,
    selectedProviderId: "prv_1",
    selectedOfferId: "off_1",
    considered: [
      {
        providerId: "prv_1",
        offerId: "off_1",
        eligible: true,
        reasonCodes: [],
        modelScore: 91,
        rationale: "Good fit",
        rank: 1,
      },
    ],
    createdAt: "2026-07-25T12:00:00.000Z",
  },
  evidence: {
    requirementSource: "model",
    evaluationSource: "model",
    fallbackReasons: [],
  },
};

const policy = {
  id: "pol_1",
  version: 2,
  budget: { currency: "EUR", amountMinor: 100 },
  maxTransaction: { currency: "EUR", amountMinor: 50 },
  allowedPrivacyClasses: ["public" as const],
  requiredCapabilities: [],
};

describe("planner persistence", () => {
  it("sends complete evidence to the atomic Supabase workflow", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}"));

    await persistPlannerResult(
      {
        supabaseUrl: "https://project.supabase.co",
        serviceRoleKey: "server-secret",
        userAccessToken: "user-token",
        fetcher,
      },
      {
        result,
        policy,
        selectedQuoteId: "quo_1",
        idempotencyKey: "plan:job_1",
      },
    );

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, request] = fetcher.mock.calls[0]!;
    expect(url).toBe(
      "https://project.supabase.co/rest/v1/rpc/persist_planner_decision",
    );
    expect(request?.headers).toMatchObject({
      apikey: "server-secret",
      authorization: "Bearer user-token",
    });
    expect(JSON.parse(String(request?.body))).toMatchObject({
      target_job_id: "job_1",
      target_quote_id: "quo_1",
      considered: result.decision.considered,
      policy_snapshot: policy,
      evidence: result.evidence,
      request_key: "plan:job_1",
    });
  });

  it("reports only the HTTP status when persistence fails", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("database details", { status: 409 }));

    await expect(
      persistPlannerResult(
        {
          supabaseUrl: "https://project.supabase.co",
          serviceRoleKey: "server-secret",
          userAccessToken: "user-token",
          fetcher,
        },
        { result, policy, idempotencyKey: "plan:job_1" },
      ),
    ).rejects.toThrow("status 409");
  });
});
