import {
  Contract,
  JsonRpcProvider,
  isAddress,
  type ContractTransactionReceipt,
} from "ethers";

import {
  readVerifiedHederaEvents,
  type VerifiedHederaEvent,
} from "../src/lib/projection/mirror-reader.ts";

const confirmation = "--confirm-local-projection";
if (!process.argv.includes(confirmation)) {
  throw new Error(`Pass ${confirmation} to submit a local monitoring anchor`);
}

const mirrorNodeUrl =
  process.env.HEDERA_MIRROR_NODE_URL ?? "https://testnet.mirrornode.hedera.com";
const topicId = process.env.HEDERA_PROJECTION_TOPIC_ID;
const cursor = process.env.HEDERA_PROJECTION_CURSOR;
const rpcUrl = process.env.LOCAL_EVM_RPC_URL ?? "http://127.0.0.1:8545";
const expectedChainId = BigInt(process.env.LOCAL_EVM_CHAIN_ID ?? "1337");
const contractAddress = process.env.LOCAL_HEDERA_ANCHOR_CONTRACT_ADDRESS;
const relayerIndex = Number(process.env.LOCAL_EVM_RELAYER_INDEX ?? "1");
const graphQueryUrl = process.env.HEDERA_PROJECTION_SUBGRAPH_QUERY_URL;
const timeoutMilliseconds = Number(
  process.env.HEDERA_PROJECTION_TIMEOUT_MS ?? "30000",
);

