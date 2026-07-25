import "server-only";

import { serverEnv } from "../env/server";
import { createAiSdkGenerator } from "./generate";
import { planRoute, type PlannerInput, type PlannerResult } from "./planner";
import { createScalewayModel } from "./scaleway";

export function getPlannerModel() {
  if (!serverEnv.SCALEWAY_GENAI_API_KEY) {
    throw new Error("SCALEWAY_GENAI_API_KEY is required to run the planner");
  }

  return createScalewayModel({
    apiKey: serverEnv.SCALEWAY_GENAI_API_KEY,
    baseUrl: serverEnv.SCALEWAY_GENAI_BASE_URL,
    model: serverEnv.SCALEWAY_GENAI_MODEL,
  });
}

export async function planRouteWithScaleway(
  input: Omit<PlannerInput, "timeoutMs"> & { timeoutMs?: number },
): Promise<PlannerResult> {
  const model = getPlannerModel();
  return planRoute(
    {
      ...input,
      timeoutMs: input.timeoutMs ?? serverEnv.PLANNER_TIMEOUT_MS,
    },
    createAiSdkGenerator(model),
  );
}
