import { describe, expect, it } from "vitest";

import { calculateActualLlmCharge, estimateMaximumLlmCharge } from "./pricing";

describe("exact LLM job pricing", () => {
  it("rounds each token component upward without floating point", () => {
    expect(
      estimateMaximumLlmCharge({
        maximumInputTokens: 1,
        maximumOutputTokens: 1,
        inputTinybarsPerMillionTokens: "1",
        outputTinybarsPerMillionTokens: "1",
      }),
    ).toBe("2");
  });

  it("retains exact values beyond JavaScript's safe integer range", () => {
    expect(
      calculateActualLlmCharge({
        promptTokens: 1_000_000,
        completionTokens: 1_000_000,
        inputTinybarsPerMillionTokens: "9007199254740993",
        outputTinybarsPerMillionTokens: "9007199254740993",
      }),
    ).toBe("18014398509481986");
  });

  it("rejects decimal or negative price strings", () => {
    expect(() =>
      estimateMaximumLlmCharge({
        maximumInputTokens: 10,
        maximumOutputTokens: 10,
        inputTinybarsPerMillionTokens: "0.1",
        outputTinybarsPerMillionTokens: "-1",
      }),
    ).toThrow();
  });
});
