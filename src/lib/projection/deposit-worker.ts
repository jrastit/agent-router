import { createHash } from "node:crypto";

import { Contract, JsonRpcProvider, type Log } from "ethers";
import { z } from "zod";

import {
  createHederaSourceEventId,
  createProjectionIdempotencyKey,
  hederaEventAnchorSchema,
  type HederaEventAnchor,
} from "./anchor";

const outboxSchema = z.object({
  deposit_id: z.string(),
  payload: z.object({
    version: z.literal("1"),
    depositId: z.string(),
    userPseudonym: z.string(),
    transactionHash: z.string(),
    amountTinybars: z.string().regex(/^[1-9]\d*$/),
    verifiedAt: z.string(),
  }),
});
const depositSchema = z.object({
  consensus_timestamp: z.string().regex(/^\d+\.\d+$/),
});
const intentSchema = z.object({ treasury_account: z.string() });
const projectionSchema = z.object({
  state: z.enum([
    "verified",
    "submitting",
    "submitted",
    "confirmed",
    "retry_wait",
    "failed_terminal",
  ]),
  destination_transaction_hash: z.string().nullable(),
  destination_nonce: z.union([z.number(), z.string()]).nullable(),
  destination_block_number: z.union([z.number(), z.string()]).nullable(),
});

export type DepositProjectionWorkerConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
  rpcUrl: string;
  chainId: bigint;
  contractAddress: string;
  relayerIndex: number;
  graphUrl: string;
  fetcher?: typeof fetch;
};

function digest(value: string): `0x${string}` {
  return `0x${createHash("sha256").update(value).digest("hex")}`;
}

function stablePayloadDigest(payload: z.infer<typeof outboxSchema>["payload"]) {
  return digest(
    [
      payload.version,
      payload.depositId,
      payload.userPseudonym,
      payload.transactionHash,
      payload.amountTinybars,
      payload.verifiedAt,
    ].join("|"),
  );
}

export function createDepositProjectionAnchor(input: {
  treasuryAccount: string;
  consensusTimestamp: string;
  payload: z.infer<typeof outboxSchema>["payload"];
}): HederaEventAnchor {
  return hederaEventAnchorSchema.parse({
    version: "1",
    network: "hedera-testnet",
    sourceType: "native_transfer",
    sourceId: input.treasuryAccount,
    transactionHash: digest(input.payload.transactionHash),
    consensusTimestamp: input.consensusTimestamp,
    sourceIndex: 0,
    eventKind: "deposit.credited",
    payloadDigest: stablePayloadDigest(input.payload),
  });
}

function headers(config: DepositProjectionWorkerConfig) {
  return {
    apikey: config.serviceRoleKey,
    authorization: `Bearer ${config.serviceRoleKey}`,
    "content-type": "application/json",
  };
}

async function restRows(
  config: DepositProjectionWorkerConfig,
  path: string,
): Promise<unknown> {
  const response = await (config.fetcher ?? fetch)(
    `${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`,
    { headers: headers(config), signal: AbortSignal.timeout(15_000) },
  );
  if (!response.ok)
    throw new Error(`projection read failed (${response.status})`);
  return response.json();
}

