import { describe, expect, it, vi } from "vitest";

import { loadEconomicActivity } from "./economic-activity";

describe("economic Graph activity", () => {
  it("summarizes exact user deposits, spending, and refunds", async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        data: {
          _meta: { block: { number: 456 }, hasIndexingErrors: false },
          economicEvents: [
            {
              id: "0x01",
              subject: "0xaaaa",
              eventType: 6,
              amountTinybars: "2000000",
              referenceId: "0x11",
              transactionHash: "0x21",
              blockNumber: "456",
              blockTimestamp: "1785012020",
            },
            {
              id: "0x02",
              subject: "0xaaaa",
              eventType: 5,
              amountTinybars: "-4000000",
              referenceId: "0x12",
              transactionHash: "0x22",
              blockNumber: "455",
              blockTimestamp: "1785012010",
            },
            {
              id: "0x03",
              subject: "0xaaaa",
              eventType: 2,
              amountTinybars: "10000000",
              referenceId: "0x13",
              transactionHash: "0x23",
              blockNumber: "454",
              blockTimestamp: "1785012000",
            },
          ],
        },
      }),
    );

    const result = await loadEconomicActivity(
      "https://graph.router.fexhu.com/subgraphs/name/agent-router/app-events",
      fetch as unknown as typeof globalThis.fetch,
    );

    expect(result.indexedBlock).toBe(456);
    expect(result.users[0]).toMatchObject({
      subject: "0xaaaa",
      depositedTinybars: "10000000",
      spentTinybars: "4000000",
      refundedTinybars: "2000000",
      availableTinybars: "8000000",
    });
  });

  it("fails closed when the index reports errors", async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        data: {
          _meta: { block: { number: 456 }, hasIndexingErrors: true },
          economicEvents: [],
        },
      }),
    );

    await expect(
      loadEconomicActivity(
        "https://graph.router.fexhu.com/subgraphs/name/agent-router/app-events",
        fetch as unknown as typeof globalThis.fetch,
      ),
    ).rejects.toThrow("unavailable data");
  });
});
