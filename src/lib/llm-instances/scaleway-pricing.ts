export const SCALEWAY_PRICING_SOURCE =
  "https://www.scaleway.com/en/pricing/model-as-a-service/";

export const SCALEWAY_PRICING_REVIEWED_ON = "2026-07-26";

export type ScalewayPricing = {
  inputPriceEurPerMillionTokens: string | null;
  outputPriceEurPerMillionTokens: string | null;
  alternateUnit?: {
    inputPriceEur: string;
    inputUnit: "audio_minute";
    outputPriceEur: string;
  };
};

export const SCALEWAY_PRICING_BY_MODEL = {
  "bge-multilingual-gemma2": {
    inputPriceEurPerMillionTokens: "0.10",
    outputPriceEurPerMillionTokens: "0",
  },
  "devstral-2-123b-instruct-2512": {
    inputPriceEurPerMillionTokens: "0.40",
    outputPriceEurPerMillionTokens: "2.00",
  },
  "gemma-3-27b-it": {
    inputPriceEurPerMillionTokens: "0.25",
    outputPriceEurPerMillionTokens: "0.50",
  },
  "gemma-4-26b-a4b-it": {
    inputPriceEurPerMillionTokens: "0.25",
    outputPriceEurPerMillionTokens: "0.50",
  },
  "glm-5.2": {
    inputPriceEurPerMillionTokens: "1.80",
    outputPriceEurPerMillionTokens: "5.50",
  },
  "gpt-oss-120b": {
    inputPriceEurPerMillionTokens: "0.15",
    outputPriceEurPerMillionTokens: "0.60",
  },
  "holo2-30b-a3b": {
    inputPriceEurPerMillionTokens: "0.30",
    outputPriceEurPerMillionTokens: "0.70",
  },
  "llama-3.3-70b-instruct": {
    inputPriceEurPerMillionTokens: "0.90",
    outputPriceEurPerMillionTokens: "0.90",
  },
  "mistral-medium-3.5-128b": {
    inputPriceEurPerMillionTokens: "1.50",
    outputPriceEurPerMillionTokens: "7.50",
  },
  "mistral-small-3.2-24b-instruct-2506": {
    inputPriceEurPerMillionTokens: "0.15",
    outputPriceEurPerMillionTokens: "0.35",
  },
  "pixtral-12b-2409": {
    inputPriceEurPerMillionTokens: "0.20",
    outputPriceEurPerMillionTokens: "0.20",
  },
  "qwen3-235b-a22b-instruct-2507": {
    inputPriceEurPerMillionTokens: "0.75",
    outputPriceEurPerMillionTokens: "2.25",
  },
  "qwen3-coder-30b-a3b-instruct": {
    inputPriceEurPerMillionTokens: "0.20",
    outputPriceEurPerMillionTokens: "0.80",
  },
  "qwen3-embedding-8b": {
    inputPriceEurPerMillionTokens: "0.10",
    outputPriceEurPerMillionTokens: "0",
  },
  "qwen3.5-397b-a17b": {
    inputPriceEurPerMillionTokens: "0.60",
    outputPriceEurPerMillionTokens: "3.60",
  },
  "qwen3.6-35b-a3b": {
    inputPriceEurPerMillionTokens: "0.25",
    outputPriceEurPerMillionTokens: "1.50",
  },
  "voxtral-small-24b-2507": {
    inputPriceEurPerMillionTokens: "0.15",
    outputPriceEurPerMillionTokens: "0.35",
  },
  "whisper-large-v3": {
    inputPriceEurPerMillionTokens: null,
    outputPriceEurPerMillionTokens: null,
    alternateUnit: {
      inputPriceEur: "0.003",
      inputUnit: "audio_minute",
      outputPriceEur: "0",
    },
  },
} as const satisfies Record<string, ScalewayPricing>;

export function scalewayPricingForModel(
  modelId: string,
): ScalewayPricing | undefined {
  return (
    SCALEWAY_PRICING_BY_MODEL as Record<string, ScalewayPricing | undefined>
  )[modelId];
}
