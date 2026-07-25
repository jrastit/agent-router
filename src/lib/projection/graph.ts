import { z } from "zod";

import type { ProjectionGraph, ProjectionGraphEntity } from "./ingestion";

const bytes32Schema = z.custom<`0x${string}`>(
  (value) => typeof value === "string" && /^0x[a-f0-9]{64}$/.test(value),
  "expected a lowercase bytes32 value",
);

const graphResponseSchema = z.strictObject({
  data: z
    .strictObject({
      hederaEventAnchor: z
        .strictObject({
          id: bytes32Schema,
          hederaTransactionHash: bytes32Schema,
          consensusTimestamp: z.string().regex(/^[0-9]+\.[0-9]{1,9}$/),
          destinationTransactionHash: bytes32Schema,
          destinationBlockNumber: z.string().regex(/^(0|[1-9][0-9]*)$/),
        })
        .nullable(),
    })
    .optional(),
  errors: z.array(z.object({ message: z.string() }).passthrough()).optional(),
});

const anchorQuery = `
  query ProjectionAnchor($sourceEventId: ID!) {
    hederaEventAnchor(id: $sourceEventId) {
      id
      hederaTransactionHash
      consensusTimestamp
      destinationTransactionHash
      destinationBlockNumber
    }
  }
`;

export class ProjectionGraphClient implements ProjectionGraph {
  private readonly fetch: typeof globalThis.fetch;

  constructor(
    private readonly endpoint: string,
    fetchImplementation: typeof globalThis.fetch = globalThis.fetch,
  ) {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" && url.hostname !== "127.0.0.1") {
      throw new TypeError("Projection Graph endpoint must use HTTPS");
    }
    this.fetch = fetchImplementation;
  }

  async loadAnchor(
    sourceEventId: string,
  ): Promise<ProjectionGraphEntity | null> {
    if (!bytes32Schema.safeParse(sourceEventId).success) {
      throw new TypeError("source event ID must be a lowercase bytes32 value");
    }

    const response = await this.fetch(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: anchorQuery,
        variables: { sourceEventId },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Projection Graph returned HTTP ${response.status}`);
    }

    const parsed = graphResponseSchema.safeParse(await response.json());
    if (!parsed.success || !parsed.data.data || parsed.data.errors?.length) {
      throw new Error("Projection Graph returned malformed data");
    }
    return parsed.data.data.hederaEventAnchor;
  }
}
