import { describe, expect, it, vi } from "vitest";

import {
  readVerifiedHederaEvents,
  type ProjectionCursorStore,
} from "./mirror-reader";

function memoryCursor(initial: string | null = null): ProjectionCursorStore & {
  value: string | null;
} {
  return {
    value: initial,
    async load() {
      return this.value;
    },
    async save(_streamId, timestamp) {
      this.value = timestamp;
    },
  };
}

const log = {
  contract_id: "0.0.7001",
  transaction_hash: `0x${"ab".repeat(32)}`,
  timestamp: "1721234567.123456789",
  index: 2,
  data: "0x1234",
};

describe("readVerifiedHederaEvents", () => {
  it("filters one contract, handles ascending pages, and saves after handling", async () => {
    const cursor = memoryCursor();
    const order: string[] = [];
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            logs: [log],
            links: { next: "/api/v1/next-page" },
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            logs: [{ ...log, timestamp: "1721234568.000000001", index: 0 }],
            links: { next: null },
          }),
        ),
      );

    const result = await readVerifiedHederaEvents({
      mirrorNodeUrl: "https://mirror.example",
      source: { type: "contract_log", id: "0.0.7001" },
      cursorStore: {
        load: cursor.load.bind(cursor),
        async save(streamId, timestamp) {
          order.push(`save:${streamId}:${timestamp}`);
          await cursor.save(streamId, timestamp);
        },
      },
      fetcher,
      async handle(event) {
        order.push(`handle:${event.anchor.consensusTimestamp}`);
        expect(event.mirrorVerified).toBe(true);
      },
    });

    expect(result).toEqual({
      handled: 2,
      cursor: "1721234568.000000001",
    });
    expect(order).toEqual([
      "handle:1721234567.123456789",
      "save:contract_log:0.0.7001:1721234567.123456789",
      "handle:1721234568.000000001",
      "save:contract_log:0.0.7001:1721234568.000000001",
    ]);
    expect(fetcher.mock.calls[0][0]).toContain(
      "/api/v1/contracts/0.0.7001/results/logs?order=asc&limit=100",
    );
  });

  it("resumes strictly after the durable cursor and ignores duplicate responses", async () => {
    const cursor = memoryCursor(log.timestamp);
    const handle = vi.fn();
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ logs: [log], links: { next: null } })),
      );

    const result = await readVerifiedHederaEvents({
      mirrorNodeUrl: "https://mirror.example",
      source: { type: "contract_log", id: "0.0.7001" },
      cursorStore: cursor,
      fetcher,
      handle,
    });

    expect(fetcher.mock.calls[0][0]).toContain(
      "timestamp=gt%3A1721234567.123456789",
    );
    expect(handle).not.toHaveBeenCalled();
    expect(result.handled).toBe(0);
  });

  it("deduplicates repeated Mirror pages before durable handling", async () => {
    const cursor = memoryCursor();
    const handle = vi.fn();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            logs: [log],
            links: { next: "/api/v1/repeated-event" },
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ logs: [log], links: { next: null } })),
      );

    const result = await readVerifiedHederaEvents({
      mirrorNodeUrl: "https://mirror.example",
      source: { type: "contract_log", id: "0.0.7001" },
      cursorStore: cursor,
      fetcher,
      handle,
    });

    expect(result.handled).toBe(1);
    expect(handle).toHaveBeenCalledOnce();
  });

  it("orders events and commits a shared timestamp only after the whole group", async () => {
    const cursor = memoryCursor();
    const handled: number[] = [];
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            logs: [
              { ...log, timestamp: "1721234568.000000001", index: 3 },
              { ...log, index: 2 },
            ],
            links: { next: "/api/v1/older-page" },
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            logs: [{ ...log, timestamp: "1721234568.000000001", index: 1 }],
            links: { next: null },
          }),
        ),
      );

    const result = await readVerifiedHederaEvents({
      mirrorNodeUrl: "https://mirror.example",
      source: { type: "contract_log", id: "0.0.7001" },
      cursorStore: cursor,
      fetcher,
      async handle(event) {
        handled.push(event.anchor.sourceIndex);
      },
    });

    expect(handled).toEqual([2, 1, 3]);
    expect(result).toEqual({
      handled: 3,
      cursor: "1721234568.000000001",
    });
  });

  it("replays a timestamp group after a crash instead of skipping later events", async () => {
    const cursor = memoryCursor("1721234566.999999999");
    const page = {
      logs: [log, { ...log, index: 3 }],
      links: { next: null },
    };
    const firstHandle = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("worker crashed"));

    await expect(
      readVerifiedHederaEvents({
        mirrorNodeUrl: "https://mirror.example",
        source: { type: "contract_log", id: "0.0.7001" },
        cursorStore: cursor,
        fetcher: async () => new Response(JSON.stringify(page)),
        handle: firstHandle,
      }),
    ).rejects.toThrow("worker crashed");
    expect(cursor.value).toBe("1721234566.999999999");

    const replayHandle = vi.fn();
    const result = await readVerifiedHederaEvents({
      mirrorNodeUrl: "https://mirror.example",
      source: { type: "contract_log", id: "0.0.7001" },
      cursorStore: cursor,
      fetcher: async () => new Response(JSON.stringify(page)),
      handle: replayHandle,
    });

    expect(replayHandle).toHaveBeenCalledTimes(2);
    expect(result.cursor).toBe(log.timestamp);
  });

  it("does not advance the cursor when durable handling fails", async () => {
    const cursor = memoryCursor();
    await expect(
      readVerifiedHederaEvents({
        mirrorNodeUrl: "https://mirror.example",
        source: { type: "contract_log", id: "0.0.7001" },
        cursorStore: cursor,
        fetcher: async () =>
          new Response(JSON.stringify({ logs: [log], links: { next: null } })),
        handle: async () => {
          throw new Error("database unavailable");
        },
      }),
    ).rejects.toThrow("database unavailable");
    expect(cursor.value).toBeNull();
  });

  it("rejects malformed Mirror payloads before durable handling", async () => {
    const handle = vi.fn();
    await expect(
      readVerifiedHederaEvents({
        mirrorNodeUrl: "https://mirror.example",
        source: { type: "contract_log", id: "0.0.7001" },
        cursorStore: memoryCursor(),
        fetcher: async () =>
          new Response(
            JSON.stringify({
              logs: [{ ...log, transaction_hash: "not-a-hash" }],
              links: { next: null },
            }),
          ),
        handle,
      }),
    ).rejects.toThrow();
    expect(handle).not.toHaveBeenCalled();
  });

  it("rejects a source identity that does not match the configured topic", async () => {
    await expect(
      readVerifiedHederaEvents({
        mirrorNodeUrl: "https://mirror.example",
        source: { type: "hcs_message", id: "0.0.8001" },
        cursorStore: memoryCursor(),
        fetcher: async () =>
          new Response(
            JSON.stringify({
              messages: [
                {
                  topic_id: "0.0.8002",
                  consensus_timestamp: "1721234567.123456789",
                  sequence_number: 1,
                  message: "cHVibGlj",
                },
              ],
              links: { next: null },
            }),
          ),
        handle: vi.fn(),
      }),
    ).rejects.toThrow("mismatched HCS topic");
  });
});
