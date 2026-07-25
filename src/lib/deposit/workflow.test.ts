import { describe, expect, it, vi } from "vitest";

import { MirrorVerificationError } from "../payment/mirror";
import type { DepositIntent } from "./deposit";
import {
  createUserDeposit,
  executeFromPrefundedOgTreasury,
  type DepositStore,
  verifyAndCreditUserDeposit,
} from "./workflow";

function store(overrides: Partial<DepositStore> = {}): DepositStore {
  return {
    createIntent: vi.fn(async (intent) => intent),
    submitProof: vi.fn(async () => undefined),
    creditVerified: vi.fn(async () => ({
      availableTinybars: "10000000",
      credited: true,
    })),
    ...overrides,
  };
}

async function intentFor(testStore: DepositStore): Promise<DepositIntent> {
  return (
    await createUserDeposit({
      store: testStore,
      id: "deposit-1",
      userId: "00000000-0000-4000-8000-000000000001",
      payerAccount: "0.0.1001",
      treasuryAccount: "0.0.2001",
      amountTinybars: "10000000",
      idempotencyKey: "request-1",
      now: new Date("2026-07-25T12:00:00Z"),
    })
  ).intent;
}

describe("user-funded deposit workflow", () => {
  it("returns a user signing request and never asks for a private key", async () => {
    const result = await createUserDeposit({
      store: store(),
      id: "deposit-1",
      userId: "00000000-0000-4000-8000-000000000001",
      payerAccount: "0.0.1001",
      treasuryAccount: "0.0.2001",
      amountTinybars: "10000000",
      idempotencyKey: "request-1",
      now: new Date("2026-07-25T12:00:00Z"),
    });
    expect(result.signingRequest).toMatchObject({
      type: "hedera-hbar-user-deposit",
      amountTinybars: "10000000",
      recipientAccount: "0.0.2001",
    });
    expect(JSON.stringify(result)).not.toMatch(/private.?key/i);
  });

  it("does not credit while Mirror indexing is pending", async () => {
    const testStore = store();
    const intent = await intentFor(testStore);
    const fetcher = vi.fn(async () => new Response(null, { status: 404 }));
    await expect(
      verifyAndCreditUserDeposit({
        store: testStore,
        intent,
        transactionId: "0.0.1001@1784980801.000000001",
        mirrorNodeUrl: "https://testnet.mirrornode.hedera.com",
        pseudonymSalt: "test",
        fetcher,
        now: new Date("2026-07-25T12:01:00Z"),
      }),
    ).rejects.toBeInstanceOf(MirrorVerificationError);
    expect(testStore.creditVerified).not.toHaveBeenCalled();
  });

  it("credits only after exact Mirror verification", async () => {
    const testStore = store();
    const intent = await intentFor(testStore);
    const transactionId = "0.0.1001@1784980801.000000001";
    const fetcher = vi.fn(async () =>
      Response.json({
        transactions: [
          {
            consensus_timestamp: "1784980802.000000001",
            memo_base64: Buffer.from(intent.memo).toString("base64"),
            name: "CRYPTOTRANSFER",
            result: "SUCCESS",
            transaction_id: "0.0.1001-1784980801-000000001",
            transfers: [
              { account: "0.0.1001", amount: -10_001_000 },
              { account: "0.0.2001", amount: 10_000_000 },
            ],
          },
        ],
      }),
    );
    await verifyAndCreditUserDeposit({
      store: testStore,
      intent,
      transactionId,
      mirrorNodeUrl: "https://testnet.mirrornode.hedera.com",
      pseudonymSalt: "test",
      fetcher,
      now: new Date("2026-07-25T12:01:00Z"),
    });
    expect(testStore.creditVerified).toHaveBeenCalledOnce();
  });

  it("fails closed without enough separately funded 0G inventory", async () => {
    const execute = vi.fn(async () => "result");
    await expect(
      executeFromPrefundedOgTreasury({
        requiredOgAmount: BigInt(5),
        availableOgAmount: BigInt(4),
        exchangeRateSnapshot: {
          hbarUsd: "0.20",
          ogUsd: "1.00",
          capturedAt: "2026-07-25T12:00:00Z",
        },
        treasuryLiabilityTinybars: "10000000",
        execute,
      }),
    ).rejects.toThrow(/insufficient/);
    expect(execute).not.toHaveBeenCalled();
  });
});
