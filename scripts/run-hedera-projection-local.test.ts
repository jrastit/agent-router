import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync("scripts/run-hedera-projection-local.ts", "utf8");

describe("local Hedera projection proof runner", () => {
  it("requires an explicit local-only proof configuration", () => {
    expect(source).toContain("--confirm-local-projection");
    expect(source).toContain("must be a private loopback HTTP endpoint");
    expect(source).toContain("HEDERA_PROJECTION_CURSOR");
    expect(source).toContain("expected exactly one Mirror event");
  });

  it("verifies destination replay and exact Graph correlation", () => {
    expect(source).toContain("source event was already anchored");
    expect(source).toContain("replayRejected");
    expect(source).toContain("Graph entity does not match");
    expect(source).toContain("Hedera Mirror and Postgres remain authoritative");
  });
});
