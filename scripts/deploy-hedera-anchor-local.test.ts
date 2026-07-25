import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("local Hedera anchor deployment", () => {
  const script = readFileSync("scripts/deploy-hedera-anchor-local.mjs", "utf8");

  it("refuses remote RPCs and unexpected chain IDs", () => {
    expect(script).toContain("--confirm-local-ganache");
    expect(script).toContain('"127.0.0.1", "localhost", "::1"');
    expect(script).toContain("RPC host must be loopback");
    expect(script).toContain("expected chain ID");
  });

  it("uses separate unlocked Ganache accounts for deployment and relay", () => {
    expect(script).toContain("deployerIndex");
    expect(script).toContain("relayerIndex");
    expect(script).toContain("deployerIndex === relayerIndex");
    expect(script).toContain("factory.deploy(relayerAddress)");
  });

  it("labels the contract as non-authoritative monitoring evidence", () => {
    expect(script).toContain("Hedera Mirror and Postgres remain authoritative");
  });
});
