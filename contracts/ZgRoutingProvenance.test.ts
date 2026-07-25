import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import solc from "solc";
import { describe, expect, it } from "vitest";

describe("ZgRoutingProvenance", () => {
  it("compiles without Solidity errors", () => {
    const file = "ZgRoutingProvenance.sol";
    const source = readFileSync(resolve("contracts", file), "utf8");
    const output = JSON.parse(
      solc.compile(
        JSON.stringify({
          language: "Solidity",
          sources: { [file]: { content: source } },
          settings: {
            evmVersion: "cancun",
            outputSelection: {
              "*": { "*": ["abi", "evm.bytecode.object"] },
            },
          },
        }),
      ),
    );
    const errors = (output.errors ?? []).filter(
      (error: { severity: string }) => error.severity === "error",
    );

    expect(errors).toEqual([]);
    expect(
      output.contracts[file].ZgRoutingProvenance.evm.bytecode.object,
    ).not.toBe("");
  });
});
