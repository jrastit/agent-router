const postgresBigintMaximum = BigInt("9223372036854775807");

export function parseExactTinybarRate(
  name: string,
  value: string | undefined,
): string {
  if (!value || !/^(0|[1-9]\d*)$/.test(value)) {
    throw new Error(`${name} must be a non-negative bigint integer`);
  }
  const parsed = BigInt(value);
  if (parsed > postgresBigintMaximum) {
    throw new Error(`${name} must fit a PostgreSQL bigint`);
  }
  return parsed.toString();
}
