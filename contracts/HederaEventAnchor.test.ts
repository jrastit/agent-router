import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import solc from "solc";
import { describe, expect, it } from "vitest";

interface CompiledContract {
  abi: Array<{
    type: string;
    name?: string;
    inputs?: Array<{ name: string; type: string; indexed?: boolean }>;
  }>;
  evm: { bytecode: { object: string } };
}

function compile(): CompiledContract {
  const file = "HederaEventAnchor.sol";
  const source = readFileSync(resolve("contracts", file), "utf8");
  const output = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: "Solidity",
        sources: { [file]: { content: source } },
        settings: {
          evmVersion: "cancun",
          optimizer: { enabled: true, runs: 200 },
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
  return output.contracts[file].HederaEventAnchor;
}

describe("HederaEventAnchor", () => {
  it("compiles for the local EVM destination", () => {
    expect(compile().evm.bytecode.object).not.toBe("");
  });

  it("emits separate Hedera source and destination provenance fields", () => {
    const event = compile().abi.find(
      ({ type, name }) => type === "event" && name === "HederaEventAnchored",
    );

    expect(
      event?.inputs?.map(({ name, type, indexed }) => ({
        name,
        type,
        indexed,
      })),
    ).toEqual([
      { indexed: true, name: "sourceEventId", type: "bytes32" },
      { indexed: true, name: "sourceType", type: "uint8" },
      { indexed: false, name: "sourceId", type: "string" },
      { indexed: false, name: "transactionHash", type: "bytes32" },
      { indexed: false, name: "consensusTimestamp", type: "string" },
      { indexed: false, name: "sourceIndex", type: "uint64" },
      { indexed: false, name: "eventKind", type: "string" },
      { indexed: false, name: "payloadDigest", type: "bytes32" },
      { indexed: false, name: "schemaVersion", type: "uint16" },
      { indexed: true, name: "relayer", type: "address" },
    ]);
  });

  it("commits the relayer, replay, and public-data boundary in source", () => {
    const source = readFileSync(
      resolve("contracts", "HederaEventAnchor.sol"),
      "utf8",
    );

    expect(source).toContain("msg.sender != relayer");
    expect(source).toContain("anchored[sourceEventId]");
    expect(source).toContain("SourceEventAlreadyAnchored");
    expect(source).toContain("MUST NOT be used to create application credit");
    expect(source).not.toMatch(
      /privateKey|credential|prompt|providerResult|creditBalance/i,
    );
  });
});