async function rpc(
  config: DepositProjectionWorkerConfig,
  name: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const response = await (config.fetcher ?? fetch)(
    `${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${name}`,
    {
      method: "POST",
      headers: headers(config),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok) {
    throw new Error(`projection ${name} failed (${response.status})`);
  }
  return response.json();
}

async function waitForGraph(
  config: DepositProjectionWorkerConfig,
  sourceEventId: string,
  transactionHash: string,
): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const response = await (config.fetcher ?? fetch)(config.graphUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query:
          "query($id: Bytes!) { hederaEventAnchor(id: $id) { id destinationTransactionHash } }",
        variables: { id: sourceEventId },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) {
      const body = (await response.json()) as {
        data?: {
          hederaEventAnchor?: {
            id: string;
            destinationTransactionHash: string;
          } | null;
        };
      };
      const entity = body.data?.hederaEventAnchor;
      if (
        entity?.id.toLowerCase() === sourceEventId.toLowerCase() &&
        entity.destinationTransactionHash.toLowerCase() ===
          transactionHash.toLowerCase()
      ) {
        return;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Graph indexing timed out");
}

const contractAbi = [
  "function anchored(bytes32 sourceEventId) view returns (bool)",
  "function anchorHederaEvent(bytes32 sourceEventId,uint8 sourceType,string sourceId,bytes32 transactionHash,string consensusTimestamp,uint64 sourceIndex,string eventKind,bytes32 payloadDigest,uint16 schemaVersion)",
  "event HederaEventAnchored(bytes32 indexed sourceEventId,uint8 indexed sourceType,string sourceId,bytes32 transactionHash,string consensusTimestamp,uint64 sourceIndex,string eventKind,bytes32 payloadDigest,uint16 schemaVersion,address indexed relayer)",
];

export async function processDepositProjectionOutbox(
  config: DepositProjectionWorkerConfig,
): Promise<{ projected: number; remaining: number }> {
  const outbox = z
    .array(outboxSchema)
    .parse(
      await restRows(
        config,
        "monitoring_projection_outbox?select=deposit_id,payload&delivered_at=is.null&order=created_at.asc&limit=20",
      ),
    );
  const provider = new JsonRpcProvider(config.rpcUrl);
  const network = await provider.getNetwork();
  if (network.chainId !== config.chainId)
    throw new Error("projection chain mismatch");
  const signer = await provider.getSigner(config.relayerIndex);
  const contract = new Contract(config.contractAddress, contractAbi, signer);
  let projected = 0;

  for (const item of outbox) {
    const id = encodeURIComponent(item.deposit_id);
    const deposit = depositSchema.parse(
      z
        .array(z.unknown())
        .length(1)
        .parse(
          await restRows(
            config,
            `deposits?select=consensus_timestamp&id=eq.${id}`,
          ),
        )[0],
    );
    const intent = intentSchema.parse(
      z
        .array(z.unknown())
        .length(1)
        .parse(
          await restRows(
            config,
            `deposit_intents?select=treasury_account&id=eq.${id}`,
          ),
        )[0],
    );
    const anchor = createDepositProjectionAnchor({
      treasuryAccount: intent.treasury_account,
      consensusTimestamp: deposit.consensus_timestamp,
      payload: item.payload,
    });
    const sourceEventId = createHederaSourceEventId(anchor);
    let record = projectionSchema.parse(
      await rpc(config, "persist_verified_hedera_projection", {
        target_source_event_id: sourceEventId,
        target_deposit_id: item.deposit_id,
        target_stream_id: `native_transfer:${intent.treasury_account}`,
        target_consensus_timestamp: anchor.consensusTimestamp,
        target_anchor: anchor,
        verified_at: item.payload.verifiedAt,
        request_key: createProjectionIdempotencyKey(anchor),
      }),
    );

    let transactionHash = record.destination_transaction_hash;
    let blockNumber = record.destination_block_number;
    if (record.state !== "confirmed") {
      if (!transactionHash) {
        const existing = (await contract.queryFilter(
          contract.filters.HederaEventAnchored(sourceEventId),
          0,
          "latest",
        )) as Log[];
        if (existing[0]) {
          transactionHash = existing[0].transactionHash;
        } else {
          const nonce = await provider.getTransactionCount(
            await signer.getAddress(),
            "pending",
          );
          record = projectionSchema.parse(
            await rpc(config, "start_hedera_projection_attempt", {
              target_source_event_id: sourceEventId,
              target_request_key: createProjectionIdempotencyKey(anchor),
              target_destination_chain_id: config.chainId.toString(),
              target_nonce: nonce,
              max_fee_wei: "2000000000",
              target_gas_limit: "500000",
            }),
          );
          const transaction = await contract.anchorHederaEvent(
            sourceEventId,
            3,
            anchor.sourceId,
            anchor.transactionHash,
            anchor.consensusTimestamp,
            0,
            anchor.eventKind,
            anchor.payloadDigest,
            1,
            { nonce, gasLimit: 500_000 },
          );
          transactionHash = transaction.hash;
          await rpc(config, "record_hedera_projection_submission", {
            target_source_event_id: sourceEventId,
            transaction_hash: transactionHash,
            transaction_nonce: nonce,
          });
        }
      }
      if (!transactionHash) {
        throw new Error("projection transaction recovery failed");
      }
      const receipt = await provider.waitForTransaction(
        transactionHash,
        1,
        20_000,
      );
      if (!receipt || receipt.status !== 1)
        throw new Error("projection did not confirm");
      blockNumber = receipt.blockNumber;
      await rpc(config, "confirm_hedera_projection", {
        target_source_event_id: sourceEventId,
        transaction_hash: transactionHash,
        destination_block: receipt.blockNumber,
        block_hash: receipt.blockHash,
      });
    }
    if (!transactionHash || blockNumber === null) {
      throw new Error("confirmed projection evidence is incomplete");
    }
    await waitForGraph(config, sourceEventId, transactionHash);
    await rpc(config, "complete_deposit_graph_projection", {
      target_deposit_id: item.deposit_id,
      target_source_event_id: sourceEventId,
      transaction_hash: transactionHash,
      destination_block: Number(blockNumber),
    });
    projected += 1;
  }
  return { projected, remaining: outbox.length - projected };
}
