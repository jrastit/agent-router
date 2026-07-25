import { z } from "zod";

const accountIdSchema = z.string().regex(/^\d+\.\d+\.\d+$/);

export type HederaBalance = {
  accountId: string;
  balanceTinybars: string;
};

export async function fetchHederaBalance(
  mirrorNodeUrl: string,
  accountId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<HederaBalance> {
  const parsedAccountId = accountIdSchema.parse(accountId);
  const response = await fetchImpl(
    `${mirrorNodeUrl.replace(/\/$/, "")}/api/v1/accounts/${encodeURIComponent(parsedAccountId)}`,
    { headers: { accept: "application/json" } },
  );

  if (!response.ok) {
    throw new Error(`Mirror balance lookup failed (${response.status})`);
  }

  // Avoid rounding a tinybar integer beyond JavaScript's safe integer range.
  const body = await response.text();
  const balance = body.match(/"balance"\s*:\s*(-?\d+)/)?.[1];
  if (!balance || !/^\d+$/.test(balance)) {
    throw new Error("Mirror response did not contain a valid balance");
  }

  return { accountId: parsedAccountId, balanceTinybars: balance };
}

export function formatTinybarsAsHbar(tinybars: string): string {
  const padded = tinybars.padStart(9, "0");
  const whole = padded.slice(0, -8);
  const fraction = padded.slice(-8).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}
