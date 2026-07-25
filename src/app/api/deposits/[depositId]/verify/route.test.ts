import { describe, expect, it, vi } from "vitest";

import { createDepositVerificationHandler } from "../../../../../lib/deposit/verify-http";

const depositId = "deposit-1";
const transactionId = "0.0.1001@1784980801.000000001";
const intentRow = {
  id: depositId,
  version: "1",
  user_id: "11111111-1111-4111-8111-111111111111",
  payer_account: "0.0.1001",
  treasury_account: "0.0.2001",
  network: "testnet",
  amount_tinybar: 100000,
  memo: "agent-router:deposit:deposit-1",
  expires_at: "2026-07-25T13:00:00.000Z",
  idempotency_key: "intent-1",
};

function mirrorResponse() {
  return {
    transactions: [
      {
        consensus_timestamp: "1784980802.000000001",
        memo_base64: Buffer.from(intentRow.memo).toString("base64"),
        name: "CRYPTOTRANSFER",
        result: "SUCCESS",
        transaction_id: "0.0.1001-1784980801-000000001",
        transfers: [
          { account: "0.0.1001", amount: -101000 },
          { account: "0.0.2001", amount: 100000 },
        ],
      },
    ],
  };
}

function request() {
  return new Request(`https://app.test/api/deposits/${depositId}/verify`, {
    method: "POST",
    headers: { authorization: "Bearer user-jwt" },
  });
}

describe("POST /api/deposits/[depositId]/verify", () => {
  it("Mirror-verifies and credits through the service-only owner RPC", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json([intentRow]))
      .mockResolvedValueOnce(
        Response.json([
          { state: "submitted", transaction_proof: transactionId },
        ]),
      )
      .mockResolvedValueOnce(Response.json(mirrorResponse()))
      .mockResolvedValueOnce(
        Response.json({
          available_tinybar: 100000,
          reserved_tinybar: 0,
          spent_tinybar: 0,
          refunded_tinybar: 0,
          reconciliation_tinybar: 0,
        }),
      );
    const handler = createDepositVerificationHandler({
      supabaseUrl: "https://supabase.example.com",
      serviceRoleKey: "service-role",
      mirrorNodeUrl: "https://testnet.mirrornode.hedera.com",
      pseudonymSalt: "server-only-salt",
      fetcher,
      now: () => new Date("2026-07-25T12:01:00Z"),
    });

    const response = await handler(request(), {
      params: Promise.resolve({ depositId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      state: "credited",
      creditedExactlyOnce: true,
      balance: { availableTinybars: "100000" },
    });
    const creditCall = fetcher.mock.calls[3];
    expect(creditCall[0]).toContain("credit_verified_deposit_for_user");
    expect(creditCall[1]?.headers).toMatchObject({
      authorization: "Bearer service-role",
    });
    expect(JSON.parse(String(creditCall[1]?.body))).toMatchObject({
      target_user_id: intentRow.user_id,
      target_deposit_id: depositId,
      expected_proof: transactionId,
      request_key: `credit:${depositId}`,
    });
  });

  it("returns pending without invoking credit while Mirror indexing lags", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json([intentRow]))
      .mockResolvedValueOnce(
        Response.json([
          { state: "submitted", transaction_proof: transactionId },
        ]),
      )
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    const handler = createDepositVerificationHandler({
      supabaseUrl: "https://supabase.example.com",
      serviceRoleKey: "service-role",
      mirrorNodeUrl: "https://testnet.mirrornode.hedera.com",
      pseudonymSalt: "server-only-salt",
      fetcher,
    });

    const response = await handler(request(), {
      params: Promise.resolve({ depositId }),
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      depositId,
      state: "mirror_pending",
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("requires user authentication and server-only verification config", async () => {
    const handler = createDepositVerificationHandler({
      mirrorNodeUrl: "https://testnet.mirrornode.hedera.com",
    });
    const unauthorized = await handler(
      new Request("https://app.test", { method: "POST" }),
      { params: Promise.resolve({ depositId }) },
    );
    expect(unauthorized.status).toBe(401);

    const unavailable = await handler(request(), {
      params: Promise.resolve({ depositId }),
    });
    expect(unavailable.status).toBe(503);
  });
});
