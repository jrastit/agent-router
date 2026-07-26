import { z } from "zod";

const exactIntegerSchema = z.string().regex(/^(0|[1-9][0-9]*)$/);
const entryKindSchema = z.enum([
  "deposit",
  "reservation",
  "charge",
  "refund",
  "release",
  "reconciliation",
]);
const fundActivityRowSchema = z.strictObject({
  available_tinybars: exactIntegerSchema,
  reserved_tinybars: exactIntegerSchema,
  spent_tinybars: exactIntegerSchema,
  refunded_tinybars: exactIntegerSchema,
  reconciliation_tinybars: exactIntegerSchema,
  account_updated_at: z.string().datetime({ offset: true }),
  journal_id: z
    .string()
    .regex(/^[1-9][0-9]*$/)
    .nullable(),
  entry_kind: entryKindSchema.nullable(),
  amount_tinybars: exactIntegerSchema.nullable(),
  deposit_id: z.string().nullable(),
  transaction_proof: z.string().nullable(),
  entry_created_at: z.string().datetime({ offset: true }).nullable(),
});

export type FundActivityEntry = {
  id: string;
  kind: z.infer<typeof entryKindSchema>;
  amountTinybars: string;
  depositId?: string;
  transactionId?: string;
  createdAt: string;
};

export type FundActivity = {
  availableTinybars: string;
  reservedTinybars: string;
  spentTinybars: string;
  refundedTinybars: string;
  reconciliationTinybars: string;
  updatedAt?: string;
  entries: FundActivityEntry[];
};

export const realtimeFundTables = [
  "credit_accounts",
  "credit_journal",
  "deposits",
  "credit_reservations",
] as const;

type FundRealtimeChannel = {
  on(
    event: "postgres_changes",
    filter: {
      event: "*";
      schema: "public";
      table: (typeof realtimeFundTables)[number];
      filter: string;
    },
    callback: () => void,
  ): FundRealtimeChannel;
  subscribe(callback: (status: string) => void): FundRealtimeChannel;
};

export type FundRealtimeClient = {
  channel(name: string): FundRealtimeChannel;
  removeChannel(channel: FundRealtimeChannel): Promise<unknown>;
};

const emptyActivity: FundActivity = {
  availableTinybars: "0",
  reservedTinybars: "0",
  spentTinybars: "0",
  refundedTinybars: "0",
  reconciliationTinybars: "0",
  entries: [],
};

export function parseFundActivity(payload: unknown): FundActivity {
  const rows = z.array(fundActivityRowSchema).parse(payload);
  const account = rows[0];
  if (!account) return emptyActivity;

  return {
    availableTinybars: account.available_tinybars,
    reservedTinybars: account.reserved_tinybars,
    spentTinybars: account.spent_tinybars,
    refundedTinybars: account.refunded_tinybars,
    reconciliationTinybars: account.reconciliation_tinybars,
    updatedAt: account.account_updated_at,
    entries: rows.flatMap((row) =>
      row.journal_id &&
      row.entry_kind &&
      row.amount_tinybars &&
      row.entry_created_at
        ? [
            {
              id: row.journal_id,
              kind: row.entry_kind,
              amountTinybars: row.amount_tinybars,
              ...(row.deposit_id ? { depositId: row.deposit_id } : {}),
              ...(row.transaction_proof
                ? { transactionId: row.transaction_proof }
                : {}),
              createdAt: row.entry_created_at,
            },
          ]
        : [],
    ),
  };
}

export async function loadFundActivity(
  config: { url: string; publishableKey: string; accessToken: string },
  fetchImpl: typeof fetch = fetch,
): Promise<FundActivity> {
  const response = await fetchImpl(
    `${config.url.replace(/\/$/, "")}/rest/v1/rpc/get_my_fund_activity`,
    {
      method: "POST",
      headers: {
        apikey: config.publishableKey,
        authorization: `Bearer ${config.accessToken}`,
        "content-type": "application/json",
      },
      body: "{}",
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(`Fund activity request failed (${response.status})`);
  }
  return parseFundActivity(await response.json());
}

export function authenticatedUserId(accessToken: string): string {
  const payload = accessToken.split(".")[1];
  if (!payload) throw new TypeError("Invalid account session");
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = JSON.parse(
    atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")),
  ) as unknown;
  return z.object({ sub: z.string().uuid() }).parse(decoded).sub;
}

export function subscribeToFundActivity(
  client: FundRealtimeClient,
  userId: string,
  onChange: () => void,
  onStatus: (status: string) => void,
): () => void {
  const channel = client.channel(`fund-activity:${userId}`);
  for (const table of realtimeFundTables) {
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
        filter: `user_id=eq.${userId}`,
      },
      onChange,
    );
  }
  channel.subscribe(onStatus);
  return () => {
    void client.removeChannel(channel);
  };
}
