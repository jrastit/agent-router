import { describe, expect, it, vi } from "vitest";

import {
  authenticatedUserId,
  loadFundActivity,
  parseFundActivity,
  subscribeToFundActivity,
} from "./activity";

const row = {
  available_tinybars: "9007199254740993",
  reserved_tinybars: "20",
  spent_tinybars: "30",
  refunded_tinybars: "40",
  reconciliation_tinybars: "0",
  account_updated_at: "2026-07-26T00:00:00.000Z",
  journal_id: "7",
  entry_kind: "deposit",
  amount_tinybars: "9007199254740993",
  deposit_id: "deposit-1",
  transaction_proof: "0.0.1001@1785000000.000000001",
  entry_created_at: "2026-07-26T00:00:00.000Z",
};

describe("Supabase fund activity", () => {
  it("preserves exact integer strings and authenticated evidence", () => {
    expect(parseFundActivity([row])).toEqual({
      availableTinybars: "9007199254740993",
      reservedTinybars: "20",
      spentTinybars: "30",
      refundedTinybars: "40",
      reconciliationTinybars: "0",
      updatedAt: "2026-07-26T00:00:00.000Z",
      entries: [
        {
          id: "7",
          kind: "deposit",
          amountTinybars: "9007199254740993",
          depositId: "deposit-1",
          transactionId: "0.0.1001@1785000000.000000001",
          createdAt: "2026-07-26T00:00:00.000Z",
        },
      ],
    });
  });

  it("represents a new account without fund rows as exact zeroes", () => {
    expect(parseFundActivity([])).toMatchObject({
      availableTinybars: "0",
      reservedTinybars: "0",
      spentTinybars: "0",
      entries: [],
    });
  });

  it("uses only the publishable key and user bearer token", async () => {
    const fetchImpl = vi.fn(async () => Response.json([row]));
    await loadFundActivity(
      {
        url: "https://project.supabase.co/",
        publishableKey: "publishable",
        accessToken: "user-token",
      },
      fetchImpl,
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://project.supabase.co/rest/v1/rpc/get_my_fund_activity",
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: "publishable",
          authorization: "Bearer user-token",
        }),
      }),
    );
  });

  it("derives the RLS filter identity from the restored user token", () => {
    const userId = "11111111-1111-4111-8111-111111111111";
    const payload = Buffer.from(JSON.stringify({ sub: userId })).toString(
      "base64url",
    );
    expect(authenticatedUserId(`header.${payload}.signature`)).toBe(userId);
  });

  it("scopes every Realtime table and removes its channel on teardown", () => {
    const registrations: Array<{ table: string; filter: string }> = [];
    const changes: Array<() => void> = [];
    const statuses: string[] = [];
    const channel = {
      on: vi.fn(
        (
          _event: "postgres_changes",
          filter: { table: string; filter: string },
          callback: () => void,
        ) => {
          registrations.push(filter);
          changes.push(callback);
          return channel;
        },
      ),
      subscribe: vi.fn((callback: (status: string) => void) => {
        callback("SUBSCRIBED");
        return channel;
      }),
    };
    const removeChannel = vi.fn(async () => "ok");
    const onChange = vi.fn();
    const userId = "11111111-1111-4111-8111-111111111111";

    const unsubscribe = subscribeToFundActivity(
      { channel: vi.fn(() => channel), removeChannel },
      userId,
      onChange,
      (status) => statuses.push(status),
    );
    changes[0]?.();
    unsubscribe();

    expect(registrations).toHaveLength(4);
    expect(
      registrations.every(({ filter }) => filter === `user_id=eq.${userId}`),
    ).toBe(true);
    expect(onChange).toHaveBeenCalledOnce();
    expect(statuses).toEqual(["SUBSCRIBED"]);
    expect(removeChannel).toHaveBeenCalledWith(channel);
  });
});
