import { z } from "zod";

import {
  depositIntentSchema,
  depositStateSchema,
  type DepositIntent,
  type DepositObserved,
} from "./deposit";

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

const depositRowSchema = z.object({
  state: depositStateSchema,
  transaction_proof: z.string().nullable(),
});

const creditAccountSchema = z.object({
  available_tinybar: z.union([z.string(), z.number().int()]),
  reserved_tinybar: z.union([z.string(), z.number().int()]),
  spent_tinybar: z.union([z.string(), z.number().int()]),
  refunded_tinybar: z.union([z.string(), z.number().int()]),
  reconciliation_tinybar: z.union([z.string(), z.number().int()]),
});

export class DepositVerificationPersistenceError extends Error {
  constructor(
    readonly operation: "load" | "credit",
    readonly status: number,
  ) {
    super(`Deposit verification ${operation} failed with status ${status}`);
    this.name = "DepositVerificationPersistenceError";
  }
}

export type DepositVerificationPersistenceConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
  userAccessToken: string;
  fetcher?: typeof fetch;
};

function userHeaders(config: DepositVerificationPersistenceConfig) {
  return {
    apikey: config.serviceRoleKey,
    authorization: `Bearer ${config.userAccessToken}`,
  };
}

export async function loadOwnedSubmittedDeposit(
  config: DepositVerificationPersistenceConfig,
  depositId: string,
): Promise<{ intent: DepositIntent; transactionId: string }> {
  const fetcher = config.fetcher ?? fetch;
  const queryId = encodeURIComponent(depositId);
  const [intentResponse, depositResponse] = await Promise.all([
    fetcher(
      `${config.supabaseUrl}/rest/v1/deposit_intents?select=*&id=eq.${queryId}`,
      {
        headers: userHeaders(config),
        signal: AbortSignal.timeout(15_000),
      },
    ),
    fetcher(
      `${config.supabaseUrl}/rest/v1/deposits?select=state,transaction_proof&id=eq.${queryId}`,
      {
        headers: userHeaders(config),
        signal: AbortSignal.timeout(15_000),
      },
    ),
  ]);
  if (!intentResponse.ok || !depositResponse.ok) {
    throw new DepositVerificationPersistenceError(
      "load",
      !intentResponse.ok ? intentResponse.status : depositResponse.status,
    );
  }
  const intentRow = intentRowSchema.parse(
    z
      .array(z.unknown())
      .length(1)
      .parse(await intentResponse.json())[0],
  );
  const depositRow = depositRowSchema.parse(
    z
      .array(z.unknown())
      .length(1)
      .parse(await depositResponse.json())[0],
  );
  if (
    !depositRow.transaction_proof ||
    !["submitted", "mirror_pending", "mirror_verified", "credited"].includes(
      depositRow.state,
    )
  ) {
    throw new DepositVerificationPersistenceError("load", 409);
  }

  return {
    intent: depositIntentSchema.parse({
      version: intentRow.version,
      id: intentRow.id,
      userId: intentRow.user_id,
      payerAccount: intentRow.payer_account,
      treasuryAccount: intentRow.treasury_account,
      network: intentRow.network,
      amountTinybars: String(intentRow.amount_tinybar),
      memo: intentRow.memo,
      expiresAt: new Date(intentRow.expires_at).toISOString(),
      idempotencyKey: intentRow.idempotency_key,
    }),
    transactionId: depositRow.transaction_proof,
  };
}

export async function creditVerifiedDeposit(
  config: DepositVerificationPersistenceConfig,
  input: {
    intent: DepositIntent;
    transactionId: string;
    consensusTimestamp: string;
    observed: DepositObserved;
  },
) {
  const response = await (config.fetcher ?? fetch)(
    `${config.supabaseUrl}/rest/v1/rpc/credit_verified_deposit_for_user`,
    {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        authorization: `Bearer ${config.serviceRoleKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        target_user_id: input.intent.userId,
        target_deposit_id: input.intent.id,
        expected_proof: input.transactionId,
        verified_consensus_timestamp: input.consensusTimestamp,
        verified_at: input.observed.verifiedAt,
        user_pseudonym: input.observed.userPseudonym,
        transaction_hash: input.observed.transactionHash,
        request_key: `credit:${input.intent.id}`,
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok) {
    throw new DepositVerificationPersistenceError("credit", response.status);
  }
  const account = creditAccountSchema.parse(await response.json());
  return {
    availableTinybars: String(account.available_tinybar),
    reservedTinybars: String(account.reserved_tinybar),
    spentTinybars: String(account.spent_tinybar),
    refundedTinybars: String(account.refunded_tinybar),
    reconciliationTinybars: String(account.reconciliation_tinybar),
  };
}
