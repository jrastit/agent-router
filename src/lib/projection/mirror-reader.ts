import { createHash } from "node:crypto";

import { z } from "zod";

import {
  createHederaSourceEventId,
  hederaEventAnchorSchema,
  type HederaEventAnchor,
} from "./anchor";

const mirrorLinksSchema = z
  .object({ next: z.string().nullable().optional() })
  .passthrough();

const contractLogSchema = z
  .object({
    contract_id: z.string(),
    transaction_hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    timestamp: z.string().regex(/^\d+\.\d{1,9}$/),
    index: z.number().int().nonnegative(),
    data: z.string().regex(/^0x[a-fA-F0-9]*$/),
  })
  .passthrough();

const contractLogsResponseSchema = z
  .object({
    logs: z.array(contractLogSchema),
    links: mirrorLinksSchema.optional(),
  })
  .passthrough();

const topicMessageSchema = z
  .object({
    topic_id: z.string(),
    consensus_timestamp: z.string().regex(/^\d+\.\d{1,9}$/),
    sequence_number: z.number().int().nonnegative(),
    message: z.string(),
    chunk_info: z
      .object({ initial_transaction_id: z.string() })
      .passthrough()
      .optional(),
  })
  .passthrough();

const topicMessagesResponseSchema = z
  .object({
    messages: z.array(topicMessageSchema),
    links: mirrorLinksSchema.optional(),
  })
  .passthrough();

export type ProjectionCursorStore = {
  load(streamId: string): Promise<string | null>;
  save(streamId: string, consensusTimestamp: string): Promise<void>;
};

export type VerifiedHederaEvent = {
  sourceEventId: `0x${string}`;
  anchor: HederaEventAnchor;
  mirrorVerified: true;
};

export type HederaMirrorSource =
  { type: "contract_log"; id: string } | { type: "hcs_message"; id: string };

function sha256Bytes32(value: string): `0x${string}` {
  return `0x${createHash("sha256").update(value).digest("hex")}`;
}

function nextUrl(
  baseUrl: string,
  next: string | null | undefined,
): string | null {
  if (!next) return null;
  return new URL(next, `${baseUrl.replace(/\/$/, "")}/`).toString();
}

export async function readVerifiedHederaEvents(input: {
  mirrorNodeUrl: string;
  source: HederaMirrorSource;
  cursorStore: ProjectionCursorStore;
  handle: (event: VerifiedHederaEvent) => Promise<void>;
  fetcher?: typeof fetch;
  pageLimit?: number;
}): Promise<{ handled: number; cursor: string | null }> {
  const fetcher = input.fetcher ?? fetch;
  const baseUrl = input.mirrorNodeUrl.replace(/\/$/, "");
  const streamId = `${input.source.type}:${input.source.id}`;
  let cursor = await input.cursorStore.load(streamId);
  const resource =
    input.source.type === "contract_log"
      ? `/api/v1/contracts/${encodeURIComponent(input.source.id)}/results/logs`
      : `/api/v1/topics/${encodeURIComponent(input.source.id)}/messages`;
  const params = new URLSearchParams({
    order: "asc",
    limit: String(input.pageLimit ?? 100),
  });
  if (cursor) params.set("timestamp", `gt:${cursor}`);
  let url: string | null = `${baseUrl}${resource}?${params}`;
  let handled = 0;

  while (url) {
    const response = await fetcher(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`mirror node returned HTTP ${response.status}`);
    }
    const body: unknown = await response.json();
    let events: HederaEventAnchor[];
    let next: string | null;

    if (input.source.type === "contract_log") {
      const page = contractLogsResponseSchema.parse(body);
      events = page.logs.map((log) => {
        if (log.contract_id !== input.source.id) {
          throw new Error("mirror response contained a mismatched contract");
        }
        return hederaEventAnchorSchema.parse({
          version: "1",
          network: "hedera-testnet",
          sourceType: "contract_log",
          sourceId: log.contract_id,
          transactionHash: log.transaction_hash,
          consensusTimestamp: log.timestamp,
          sourceIndex: log.index,
          eventKind: "contract.log",
          payloadDigest: sha256Bytes32(log.data.toLowerCase()),
        });
      });
      next = nextUrl(baseUrl, page.links?.next);
    } else {
      const page = topicMessagesResponseSchema.parse(body);
      events = page.messages.map((message) => {
        if (message.topic_id !== input.source.id) {
          throw new Error("mirror response contained a mismatched HCS topic");
        }
        return hederaEventAnchorSchema.parse({
          version: "1",
          network: "hedera-testnet",
          sourceType: "hcs_message",
          sourceId: message.topic_id,
          transactionHash: sha256Bytes32(
            message.chunk_info?.initial_transaction_id ??
              `${message.topic_id}@${message.consensus_timestamp}`,
          ),
          consensusTimestamp: message.consensus_timestamp,
          sourceIndex: message.sequence_number,
          eventKind: "hcs.message",
          payloadDigest: sha256Bytes32(message.message),
        });
      });
      next = nextUrl(baseUrl, page.links?.next);
    }

    for (const anchor of events) {
      if (cursor && anchor.consensusTimestamp <= cursor) continue;
      await input.handle({
        sourceEventId: createHederaSourceEventId(anchor),
        anchor,
        mirrorVerified: true,
      });
      await input.cursorStore.save(streamId, anchor.consensusTimestamp);
      cursor = anchor.consensusTimestamp;
      handled += 1;
    }
    url = next;
  }

  return { handled, cursor };
}
