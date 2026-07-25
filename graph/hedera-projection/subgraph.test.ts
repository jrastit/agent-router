import { readFileSync } from "node:fs";

import solc from "solc";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

describe("Hedera projection Subgraph", () => {
  it("keeps its committed ABI aligned with the destination event", () => {
    const file = "HederaEventAnchor.sol";
    const source = readFileSync(`contracts/${file}`, "utf8");
    const output = JSON.parse(
      solc.compile(
        JSON.stringify({
          language: "Solidity",
          sources: { [file]: { content: source } },
          settings: { outputSelection: { "*": { "*": ["abi"] } } },
        }),
      ),
    );
    const compiledEvents = output.contracts[file].HederaEventAnchor.abi.filter(
      ({ type }: { type: string }) => type === "event",
    );
    const committedAbi = JSON.parse(
      readFileSync(
        "graph/hedera-projection/abis/HederaEventAnchor.json",
        "utf8",
      ),
    );

    expect(
      committedAbi.filter(({ type }: { type: string }) => type === "event"),
    ).toEqual(compiledEvents);
  });

  it("keeps Hedera source and destination provenance separate", () => {
    const schema = readFileSync(
      "graph/hedera-projection/schema.graphql",
      "utf8",
    );
    const mapping = readFileSync(
      "graph/hedera-projection/src/mapping.ts",
      "utf8",
    );

    expect(schema).toContain("hederaTransactionHash: Bytes!");
    expect(schema).toContain("destinationTransactionHash: Bytes!");
    expect(mapping).toContain("event.params.transactionHash");
    expect(mapping).toContain("event.transaction.hash");
    expect(mapping).toContain("event.params.consensusTimestamp");
    expect(mapping).toContain("event.params.sourceId");
  });

  it("ships local deployment placeholders instead of transient evidence", () => {
    const manifest = parse(
      readFileSync("graph/hedera-projection/subgraph.yaml", "utf8"),
    );
    const networks = JSON.parse(
      readFileSync("graph/hedera-projection/networks.example.json", "utf8"),
    );

    expect(manifest.dataSources[0].network).toBe("ganache-local");
    expect(networks["ganache-local"].HederaEventAnchor).toStrictEqual({
      address: "0x0000000000000000000000000000000000000000",
      startBlock: 0,
    });
  });
});
