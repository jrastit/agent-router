import { describe, expect, it, vi } from "vitest";

import { GraphPaymentEvidenceClient } from "./graph-client";

const sourceId = `0x${"11".repeat(32)}`;
const hederaHash = `0x${"22".repeat(32)}`;
const destinationHash = `0x${"33".repeat(32)}`;
const account = `0x${"44".repeat(20)}`;
const contract = `0x${"55".repeat(20)}`;

const anchor = {
  id: sourceId,
  sourceType: 1,
  sourceId: "0.0.9676520",
  hederaTransactionHash: hederaHash,
  consensusTimestamp: "1784941222.395471303",
  sourceIndex: "3",
  eventKind: "deposit.credited",
  payloadDigest: `0x${"66".repeat(32)}`,
  schemaVersion: 1,
  relayer: account,
  destinationContract: contract,
  destinationTransactionHash: destinationHash,
  destinationBlockNumber: "2",
  destinationBlockTimestamp: "1784941224",
};

function client(fetcher: typeof fetch) {
  return new GraphPaymentEvidenceClient({
    projectionEndpoint:
      "https://graph.example.com/subgraphs/name/agent-router/hedera-projection",
    economicEndpoint:
      "https://graph.example.com/subgraphs/name/agent-router/app-events",
    fetcher,
  });
}

describe("Graph payment evidence client", () => {
  it("finds and deduplicates payment evidence with explicit provenance", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        data: {
          _meta: { block: { number: 2 }, hasIndexingErrors: false },
          byId: anchor,
          byHederaTransaction: [anchor],
          byDestinationTransaction: [],
        },
      }),
    );
    const result = await client(fetcher).findPayment(
      `0x${sourceId.slice(2).toUpperCase()}`,
    );

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({
      sourceEventId: sourceId,
      destinationTransactionHash: destinationHash,
    });
    expect(result.provenance).toMatchObject({
      indexedBlock: 2,
      completeness: "indexed",
      chainHeadBlock: null,
      lagBlocks: null,
      authority:
        "monitoring-only; Hedera Mirror and Postgres remain authoritative",
    });
  });

  it("lists projection and economic evidence without floating-point money", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          data: {
            _meta: { block: { number: 2 }, hasIndexingErrors: false },
            anchors: [anchor],
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: {
            _meta: { block: { number: 38_431_806 }, hasIndexingErrors: false },
            economicEvents: [
              {
                id: `0x${"77".repeat(32)}`,
                subject: account,
                eventType: 2,
                amountTinybars: "9007199254740993",
                referenceId: sourceId,
                payloadDigest: `0x${"88".repeat(32)}`,
                transactionHash: hederaHash,
                blockNumber: "38431807",
                blockTimestamp: "1784941222",
              },
            ],
          },
        }),
      );
    const result = await client(fetcher).listAgentTransactions(account, 5);

    expect(result.anchors).toHaveLength(1);
    expect(result.economicEvents[0]?.amountTinybars).toBe("9007199254740993");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("verifies complete history and identifies missing references", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          data: {
            _meta: { block: { number: 2 }, hasIndexingErrors: false },
            byId: anchor,
            byHederaTransaction: [],
            byDestinationTransaction: [],
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: {
            _meta: { block: { number: 2 }, hasIndexingErrors: false },
            byId: null,
            byHederaTransaction: [],
            byDestinationTransaction: [],
          },
        }),
      );
    const missing = `0x${"99".repeat(32)}`;
    const result = await client(fetcher).verifyReceiptHistory([
      sourceId,
      missing,
    ]);

    expect(result.verified).toBe(false);
    expect(result.missingReferences).toEqual([missing]);
  });

  it("rejects malformed references, insecure endpoints, and Graph errors", async () => {
    expect(
      () =>
        new GraphPaymentEvidenceClient({
          projectionEndpoint: "http://graph.example.com/query",
          economicEndpoint: "https://graph.example.com/query",
        }),
    ).toThrow("HTTPS or loopback");
    await expect(
      client(vi.fn()).findPayment("not-a-reference"),
    ).rejects.toThrow();
    await expect(
      client(
        vi.fn<typeof fetch>().mockResolvedValue(
          Response.json({
            data: {
              _meta: { block: { number: 2 }, hasIndexingErrors: true },
              byId: null,
              byHederaTransaction: [],
              byDestinationTransaction: [],
            },
          }),
        ),
      ).findPayment(sourceId),
    ).rejects.toThrow("unavailable or malformed");
  });
});