function requireLoopbackUrl(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} must be configured`);
  const parsed = new URL(value);
  if (
    parsed.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)
  ) {
    throw new Error(`${name} must be a private loopback HTTP endpoint`);
  }
  return parsed.toString();
}

if (!topicId?.match(/^\d+\.\d+\.\d+$/)) {
  throw new Error("HEDERA_PROJECTION_TOPIC_ID must be a Hedera topic ID");
}
if (!cursor?.match(/^\d+\.\d{1,9}$/)) {
  throw new Error(
    "HEDERA_PROJECTION_CURSOR must be the durable timestamp before the proof event",
  );
}
if (!isAddress(contractAddress)) {
  throw new Error(
    "LOCAL_HEDERA_ANCHOR_CONTRACT_ADDRESS must be an EVM address",
  );
}
if (!Number.isSafeInteger(relayerIndex) || relayerIndex < 0) {
  throw new Error("LOCAL_EVM_RELAYER_INDEX must be a nonnegative integer");
}
if (
  !Number.isSafeInteger(timeoutMilliseconds) ||
  timeoutMilliseconds < 1_000 ||
  timeoutMilliseconds > 120_000
) {
  throw new Error(
    "HEDERA_PROJECTION_TIMEOUT_MS must be between 1000 and 120000",
  );
}
const normalizedRpcUrl = requireLoopbackUrl("LOCAL_EVM_RPC_URL", rpcUrl);
const normalizedGraphUrl = requireLoopbackUrl(
  "HEDERA_PROJECTION_SUBGRAPH_QUERY_URL",
  graphQueryUrl,
);

const events: VerifiedHederaEvent[] = [];
let durableCursor: string | null = cursor;
await readVerifiedHederaEvents({
  mirrorNodeUrl,
  source: { type: "hcs_message", id: topicId },
  pageLimit: 100,
  cursorStore: {
    async load() {
      return durableCursor;
    },
    async save(_streamId, consensusTimestamp) {
      durableCursor = consensusTimestamp;
    },
  },
  async handle(event) {
    events.push(event);
  },
});
if (events.length !== 1) {
  throw new Error(
    `expected exactly one Mirror event after the configured cursor, received ${events.length}`,
  );
}
const verified = events[0];

const provider = new JsonRpcProvider(normalizedRpcUrl);
const network = await provider.getNetwork();
if (network.chainId !== expectedChainId) {
  throw new Error(
    `expected local chain ID ${expectedChainId}, received ${network.chainId}`,
  );
}
const relayer = await provider.getSigner(relayerIndex);
const contract = new Contract(
  contractAddress,
  [
    "function anchored(bytes32 sourceEventId) view returns (bool)",
    "function anchorHederaEvent(bytes32 sourceEventId,uint8 sourceType,string sourceId,bytes32 transactionHash,string consensusTimestamp,uint64 sourceIndex,string eventKind,bytes32 payloadDigest,uint16 schemaVersion)",
  ],
  relayer,
);
if (await contract.getFunction("anchored")(verified.sourceEventId)) {
  throw new Error("source event was already anchored before the proof run");
}

const anchor = verified.anchor;
const transaction = await contract.getFunction("anchorHederaEvent")(
  verified.sourceEventId,
  2,
  anchor.sourceId,
  anchor.transactionHash,
  anchor.consensusTimestamp,
  anchor.sourceIndex,
  anchor.eventKind,
  anchor.payloadDigest,
  1,
);
const receipt = (await transaction.wait()) as ContractTransactionReceipt | null;
if (!receipt || receipt.status !== 1) {
  throw new Error("destination anchor did not finalize successfully");
}

let replayRejected = false;
try {
  const replay = await contract.getFunction("anchorHederaEvent")(
    verified.sourceEventId,
    2,
    anchor.sourceId,
    anchor.transactionHash,
    anchor.consensusTimestamp,
    anchor.sourceIndex,
    anchor.eventKind,
    anchor.payloadDigest,
    1,
  );
  await replay.wait();
} catch {
  replayRejected = true;
}
if (!replayRejected) {
  throw new Error("destination contract accepted a source-event replay");
}

const query = `query ProjectionProof($id: Bytes!) {
  hederaEventAnchor(id: $id) {
    id
    sourceId
    hederaTransactionHash
    consensusTimestamp
    sourceIndex
    payloadDigest
    relayer
    destinationContract
    destinationTransactionHash
    destinationBlockNumber
  }
}`;
const deadline = Date.now() + timeoutMilliseconds;
let graphEntity: Record<string, string> | null = null;
while (Date.now() < deadline) {
  const response = await fetch(normalizedGraphUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query,
      variables: { id: verified.sourceEventId },
    }),
  });
  if (!response.ok) {
    throw new Error(`Graph query returned HTTP ${response.status}`);
  }
  const body = (await response.json()) as {
    data?: { hederaEventAnchor?: Record<string, string> | null };
    errors?: Array<{ message: string }>;
  };
  if (body.errors?.length) {
    throw new Error(`Graph query failed: ${body.errors[0].message}`);
  }
  graphEntity = body.data?.hederaEventAnchor ?? null;
  if (graphEntity) break;
  await new Promise((resolve) => setTimeout(resolve, 500));
}
if (!graphEntity) {
  throw new Error("Graph did not index the destination anchor before timeout");
}
if (
  graphEntity.id.toLowerCase() !== verified.sourceEventId.toLowerCase() ||
  graphEntity.hederaTransactionHash.toLowerCase() !==
    anchor.transactionHash.toLowerCase() ||
  graphEntity.consensusTimestamp !== anchor.consensusTimestamp ||
  graphEntity.destinationTransactionHash.toLowerCase() !==
    receipt.hash.toLowerCase()
) {
  throw new Error(
    "Graph entity does not match the source and destination proof",
  );
}

process.stdout.write(
  `${JSON.stringify(
    {
      source: {
        network: anchor.network,
        topicId,
        sourceEventId: verified.sourceEventId,
        consensusTimestamp: anchor.consensusTimestamp,
        sequenceNumber: anchor.sourceIndex,
        transactionIdentityDigest: anchor.transactionHash,
        payloadDigest: anchor.payloadDigest,
        mirrorVerified: verified.mirrorVerified,
        cursorAfterHandling: durableCursor,
      },
      destination: {
        network: "ganache-local",
        chainId: network.chainId.toString(),
        contractAddress,
        relayer: await relayer.getAddress(),
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        replayRejected,
      },
      graph: graphEntity,
      authority:
        "relayer-mediated monitoring only; Hedera Mirror and Postgres remain authoritative",
    },
    null,
    2,
  )}\n`,
);
