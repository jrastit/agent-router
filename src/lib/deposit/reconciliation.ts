import { z } from "zod";

import { tinybarsToHbar } from "../payment/challenge";
import {
  fetchAndVerifyMirrorProof,
  MirrorVerificationError,
} from "../payment/mirror";
import {
  createDepositObserved,
  depositIntentSchema,
  verifyDepositProof,
  type DepositIntent,
} from "./deposit";
import { creditVerifiedDeposit } from "./verification-persistence";

const submittedDepositSchema = z.object({
  id: z.string(),
  transaction_proof: z.string().min(1),
});
const intentRowSchema = z.object({
  id: z.string(),
  version: z.literal("1"),
  user_id: z.string().uuid(),
  payer_account: z.string(),
  treasury_account: z.string(),
  network: z.literal("testnet"),
  amount_tinybar: z.union([z.string(), z.number().int()]),
  memo: z.string(),
  expires_at: z.string(),
  idempotency_key: z.string(),
});

export type SubmittedDepositReconciliationConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
  mirrorNodeUrl: string;
  pseudonymSalt: string;
  fetcher?: typeof fetch;
  now?: () => Date;
};

function serviceHeaders(config: SubmittedDepositReconciliationConfig) {
  return {
    apikey: config.serviceRoleKey,
    authorization: `Bearer ${config.serviceRoleKey}`,
  };
}

export async function loadSubmittedDeposits(
  config: SubmittedDepositReconciliationConfig,
): Promise<Array<{ intent: DepositIntent; transactionId: string }>> {
  const fetcher = config.fetcher ?? fetch;
  const base = config.supabaseUrl.replace(/\/$/, "");
  const [depositsResponse, intentsResponse] = await Promise.all([
    fetcher(
      `${base}/rest/v1/deposits?select=id,transaction_proof&state=in.(submitted,mirror_pending,mirror_verified,reconciliation_required)&transaction_proof=not.is.null`,
      { headers: serviceHeaders(config), signal: AbortSignal.timeout(15_000) },
    ),
    fetcher(`${base}/rest/v1/deposit_intents?select=*`, {
      headers: serviceHeaders(config),
      signal: AbortSignal.timeout(15_000),
    }),
  ]);
  if (!depositsResponse.ok || !intentsResponse.ok) {
    throw new Error("Unable to load submitted deposits for reconciliation");
  }
  const deposits = z
    .array(submittedDepositSchema)
    .parse(await depositsResponse.json());
  const intents = new Map(
    z
      .array(intentRowSchema)
      .parse(await intentsResponse.json())
      .map((row) => [
        row.id,
        depositIntentSchema.parse({
          version: row.version,
          id: row.id,
          userId: row.user_id,
          payerAccount: row.payer_account,
          treasuryAccount: row.treasury_account,
          network: row.network,
          amountTinybars: String(row.amount_tinybar),
          memo: row.memo,
          expiresAt: new Date(row.expires_at).toISOString(),
          idempotencyKey: row.idempotency_key,
        }),
      ]),
  );
  return deposits.map((deposit) => {
    const intent = intents.get(deposit.id);
    if (!intent) throw new Error("Submitted deposit intent is missing");
    return { intent, transactionId: deposit.transaction_proof };
  });
}

export async function reconcileSubmittedDeposits(
  config: SubmittedDepositReconciliationConfig,
): Promise<{ credited: number; pending: number; rejected: number }> {
  const submitted = await loadSubmittedDeposits(config);
  const result = { credited: 0, pending: 0, rejected: 0 };

  for (const { intent, transactionId } of submitted) {
    try {
      const challenge = {
        version: "1" as const,
        id: intent.id,
        quoteId: intent.id,
        payerAccount: intent.payerAccount,
        recipientAccount: intent.treasuryAccount,
        network: intent.network,
        asset: "HBAR" as const,
        amount: tinybarsToHbar(BigInt(intent.amountTinybars)),
        memo: intent.memo,
        expiresAt: intent.expiresAt,
      };
      const proof = await fetchAndVerifyMirrorProof(
        config.mirrorNodeUrl,
        transactionId,
        challenge,
        config.fetcher,
      );
      verifyDepositProof(intent, proof, transactionId);
      const observed = createDepositObserved({
        intent,
        transactionHash: transactionId,
        verifiedAt: config.now?.() ?? new Date(),
        pseudonymSalt: config.pseudonymSalt,
      });
      await creditVerifiedDeposit(
        {
          supabaseUrl: config.supabaseUrl,
          serviceRoleKey: config.serviceRoleKey,
          userAccessToken: config.serviceRoleKey,
          fetcher: config.fetcher,
        },
        {
          intent,
          transactionId,
          consensusTimestamp: proof.consensusTimestamp,
          observed,
        },
      );
      result.credited += 1;
    } catch (error) {
      if (
        error instanceof MirrorVerificationError &&
        error.code === "MIRROR_PENDING"
      ) {
        result.pending += 1;
      } else {
        result.rejected += 1;
      }
    }
  }
  return result;
}
