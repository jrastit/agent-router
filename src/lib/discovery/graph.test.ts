import { describe, expect, it, vi } from "vitest";

import { DiscoveryError } from "./errors";
import { GraphDiscoveryAdapter } from "./graph";

const now = "2026-07-25T12:00:00.000Z";
const query = {
  jobId: "job_graph",
  capability: "summarize",
  inputType: "text",
  outputType: "text",
  now,
};

function graphPayload(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      _meta: { block: { number: 123 } },
      providerOffers: [
        {
          id: "off_graph_1",
          capability: "summarize",
          inputType: "text",
          outputType: "text",
          currency: "USD",
          amountMinor: "4",
          expectedLatencyMs: "1200",
          quoteTtlSeconds: "300",
          updatedAt: String(Date.parse(now) / 1000),
          provider: {
            id: "prv_graph_1",
            name: "Indexed Provider",
            capabilities: ["summarize"],
            privacyClasses: ["public"],
            settlementAccount: "0.0.6102001",
            active: true,
          },
          ...overrides,
        },
      ],
    },
  };
}

function adapter(payload: unknown, status = 200) {
  const fetch = vi.fn(
    async () =>
      new Response(JSON.stringify(payload), {
        status,
        headers: { "content-type": "application/json" },
      }),
  );
  return {
    fetch,
    adapter: new GraphDiscoveryAdapter({
      endpoint: "https://gateway.thegraph.com/api/subgraphs/id/example",
      deploymentId: "QmExample",
      network: "base-sepolia",
      maxStalenessMs: 60_000,
      fetch,
    }),
  };
}

async function expectCode(
  promise: Promise<unknown>,
  code: DiscoveryError["code"],
) {
  await expect(promise).rejects.toMatchObject({ name: "DiscoveryError", code });
}

describe("GraphDiscoveryAdapter", () => {
  it("normalizes live records and retains Graph provenance", async () => {
    const configured = adapter(graphPayload());
    const result = await configured.adapter.discover(query);

    expect(result.providers[0]).toMatchObject({
      provider: { id: "prv_graph_1" },
      offer: { id: "off_graph_1", price: { amountMinor: 4 } },
      quote: { jobId: "job_graph" },
    });
    expect(result.source).toEqual({
      kind: "the-graph",
      label: "provider-registry",
      deploymentId: "QmExample",
      network: "base-sepolia",
      endpoint: "https://gateway.thegraph.com/api/subgraphs/id/example",
      blockNumber: 123,
    });
    expect(configured.fetch).toHaveBeenCalledOnce();
  });

  it("fails closed for empty and stale indexed results", async () => {
    const empty = adapter({ data: { providerOffers: [] } }).adapter.discover(
      query,
    );
    const stale = adapter(
      graphPayload({ updatedAt: String(Date.parse(now) / 1000 - 61) }),
    ).adapter.discover(query);

    await expectCode(empty, "DISCOVERY_EMPTY");
    await expectCode(stale, "DISCOVERY_STALE");
  });

  it("fails closed for malformed and unavailable responses", async () => {
    await expectCode(
      adapter({ data: { providerOffers: [{ id: "bad" }] } }).adapter.discover(
        query,
      ),
      "DISCOVERY_MALFORMED",
    );
    await expectCode(
      adapter({ message: "down" }, 503).adapter.discover(query),
      "DISCOVERY_UNAVAILABLE",
    );
  });

  it("does not silently substitute fixtures when the network fails", async () => {
    const fetch = vi.fn(async () => {
      throw new Error("offline");
    });
    const configured = new GraphDiscoveryAdapter({
      endpoint: "https://gateway.thegraph.com/api/subgraphs/id/example",
      deploymentId: "QmExample",
      network: "base-sepolia",
      maxStalenessMs: 60_000,
      fetch,
    });

    await expectCode(configured.discover(query), "DISCOVERY_UNAVAILABLE");
  });
});
