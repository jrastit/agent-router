import { describe, expect, it, vi } from "vitest";

import {
  DepositPersistenceError,
  persistDepositIntent,
  persistDepositProof,
} from "./persistence";

const config = (fetcher: typeof fetch) => ({
  supabaseUrl: "https://supabase.example.com",
  serviceRoleKey: "server-secret",
  userAccessToken: "user-jwt",
  fetcher,
});

describe("authenticated deposit persistence", () => {
  it("creates an owner-bound intent through the authenticated RPC", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        id: "deposit-1",
        version: "1",
        user_id: "11111111-1111-4111-8111-111111111111",
        payer_account: "0.0.1001",
        treasury_account: "0.0.2002",
        network: "testnet",
        amount_tinybar: 10_000_000,
        memo: "agent-router:deposit:deposit-1",
        expires_at: "2026-07-25T20:00:00Z",
        idempotency_key: "request-1",
        created_at: "2026-07-25T19:55:00Z",
      }),
    );

    await expect(
      persistDepositIntent(config(fetcher), {
        id: "deposit-1",
        payerAccount: "0.0.1001",
        treasuryAccount: "0.0.2002",
        amountTinybars: "10000000",
        memo: "agent-router:deposit:deposit-1",
        expiresAt: "2026-07-25T20:00:00.000Z",
        idempotencyKey: "request-1",
      }),
    ).resolves.toMatchObject({
      id: "deposit-1",
      userId: "11111111-1111-4111-8111-111111111111",
      amountTinybars: "10000000",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://supabase.example.com/rest/v1/rpc/create_deposit_intent",
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: "server-secret",
          authorization: "Bearer user-jwt",
        }),
      }),
    );
  });

  it("submits only the transaction identity through the owner RPC", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ state: "submitted" }));
    await persistDepositProof(config(fetcher), {
      depositId: "deposit-1",
      transactionId: "0.0.1001@1785000000.000000001",
    });

    const [, request] = fetcher.mock.calls[0]!;
    expect(JSON.parse(String(request?.body))).toEqual({
      target_deposit_id: "deposit-1",
      submitted_proof: "0.0.1001@1785000000.000000001",
    });
  });

  it("does not expose database error bodies", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response("private database details", { status: 409 }),
      );
    await expect(
      persistDepositProof(config(fetcher), {
        depositId: "deposit-1",
        transactionId: "0.0.1001@1785000000.000000001",
      }),
    ).rejects.toEqual(new DepositPersistenceError("submit proof", 409));
  });
});
