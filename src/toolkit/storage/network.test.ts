import { describe, expect, it } from "vitest";

import { resolveZgStorageNetwork, zgStorageNetworks } from "./network";

describe("0G Storage networks", () => {
  it("binds Aristotle mainnet to its chain and indexer", () => {
    expect(zgStorageNetworks["0g-aristotle-mainnet"]).toEqual({
      chainId: BigInt(16661),
      evmRpcUrl: "https://evmrpc.0g.ai",
      indexerUrl: "https://indexer-storage-turbo.0g.ai",
    });
  });

  it("rejects unknown network labels", () => {
    expect(() => resolveZgStorageNetwork("mainnet")).toThrow(
      "Unsupported 0G Storage network",
    );
  });
});
