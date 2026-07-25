import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("Hedera app-event deployment guards", () => {
  it("pins contract deployment to Hedera Testnet", () => {
    const script = readFileSync("scripts/deploy-hedera-app-events.mjs", "utf8");

    expect(script).toContain("--confirm-live-testnet");
    expect(script).toContain("network.chainId !== 296n");
    expect(script).toContain('evmVersion: "paris"');
    expect(script).not.toContain("console.log(privateKey");
  });

  it("requires precomputed digests for public event submission", () => {
    const script = readFileSync("scripts/emit-hedera-app-event.mjs", "utf8");

    expect(script).toContain("must be a precomputed 32-byte digest");
    expect(script).toContain("network.chainId !== 296n");
    expect(script).not.toMatch(/HEDERA_APP_EVENT_(PROMPT|RESULT|CREDENTIAL)/);
  });

  it("keeps economic lifecycle amounts exact and bounded", () => {
    const script = readFileSync(
      "scripts/emit-hedera-economic-event.mjs",
      "utf8",
    );

    expect(script).toContain("BigInt(config.amountTinybars)");
    expect(script).toContain("amountTinybars < -(2n ** 63n)");
    expect(script).toContain(
      "eventType: process.env.HEDERA_ECONOMIC_EVENT_TYPE",
    );
    expect(script).not.toMatch(/parseFloat|Number\(config\.amountTinybars\)/);
  });

  it("restricts Graph administration and IPFS uploads to loopback", () => {
    const script = readFileSync("scripts/deploy-hedera-subgraph.mjs", "utf8");

    expect(script).toContain("--confirm-private-graph-node");
    expect(script).toContain("must be a private loopback HTTP endpoint");
    expect(script).toContain('"subgraph_create"');
    expect(script).toContain('"graph/app-events/subgraph.yaml"');
  });
});
