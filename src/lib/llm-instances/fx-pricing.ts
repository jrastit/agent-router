const decimalPattern = /^(0|[1-9]\d*)(?:\.(\d+))?$/;
const outputScale = BigInt("1000000");
const oneMillionTokens = BigInt("1000000");

export function deriveEurPerMillionTokens(input: {
  eurPerToken?: string;
  usdPerToken?: string;
  usdPerEur?: string;
}): string | undefined {
  if (input.eurPerToken !== undefined) {
    const eur = parseDecimal(input.eurPerToken, "EUR token price");
    return formatSixDecimals(
      divideRounded(
        eur.numerator * oneMillionTokens * outputScale,
        eur.denominator,
      ),
    );
  }
  if (input.usdPerToken === undefined || input.usdPerEur === undefined) {
    return undefined;
  }
  const usd = parseDecimal(input.usdPerToken, "USD token price");
  const rate = parseDecimal(input.usdPerEur, "USD per EUR rate");
  if (rate.numerator === BigInt(0)) {
    throw new Error("USD per EUR rate must be positive");
  }
  return formatSixDecimals(
    divideRounded(
      usd.numerator * oneMillionTokens * outputScale * rate.denominator,
      usd.denominator * rate.numerator,
    ),
  );
}

export function parseEcbUsdReferenceRate(xml: string): {
  usdPerEur: string;
  observedOn: string;
} {
  const observedOn = xml.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/)?.[1];
  const usdPerEur = xml.match(
    /currency=['"]USD['"]\s+rate=['"]([0-9]+(?:\.[0-9]+)?)['"]/,
  )?.[1];
  if (!observedOn || !usdPerEur) {
    throw new Error("ECB USD reference rate is unavailable");
  }
  parseDecimal(usdPerEur, "ECB USD per EUR rate");
  return { usdPerEur, observedOn };
}

function parseDecimal(value: string, label: string) {
  const match = value.match(decimalPattern);
  if (!match) throw new Error(`${label} must be an exact non-negative decimal`);
  const fraction = match[2] ?? "";
  return {
    numerator: BigInt(`${match[1]}${fraction}`),
    denominator: BigInt(10) ** BigInt(fraction.length),
  };
}

function divideRounded(numerator: bigint, denominator: bigint) {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder * BigInt(2) >= denominator ? quotient + BigInt(1) : quotient;
}

function formatSixDecimals(value: bigint) {
  const whole = value / outputScale;
  const fraction = (value % outputScale).toString().padStart(6, "0");
  return `${whole}.${fraction}`;
}
