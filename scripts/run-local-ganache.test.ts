import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("local Ganache launcher", () => {
  it("keeps disposable wallet material out of process output", () => {
    const source = readFileSync("scripts/run-local-ganache.mjs", "utf8");

    expect(source).toContain('"127.0.0.1"');
    expect(source).toContain('"1337"');
    expect(source).toContain('"3"');
    expect(source).toContain('stdio: ["inherit", "ignore", "pipe"]');
    expect(source).not.toContain("wallet.mnemonic");
    expect(source).not.toContain("wallet.accountKeysPath");
  });
});
