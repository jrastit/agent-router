import { describe, expect, it } from "vitest";

import { createDiscoveryAdapter } from "./create-adapter";
import { FixtureDiscoveryAdapter } from "./fixtures";
import { GraphDiscoveryAdapter } from "./graph";

describe("createDiscoveryAdapter", () => {
  it("selects an explicitly labeled fixture source", () => {
    expect(createDiscoveryAdapter({ source: "fixture" })).toBeInstanceOf(
      FixtureDiscoveryAdapter,
    );
  });

  it("selects The Graph only with complete live configuration", () => {
    expect(
      createDiscoveryAdapter({
        source: "the-graph",
        endpoint: "https://gateway.thegraph.com/api/subgraphs/id/example",
        deploymentId: "QmExample",
        network: "hedera-testnet",
        maxStalenessMs: 60_000,
      }),
    ).toBeInstanceOf(GraphDiscoveryAdapter);
  });
});
