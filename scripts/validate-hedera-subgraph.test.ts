import { describe, expect, it, vi } from "vitest";

import { validateHederaSubgraph } from "./validate-hedera-subgraph.mjs";

const contractAddress = "0x1111111111111111111111111111111111111111";
const transactionHash = `0x${"22".repeat(32)}`;

function response(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

function successfulFetch(indexedBlock = "123") {
  return vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(response({ jsonrpc: "2.0", id: 1, result: "0x128" }))
    .mockResolvedValueOnce(
      response({
        jsonrpc: "2.0",
        id: 2,
        result: {
          status: "0x1",
          blockNumber: "0x7b",
          logs: [{ address: contractAddress }],
        },
      }),
    )
    .mockResolvedValueOnce(
      response({
        data: {
          _meta: {
            block: { number: indexedBlock },
            hasIndexingErrors: false,
          },
          appEvents: [
            {
              id: "123-0",
              kind: "job.completed",
              subject: "job-1",
              payloadDigest: `0x${"33".repeat(32)}`,
              transactionHash,
              blockNumber: "123",
              blockTimestamp: "1770000000",
              logIndex: "0",
            },
          ],
        },
      }),
    );
}

describe("Hedera subgraph deployment validation", () => {
  it("correlates indexed app history with a successful Hedera receipt", async () => {
    const result = await validateHederaSubgraph(
      {
        rpcUrl: "https://hedera-rpc.example",
        subgraphUrl: "https://graph.example/subgraphs/name/app-history",
        contractAddress,
        transactionHash,
      },
      successfulFetch(),
    );

    expect(result).toMatchObject({
      chainId: "296",
      receiptBlock: "123",
      indexedBlock: "123",
      eventCount: 1,
    });
  });

  it("fails while the subgraph is behind the event block", async () => {
    await expect(
      validateHederaSubgraph(
        {
          rpcUrl: "https://hedera-rpc.example",
          subgraphUrl: "https://graph.example/subgraphs/name/app-history",
          contractAddress,
          transactionHash,
        },
        successfulFetch("122"),
      ),
    ).rejects.toThrow("has not indexed the app event block yet");
  });

  it("fails when the Graph entity is not correlated to the receipt", async () => {
    const fetchImpl = successfulFetch();
    fetchImpl.mockReset();
    fetchImpl
      .mockResolvedValueOnce(
        response({ jsonrpc: "2.0", id: 1, result: "0x128" }),
      )
      .mockResolvedValueOnce(
        response({
          jsonrpc: "2.0",
          id: 2,
          result: {
            status: "0x1",
            blockNumber: "0x7b",
            logs: [{ address: contractAddress }],
          },
        }),
      )
      .mockResolvedValueOnce(
        response({
          data: {
            _meta: {
              block: { number: "123" },
              hasIndexingErrors: false,
            },
            appEvents: [],
          },
        }),
      );

    await expect(
      validateHederaSubgraph(
        {
          rpcUrl: "https://hedera-rpc.example",
          subgraphUrl: "https://graph.example/subgraphs/name/app-history",
          contractAddress,
          transactionHash,
        },
        fetchImpl,
      ),
    ).rejects.toThrow("returned no matching app event");
  });
});
