import { z } from "zod";

const exactIntegerSchema = z.string().regex(/^(0|[1-9]\d*)$/);

function ceilingTokenCharge(tokens: number, ratePerMillion: string) {
  z.number().int().nonnegative().parse(tokens);
  exactIntegerSchema.parse(ratePerMillion);
  return (
    (BigInt(tokens) * BigInt(ratePerMillion) + BigInt(999_999)) /
    BigInt(1_000_000)
  );
}

export function estimateMaximumLlmCharge(input: {
  maximumInputTokens: number;
  maximumOutputTokens: number;
  inputTinybarsPerMillionTokens: string;
  outputTinybarsPerMillionTokens: string;
}) {
  return (
    ceilingTokenCharge(
      input.maximumInputTokens,
      input.inputTinybarsPerMillionTokens,
    ) +
    ceilingTokenCharge(
      input.maximumOutputTokens,
      input.outputTinybarsPerMillionTokens,
    )
  ).toString();
}

export function calculateActualLlmCharge(input: {
  promptTokens: number;
  completionTokens: number;
  inputTinybarsPerMillionTokens: string;
  outputTinybarsPerMillionTokens: string;
}) {
  return (
    ceilingTokenCharge(
      input.promptTokens,
      input.inputTinybarsPerMillionTokens,
    ) +
    ceilingTokenCharge(
      input.completionTokens,
      input.outputTinybarsPerMillionTokens,
    )
  ).toString();
}
