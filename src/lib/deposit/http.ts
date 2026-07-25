import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  DepositPersistenceError,
  persistDepositIntent,
  persistDepositProof,
} from "./persistence";
import { createUserSigningRequest } from "./workflow";

const intentRequestSchema = z.strictObject({
  payerAccount: z.string().regex(/^\d+\.\d+\.\d+$/),
  amountTinybars: z
    .string()
    .regex(/^[1-9]\d*$/)
    .refine((value) => BigInt(value) <= BigInt("9223372036854775807")),
});

const idempotencyKeySchema = z.string().min(8).max(200);

const proofRequestSchema = z.strictObject({
  transactionId: z.string().regex(/^\d+\.\d+\.\d+[@-]\d{10}\.\d{1,9}$/),
});

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  return authorization?.match(/^Bearer ([^\s]+)$/)?.[1] ?? null;
}

export function createDepositIntentHandler(input: {
  supabaseUrl?: string;
  serviceRoleKey?: string;
  treasuryAccount?: string;
  now?: () => Date;
  id?: () => string;
  fetcher?: typeof fetch;
}) {
  return async function POST(request: Request) {
    const userAccessToken = bearerToken(request);
    if (!userAccessToken) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }
    if (!input.supabaseUrl || !input.serviceRoleKey || !input.treasuryAccount) {
      return Response.json(
        { error: "Deposit service unavailable" },
        { status: 503 },
      );
    }

    const parsed = intentRequestSchema.safeParse(
      await request.json().catch(() => null),
    );
    const parsedIdempotencyKey = idempotencyKeySchema.safeParse(
      request.headers.get("idempotency-key"),
    );
    if (!parsed.success || !parsedIdempotencyKey.success) {
      return Response.json(
        { error: "Invalid deposit request" },
        { status: 400 },
      );
    }

    const id = input.id?.() ?? `deposit-${randomUUID()}`;
    const now = input.now?.() ?? new Date();
    try {
      const intent = await persistDepositIntent(
        {
          supabaseUrl: input.supabaseUrl,
          serviceRoleKey: input.serviceRoleKey,
          userAccessToken,
          fetcher: input.fetcher,
        },
        {
          id,
          payerAccount: parsed.data.payerAccount,
          treasuryAccount: input.treasuryAccount,
          amountTinybars: parsed.data.amountTinybars,
          memo: `agent-router:deposit:${id}`,
          expiresAt: new Date(now.getTime() + 5 * 60_000).toISOString(),
          idempotencyKey: parsedIdempotencyKey.data,
        },
      );
      return Response.json(
        { intent, signingRequest: createUserSigningRequest(intent) },
        { status: 201 },
      );
    } catch (error) {
      const status =
        error instanceof DepositPersistenceError && error.status === 409
          ? 409
          : 502;
      return Response.json({ error: "Deposit intent failed" }, { status });
    }
  };
}

export function createDepositProofHandler(input: {
  supabaseUrl?: string;
  serviceRoleKey?: string;
  fetcher?: typeof fetch;
}) {
  return async function POST(
    request: Request,
    context: { params: Promise<{ depositId: string }> },
  ) {
    const userAccessToken = bearerToken(request);
    if (!userAccessToken) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }
    if (!input.supabaseUrl || !input.serviceRoleKey) {
      return Response.json(
        { error: "Deposit service unavailable" },
        { status: 503 },
      );
    }

    const parsed = proofRequestSchema.safeParse(
      await request.json().catch(() => null),
    );
    const { depositId } = await context.params;
    if (!parsed.success || !depositId || depositId.length > 200) {
      return Response.json({ error: "Invalid deposit proof" }, { status: 400 });
    }

    try {
      await persistDepositProof(
        {
          supabaseUrl: input.supabaseUrl,
          serviceRoleKey: input.serviceRoleKey,
          userAccessToken,
          fetcher: input.fetcher,
        },
        { depositId, transactionId: parsed.data.transactionId },
      );
      return Response.json({
        depositId,
        state: "submitted",
        message: "Proof submitted; awaiting independent Mirror verification",
      });
    } catch {
      return Response.json({ error: "Deposit proof failed" }, { status: 409 });
    }
  };
}
