import { describe, expect, it, vi } from "vitest";

import { loadLatestGraphActivity } from "./activity";

describe("latest Graph activity", () => {
  it("loads the newest indexed app and economic events", async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        data: {
          _meta: { block: { number: 123 }, hasIndexingErrors: false },
          hederaEventAnchors: [
            {
              id: "0xaa",
              hederaTransactionHash: "0xbb",
              consensusTimestamp: "1785012000.123456789",
              destinationTransactionHash: "0xcc",
              destinationBlockNumber: "123",
            },
          ],
        },
      }),
    );

    const result = await loadLatestGraphActivity(
      "https://graph.router.fexhu.com/subgraphs/name/agent-router/hedera-projection",
      fetch as unknown as typeof globalThis.fetch,
    );

    expect(result._meta.block.number).toBe(123);
    expect(result.hederaEventAnchors[0]?.destinationBlockNumber).toBe("123");
    expect(fetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ cache: "no-store", method: "POST" }),
    );
  });

  it("fails closed on indexing errors", async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        data: {
          _meta: { block: { number: 123 }, hasIndexingErrors: true },
          hederaEventAnchors: [],
        },
      }),
    );

    await expect(
      loadLatestGraphActivity(
        "https://graph.router.fexhu.com/subgraphs/name/agent-router/hedera-projection",
        fetch as unknown as typeof globalThis.fetch,
      ),
    ).rejects.toThrow("unavailable data");
  });
});
