import { readFileSync } from "node:fs";

import solc from "solc";
import { describe, expect, it } from "vitest";

describe("Hedera app-event Subgraph", () => {
  it("keeps its committed ABI aligned with the Solidity event", () => {
    const file = "HederaAppEventJournal.sol";
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
    const compiledEvent = output.contracts[file].HederaAppEventJournal.abi.find(
      ({ type, name }: { type: string; name?: string }) =>
        type === "event" && name === "AppEventRecorded",
    );
    const committedAbi = JSON.parse(
      readFileSync("graph/app-events/abis/HederaAppEventJournal.json", "utf8"),
    );

    expect(
      committedAbi.find(
        ({ type, name }: { type: string; name?: string }) =>
          type === "event" && name === "AppEventRecorded",
      ),
    ).toEqual(compiledEvent);
  });

  it("derives receipt-correlation fields from chain context", () => {
    const mapping = readFileSync("graph/app-events/src/mapping.ts", "utf8");

    expect(mapping).toContain(
      "const entity = new AppEvent(event.params.eventId)",
    );
    expect(mapping).toContain("event.transaction.hash");
    expect(mapping).toContain("event.block.number");
    expect(mapping).toContain("event.logIndex");
  });

  it("ships deployment placeholders instead of claiming live evidence", () => {
    const networks = JSON.parse(
      readFileSync("graph/app-events/networks.example.json", "utf8"),
    );

    expect(networks["hedera-testnet"].HederaAppEventJournal).toStrictEqual({
      address: "0x0000000000000000000000000000000000000000",
      startBlock: 0,
    });
  });
});
