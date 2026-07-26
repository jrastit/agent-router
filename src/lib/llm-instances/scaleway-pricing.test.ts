import { describe, expect, it } from "vitest";

import {
  SCALEWAY_PRICING_BY_MODEL,
  scalewayPricingForModel,
} from "./scaleway-pricing";

describe("Scaleway pricing", () => {
  it("records exact input and output token prices for the token-priced catalog", () => {
    const tokenPrices = Object.values(SCALEWAY_PRICING_BY_MODEL).filter(
      (price) => price.inputPriceEurPerMillionTokens !== null,
    );

    expect(tokenPrices).toHaveLength(17);
    for (const price of tokenPrices) {
      expect(price.inputPriceEurPerMillionTokens).toMatch(/^\d+(\.\d+)?$/);
      expect(price.outputPriceEurPerMillionTokens).toMatch(/^\d+(\.\d+)?$/);
    }
  });

  it("keeps Whisper's per-minute price out of token price columns", () => {
    expect(scalewayPricingForModel("whisper-large-v3")).toEqual({
      inputPriceEurPerMillionTokens: null,
      outputPriceEurPerMillionTokens: null,
      alternateUnit: {
        inputPriceEur: "0.003",
        inputUnit: "audio_minute",
        outputPriceEur: "0",
      },
    });
  });

  it("does not guess prices for unknown model identifiers", () => {
    expect(scalewayPricingForModel("future-model")).toBeUndefined();
  });
});
