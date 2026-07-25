import "server-only";

import { serverEnv } from "../env/server";
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
