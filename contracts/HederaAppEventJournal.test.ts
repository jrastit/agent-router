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
  const file = "HederaAppEventJournal.sol";
  const source = readFileSync(resolve("contracts", file), "utf8");
  const output = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: "Solidity",
        sources: { [file]: { content: source } },
        settings: {
          evmVersion: "paris",
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
  return output.contracts[file].HederaAppEventJournal;
}

describe("HederaAppEventJournal", () => {
  it("compiles for a conservative Hedera EVM target", () => {
    expect(compile().evm.bytecode.object).not.toBe("");
  });

  it("exposes the stable event contract required by the Subgraph", () => {
    const event = compile().abi.find(
      ({ type, name }) => type === "event" && name === "AppEventRecorded",
    );

    expect(event?.inputs).toEqual([
      {
        indexed: true,
        internalType: "bytes32",
        name: "eventId",
        type: "bytes32",
      },
      {
        indexed: true,
        internalType: "bytes32",
        name: "subject",
        type: "bytes32",
      },
      { indexed: false, internalType: "string", name: "kind", type: "string" },
      {
        indexed: false,
        internalType: "bytes32",
        name: "payloadDigest",
        type: "bytes32",
      },
      {
        indexed: false,
        internalType: "uint16",
        name: "version",
        type: "uint16",
      },
    ]);
  });

  it("exposes exact economic lifecycle events in integer tinybars", () => {
    const event = compile().abi.find(
      ({ type, name }) => type === "event" && name === "EconomicEventRecorded",
    );

    expect(
      event?.inputs?.map(({ name, type, indexed }) => ({
        name,
        type,
        indexed,
      })),
    ).toEqual([
      { indexed: true, name: "eventId", type: "bytes32" },
      { indexed: true, name: "subject", type: "bytes32" },
      { indexed: true, name: "eventType", type: "uint8" },
      { indexed: false, name: "amountTinybars", type: "int64" },
      { indexed: false, name: "referenceId", type: "bytes32" },
      { indexed: false, name: "payloadDigest", type: "bytes32" },
      { indexed: false, name: "version", type: "uint16" },
    ]);
  });

  it("commits replay, publisher, and public-data guards in source", () => {
    const source = readFileSync(
      resolve("contracts", "HederaAppEventJournal.sol"),
      "utf8",
    );

    expect(source).toContain("msg.sender != publisher");
    expect(source).toContain("recorded[eventId]");
    expect(source).toContain("bytes(kind).length > 64");
    expect(source).toContain("eventType > RECONCILIATION_OPENED");
    expect(source).toContain("amountTinybars == 0");
    expect(source).not.toMatch(/privateKey|prompt|result|credential/i);
  });
});
