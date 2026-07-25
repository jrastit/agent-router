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
  maxPages?: number;
}): Promise<{ handled: number; cursor: string | null }> {
  const fetcher = input.fetcher ?? fetch;
  const baseUrl = input.mirrorNodeUrl.replace(/\/$/, "");
  const streamId = `${input.source.type}:${input.source.id}`;
  let cursor = await input.cursorStore.load(streamId);
  const initialCursor = cursor;
  const maxPages = input.maxPages ?? 1_000;
  if (!Number.isSafeInteger(maxPages) || maxPages < 1) {
    throw new Error("invalid Mirror page limit");
  }
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
  let pageCount = 0;
  const visitedUrls = new Set<string>();
  const verified = new Map<`0x${string}`, VerifiedHederaEvent>();

  while (url) {
    pageCount += 1;
    if (pageCount > maxPages) {
      throw new Error("Mirror pagination exceeded the configured bound");
    }
    if (visitedUrls.has(url)) {
      throw new Error("Mirror pagination repeated a page");
    }
    visitedUrls.add(url);
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
      if (
        initialCursor &&
        compareConsensusTimestamps(anchor.consensusTimestamp, initialCursor) <=
          0
      ) {
        continue;
      }
      const event = {
        sourceEventId: createHederaSourceEventId(anchor),
        anchor,
        mirrorVerified: true,
      } satisfies VerifiedHederaEvent;
      const duplicate = verified.get(event.sourceEventId);
      if (duplicate) {
        if (JSON.stringify(duplicate.anchor) !== JSON.stringify(event.anchor)) {
          throw new Error("Mirror response changed a duplicate source event");
        }
        continue;
      }
      verified.set(event.sourceEventId, event);
    }
    url = next;
  }

  const ordered = [...verified.values()].sort((left, right) => {
    const timestampOrder = compareConsensusTimestamps(
      left.anchor.consensusTimestamp,
      right.anchor.consensusTimestamp,
    );
    if (timestampOrder !== 0) return timestampOrder;
    if (left.anchor.sourceIndex !== right.anchor.sourceIndex) {
      return left.anchor.sourceIndex - right.anchor.sourceIndex;
    }
    return left.sourceEventId.localeCompare(right.sourceEventId);
  });

  for (let index = 0; index < ordered.length;) {
    const timestamp = ordered[index].anchor.consensusTimestamp;
    const group: VerifiedHederaEvent[] = [];
    while (
      index < ordered.length &&
      compareConsensusTimestamps(
        ordered[index].anchor.consensusTimestamp,
        timestamp,
      ) === 0
    ) {
      group.push(ordered[index]);
      index += 1;
    }
    for (const event of group) {
      await input.handle(event);
      handled += 1;
    }
    await input.cursorStore.save(streamId, timestamp);
    cursor = timestamp;
  }

  return { handled, cursor };
}

function compareConsensusTimestamps(left: string, right: string): number {
  const parts = (value: string): [bigint, bigint] => {
    const match = /^(\d+)\.(\d{1,9})$/.exec(value);
    if (!match) throw new Error("invalid consensus timestamp");
    return [BigInt(match[1]), BigInt(match[2].padEnd(9, "0"))];
  };
  const [leftSeconds, leftNanos] = parts(left);
  const [rightSeconds, rightNanos] = parts(right);
  if (leftSeconds !== rightSeconds) return leftSeconds < rightSeconds ? -1 : 1;
  if (leftNanos === rightNanos) return 0;
  return leftNanos < rightNanos ? -1 : 1;
}
