import { z } from "zod";

const verificationResponseSchema = z.object({
  state: z.enum(["credited", "mirror_pending"]),
});
const submittedDepositSchema = z.object({ id: z.string().min(1) });

export async function verifySubmittedDeposit(
  depositId: string,
  accessToken: string,
  fetcher: typeof fetch = fetch,
): Promise<"credited" | "mirror_pending"> {
  const response = await fetcher(
    `/api/deposits/${encodeURIComponent(depositId)}/verify`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}` },
    },
  );
  if (!response.ok && response.status !== 202) {
    throw new Error(`Deposit verification failed (${response.status})`);
  }
  return verificationResponseSchema.parse(await response.json()).state;
}

export async function resumeSubmittedDeposits(
  config: { url: string; publishableKey: string },
  accessToken: string,
  fetcher: typeof fetch = fetch,
): Promise<{ credited: number; pending: number }> {
  const response = await fetcher(
    `${config.url.replace(/\/$/, "")}/rest/v1/deposits?select=id&state=in.(submitted,mirror_pending,mirror_verified)&order=created_at.asc&limit=10`,
    {
      headers: {
        apikey: config.publishableKey,
        authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(`Pending deposit recovery failed (${response.status})`);
  }
  const deposits = z.array(submittedDepositSchema).parse(await response.json());
  const result = { credited: 0, pending: 0 };
  for (const { id } of deposits) {
    const state = await verifySubmittedDeposit(id, accessToken, fetcher);
    if (state === "credited") result.credited += 1;
    else result.pending += 1;
  }
  return result;
}
