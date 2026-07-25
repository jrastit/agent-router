import type { Policy } from "../domain/schema";
import type { PlannerResult } from "./planner";

export interface PersistPlannerResultInput {
  result: PlannerResult;
  policy: Policy;
  selectedQuoteId?: string;
  idempotencyKey: string;
}

export interface PlannerPersistenceConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
  userAccessToken: string;
  fetcher?: typeof fetch;
}

export async function persistPlannerResult(
  config: PlannerPersistenceConfig,
  input: PersistPlannerResultInput,
): Promise<void> {
  const fetcher = config.fetcher ?? fetch;
  const { decision, requirement, evidence } = input.result;
  const response = await fetcher(
    `${config.supabaseUrl}/rest/v1/rpc/persist_planner_decision`,
    {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        authorization: `Bearer ${config.userAccessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        target_job_id: decision.jobId,
        target_quote_id: input.selectedQuoteId ?? null,
        new_decision_id: decision.id,
        decision_requirement_id: requirement.id,
        requirement_capability: requirement.capability,
        requirement_privacy_class: requirement.privacyClass,
        requirement_input_type: requirement.inputType,
        requirement_output_type: requirement.outputType,
        decision_policy_id: decision.policyId,
        decision_policy_version: decision.policyVersion,
        selected_provider_id: decision.selectedProviderId ?? null,
        selected_offer_id: decision.selectedOfferId ?? null,
        considered: decision.considered,
        policy_snapshot: input.policy,
        evidence,
        request_key: input.idempotencyKey,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Planner persistence failed with status ${response.status}`,
    );
  }
}
