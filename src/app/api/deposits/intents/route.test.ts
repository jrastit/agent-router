import { describe, expect, it, vi } from "vitest";

import { createDepositIntentHandler } from "../../../../lib/deposit/http";

const handler = (fetcher: typeof fetch) =>
  createDepositIntentHandler({
    supabaseUrl: "https://supabase.example.com",
    serviceRoleKey: "server-secret",
    treasuryAccount: "0.0.2002",
    now: () => new Date("2026-07-25T19:55:00Z"),
    id: () => "deposit-1",
    fetcher,
  });

describe("POST /api/deposits/intents", () => {
  it("requires a bearer token", async () => {
    const response = await handler(vi.fn())(
      new Request("https://app.example.com/api/deposits/intents", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(response.status).toBe(401);
  });

  it("requires an idempotency key header", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const response = await handler(fetcher)(
      new Request("https://app.example.com/api/deposits/intents", {
        method: "POST",
        headers: {
          authorization: "Bearer user-jwt",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          payerAccount: "0.0.1001",
          amountTinybars: "10000000",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns a server-bound external signing request", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        id: "deposit-1",
        version: "1",
        user_id: "11111111-1111-4111-8111-111111111111",
        payer_account: "0.0.1001",
        treasury_account: "0.0.2002",
        network: "testnet",
        amount_tinybar: "10000000",
        memo: "agent-router:deposit:deposit-1",
        expires_at: "2026-07-25T20:00:00Z",
        idempotency_key: "request-1",
        created_at: "2026-07-25T19:55:00Z",
      }),
    );
    const response = await handler(fetcher)(
      new Request("https://app.example.com/api/deposits/intents", {
        method: "POST",
        headers: {
          authorization: "Bearer user-jwt",
          "content-type": "application/json",
          "idempotency-key": "request-1",
        },
        body: JSON.stringify({
          payerAccount: "0.0.1001",
          amountTinybars: "10000000",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(fetcher).toHaveBeenCalledWith(
      "https://supabase.example.com/rest/v1/rpc/create_deposit_intent",
      expect.objectContaining({
        body: expect.stringContaining('"request_key":"request-1"'),
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      signingRequest: {
        type: "hedera-hbar-user-deposit",
        payerAccount: "0.0.1001",
        recipientAccount: "0.0.2002",
        amountTinybars: "10000000",
      },
    });
  });
});
