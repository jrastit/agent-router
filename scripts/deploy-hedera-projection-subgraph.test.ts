import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("Hedera projection Subgraph deployment", () => {
  const source = readFileSync(
    "scripts/deploy-hedera-projection-subgraph.mjs",
    "utf8",
  );

  it("requires explicit local confirmation and loopback services", () => {
    expect(source).toContain("--confirm-local-graph-node");
    expect(source).toContain("must be a private loopback HTTP endpoint");
    expect(source).toContain("LOCAL_HEDERA_ANCHOR_CONTRACT_ADDRESS");
    expect(source).toContain("LOCAL_HEDERA_ANCHOR_START_BLOCK");
  });

  it("deploys the projection manifest with a private temporary network file", () => {
    expect(source).toContain('"ganache-local"');
    expect(source).toContain("graph/hedera-projection/subgraph.yaml");
    expect(source).toContain("{ mode: 0o600 }");
    expect(source).toContain("await rm(temporaryDirectory");
  });

  it("labels the indexed entity as monitoring rather than payment truth", () => {
    expect(source).toContain(
      "relayer-mediated monitoring only; Hedera Mirror and Postgres remain authoritative",
    );
  });
});
