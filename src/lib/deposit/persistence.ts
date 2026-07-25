import { z } from "zod";

import { depositIntentSchema, type DepositIntent } from "./deposit";

const depositIntentRowSchema = z.strictObject({
  id: z.string().min(1),
  version: z.literal("1"),
  user_id: z.string().uuid(),
  payer_account: z.string(),
  treasury_account: z.string(),
  network: z.literal("testnet"),
  amount_tinybar: z.union([z.string(), z.number().int().positive()]),
  memo: z.string(),
  expires_at: z.string(),
  idempotency_key: z.string(),
  created_at: z.string(),
});

export class DepositPersistenceError extends Error {
  constructor(
    readonly operation: "create intent" | "submit proof",
    readonly status: number,
  ) {
    super(`Deposit ${operation} failed with status ${status}`);
    this.name = "DepositPersistenceError";
  }
}

export type AuthenticatedDepositPersistenceConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
  userAccessToken: string;
  fetcher?: typeof fetch;
};

async function callRpc(
  config: AuthenticatedDepositPersistenceConfig,
  functionName: string,
  body: Record<string, unknown>,
  operation: DepositPersistenceError["operation"],
): Promise<unknown> {
  const response = await (config.fetcher ?? fetch)(
    `${config.supabaseUrl}/rest/v1/rpc/${functionName}`,
    {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        authorization: `Bearer ${config.userAccessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok) {
    throw new DepositPersistenceError(operation, response.status);
  }
  return response.json();
}

export async function persistDepositIntent(
  config: AuthenticatedDepositPersistenceConfig,
  input: {
    id: string;
    payerAccount: string;
    treasuryAccount: string;
    amountTinybars: string;
    memo: string;
    expiresAt: string;
    idempotencyKey: string;
  },
): Promise<DepositIntent> {
  const raw = await callRpc(
    config,
    "create_deposit_intent",
    {
      target_id: input.id,
      intent_version: "1",
      payer: input.payerAccount,
      treasury: input.treasuryAccount,
      target_network: "testnet",
      exact_tinybar: input.amountTinybars,
      bound_memo: input.memo,
      target_expiry: input.expiresAt,
      request_key: input.idempotencyKey,
    },
    "create intent",
  );
  const row = depositIntentRowSchema.parse(raw);
  return depositIntentSchema.parse({
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
  });
}

export async function persistDepositProof(
  config: AuthenticatedDepositPersistenceConfig,
  input: { depositId: string; transactionId: string },
): Promise<void> {
  await callRpc(
    config,
    "submit_deposit_proof",
    {
      target_deposit_id: input.depositId,
      submitted_proof: input.transactionId,
    },
    "submit proof",
  );
}
