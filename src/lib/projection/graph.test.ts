import { describe, expect, it, vi } from "vitest";

import { ProjectionGraphClient } from "./graph";

const sourceEventId = `0x${"11".repeat(32)}`;
const entity = {
  id: sourceEventId,
  hederaTransactionHash: `0x${"22".repeat(32)}`,
  consensusTimestamp: "1784941222.395471303",
  destinationTransactionHash: `0x${"33".repeat(32)}`,
  destinationBlockNumber: "2",
};

describe("ProjectionGraphClient", () => {
  it("loads an indexed anchor from the configured endpoint", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { hederaEventAnchor: entity } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new ProjectionGraphClient(
      "https://graph.router.fexhu.com/subgraphs/name/agent-router/hedera-projection",
      fetch,
    );

    await expect(client.loadAnchor(sourceEventId)).resolves.toEqual(entity);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("graph.router.fexhu.com"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining(sourceEventId),
      }),
    );
  });

  it("returns null while the entity is not indexed", async () => {
    const client = new ProjectionGraphClient(
      "https://graph.router.fexhu.com/subgraphs/name/agent-router/hedera-projection",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { hederaEventAnchor: null } }), {
          status: 200,
        }),
      ),
    );

    await expect(client.loadAnchor(sourceEventId)).resolves.toBeNull();
  });

  it("fails closed for malformed provenance", async () => {
    const client = new ProjectionGraphClient(
      "https://graph.router.fexhu.com/subgraphs/name/agent-router/hedera-projection",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              hederaEventAnchor: {
                ...entity,
                destinationTransactionHash: "not-a-hash",
              },
            },
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(client.loadAnchor(sourceEventId)).rejects.toThrow(
      "malformed data",
    );
  });

  it("rejects insecure remote endpoints and malformed IDs", async () => {
    expect(
      () =>
        new ProjectionGraphClient(
          "http://graph.router.fexhu.com/subgraphs/name/agent-router/hedera-projection",
        ),
    ).toThrow("must use HTTPS");

    const client = new ProjectionGraphClient(
      "https://graph.router.fexhu.com/subgraphs/name/agent-router/hedera-projection",
    );
    await expect(client.loadAnchor("invalid")).rejects.toThrow(
      "lowercase bytes32",
    );
  });
});
