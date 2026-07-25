import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("0G provenance deployment guard", () => {
  const script = readFileSync("scripts/deploy-0g-provenance.mjs", "utf8");

  it("binds testnet and mainnet confirmations to exact chain IDs", () => {
    expect(script).toContain('"--confirm-live-testnet"');
    expect(script).toContain("chainId: 16602n");
    expect(script).toContain('"--confirm-live-mainnet"');
    expect(script).toContain("chainId: 16661n");
    expect(script).toContain("Refusing deployment");
  });
});
