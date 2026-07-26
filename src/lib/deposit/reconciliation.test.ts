import { describe, expect, it, vi } from "vitest";

import { reconcileSubmittedDeposits } from "./reconciliation";

const intent = {
  id: "deposit-1",
  version: "1",
  user_id: "00000000-0000-4000-8000-000000000001",
  payer_account: "0.0.1001",
  treasury_account: "0.0.2001",
  network: "testnet",
  amount_tinybar: "10000000",
  memo: "agent-router:deposit:deposit-1",
  expires_at: "2026-07-26T01:00:00.000Z",
  idempotency_key: "intent-1",
};

describe("submitted deposit reconciliation", () => {
  it("credits a delayed but consensus-valid submitted proof exactly once", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json([
          { id: "deposit-1", transaction_proof: "0.0.1001@1785023999.1" },
        ]),
      )
      .mockResolvedValueOnce(Response.json([intent]))
      .mockResolvedValueOnce(
        Response.json({
          transactions: [
            {
              consensus_timestamp: "1785023999.000000001",
              memo_base64: Buffer.from(intent.memo).toString("base64"),
              name: "CRYPTOTRANSFER",
              result: "SUCCESS",
              transaction_id: "0.0.1001-1785023999-1",
              transfers: [
                { account: "0.0.1001", amount: -10000000 },
                { account: "0.0.2001", amount: 10000000 },
              ],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          available_tinybar: "10000000",
          reserved_tinybar: "0",
          spent_tinybar: "0",
          refunded_tinybar: "0",
          reconciliation_tinybar: "0",
        }),
      );

    await expect(
      reconcileSubmittedDeposits({
        supabaseUrl: "https://project.supabase.co",
        serviceRoleKey: "server-only",
        mirrorNodeUrl: "https://mirror.example.com",
        pseudonymSalt: "test-only",
        fetcher,
        now: () => new Date("2026-07-27T00:00:00Z"),
      }),
    ).resolves.toEqual({ credited: 1, pending: 0, rejected: 0 });
    expect(fetcher).toHaveBeenLastCalledWith(
      "https://project.supabase.co/rest/v1/rpc/credit_verified_deposit_for_user",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
