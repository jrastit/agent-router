import { isAddress, isHexString } from "ethers";

const HISTORY_QUERY = `
  query AppEventHistory($transactionHash: Bytes!) {
    _meta {
      block {
        number
      }
      hasIndexingErrors
    }
    appEvents(
      where: { transactionHash: $transactionHash }
      orderBy: logIndex
      orderDirection: asc
    ) {
      id
      kind
      subject
      payloadDigest
      transactionHash
      blockNumber
      blockTimestamp
      logIndex
    }
  }
`;

async function postJson(url, body, fetchImpl) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  return response.json();
}

export async function validateHederaSubgraph(
  {
    rpcUrl,
    subgraphUrl,
    contractAddress,
    transactionHash,
    expectedChainId = 296n,
  },
  fetchImpl = fetch,
) {
  if (!rpcUrl || !subgraphUrl) {
    throw new Error(
      "HEDERA_EVM_RPC_URL and HEDERA_SUBGRAPH_QUERY_URL are required",
    );
  }
  if (!isAddress(contractAddress)) {
    throw new Error("HEDERA_APP_EVENT_CONTRACT_ADDRESS must be an EVM address");
  }
  if (!isHexString(transactionHash, 32)) {
    throw new Error(
      "HEDERA_APP_EVENT_TX_HASH must be a 32-byte transaction hash",
    );
  }

  const [chainResponse, receiptResponse] = await Promise.all([
    postJson(
      rpcUrl,
      { jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] },
      fetchImpl,
    ),
    postJson(
      rpcUrl,
      {
        jsonrpc: "2.0",
        id: 2,
        method: "eth_getTransactionReceipt",
        params: [transactionHash],
      },
      fetchImpl,
    ),
  ]);
  if (chainResponse.error) {
    throw new Error(
      `Hedera RPC chain lookup failed: ${chainResponse.error.message}`,
    );
  }
  const chainId = BigInt(chainResponse.result);
  if (chainId !== expectedChainId) {
    throw new Error(
      `Hedera chain mismatch: expected ${expectedChainId}, received ${chainId}`,
    );
  }

  const receipt = receiptResponse.result;
  if (!receipt || receipt.status !== "0x1" || !receipt.blockNumber) {
    throw new Error("app event transaction is missing or not successful");
  }
  const normalizedContract = contractAddress.toLowerCase();
  if (
    !receipt.logs?.some(
      ({ address }) => address?.toLowerCase() === normalizedContract,
    )
  ) {
    throw new Error(
      "transaction has no log from the configured app event contract",
    );
  }

  const graphResponse = await postJson(
    subgraphUrl,
    {
      query: HISTORY_QUERY,
      variables: { transactionHash: transactionHash.toLowerCase() },
    },
    fetchImpl,
  );
  if (graphResponse.errors?.length) {
    throw new Error(
      `subgraph query failed: ${graphResponse.errors
        .map(({ message }) => message)
        .join("; ")}`,
    );
  }

  const meta = graphResponse.data?._meta;
  const events = graphResponse.data?.appEvents;
  if (!meta || meta.hasIndexingErrors) {
    throw new Error("subgraph is unavailable or reports indexing errors");
  }
  if (BigInt(meta.block.number) < BigInt(receipt.blockNumber)) {
    throw new Error("subgraph has not indexed the app event block yet");
  }
  if (!Array.isArray(events) || events.length === 0) {
    throw new Error(
      "subgraph indexed the block but returned no matching app event",
    );
  }
  if (
    events.some(
      (event) =>
        event.transactionHash.toLowerCase() !== transactionHash.toLowerCase() ||
        BigInt(event.blockNumber) !== BigInt(receipt.blockNumber),
    )
  ) {
    throw new Error("subgraph history does not match the Hedera receipt");
  }

  return {
    chainId: chainId.toString(),
    contractAddress,
    transactionHash,
    receiptBlock: BigInt(receipt.blockNumber).toString(),
    indexedBlock: String(meta.block.number),
    eventCount: events.length,
    events,
  };
}

async function main() {
  const result = await validateHederaSubgraph({
    rpcUrl: process.env.HEDERA_EVM_RPC_URL,
    subgraphUrl: process.env.HEDERA_SUBGRAPH_QUERY_URL,
    contractAddress: process.env.HEDERA_APP_EVENT_CONTRACT_ADDRESS,
    transactionHash: process.env.HEDERA_APP_EVENT_TX_HASH,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (
  process.argv[1] &&
  import.meta.url === new URL(process.argv[1], "file:").href
) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "unknown validation failure"}\n`,
    );
    process.exitCode = 1;
  });
}
