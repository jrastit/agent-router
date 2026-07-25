import { describe, expect, it, vi } from "vitest";

import { createDepositProofHandler } from "../../../../../lib/deposit/http";

describe("POST /api/deposits/:depositId/proof", () => {
  it("submits an authenticated transaction identity", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ state: "submitted" }));
    const handler = createDepositProofHandler({
      supabaseUrl: "https://supabase.example.com",
      serviceRoleKey: "server-secret",
      fetcher,
    });
    const response = await handler(
      new Request("https://app.example.com/api/deposits/deposit-1/proof", {
        method: "POST",
        headers: {
          authorization: "Bearer user-jwt",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          transactionId: "0.0.1001@1785000000.000000001",
        }),
      }),
      { params: Promise.resolve({ depositId: "deposit-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      depositId: "deposit-1",
      state: "submitted",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://supabase.example.com/rest/v1/rpc/submit_deposit_proof",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer user-jwt",
        }),
      }),
    );
  });

  it("rejects malformed proofs before persistence", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const handler = createDepositProofHandler({
      supabaseUrl: "https://supabase.example.com",
      serviceRoleKey: "server-secret",
      fetcher,
    });
    const response = await handler(
      new Request("https://app.example.com/api/deposits/deposit-1/proof", {
        method: "POST",
        headers: {
          authorization: "Bearer user-jwt",
          "content-type": "application/json",
        },
        body: JSON.stringify({ transactionId: "not-a-transaction" }),
      }),
      { params: Promise.resolve({ depositId: "deposit-1" }) },
    );

    expect(response.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
