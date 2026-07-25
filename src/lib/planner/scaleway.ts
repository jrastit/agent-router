import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export interface ScalewayGenAiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export function createScalewayModel(config: ScalewayGenAiConfig) {
  const scaleway = createOpenAICompatible({
    name: "scaleway",
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  });

  return scaleway.chatModel(config.model);
}
