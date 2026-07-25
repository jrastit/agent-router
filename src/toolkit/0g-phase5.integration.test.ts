import { keccak256, toUtf8Bytes } from "ethers";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const liveEnabled =
  process.env.ZG_LIVE_TEST === "true" &&
  Boolean(process.env.G_API_KEY_PRIVATE) &&
  Boolean(process.env.ZG_STORAGE_PRIVATE_KEY) &&
  Boolean(process.env.ZG_CHAIN_PRIVATE_KEY) &&
  Boolean(process.env.ZG_CHAIN_CONTRACT_ADDRESS);

describe.skipIf(!liveEnabled)("live 0G Phase 5 path", () => {
  it("computes, stores, anchors, and independently verifies", async () => {
    const [
      { ZgRouterCatalogAdapter },
      { DeterministicModelRouter },
      { createLiveZgRouterComputeAdapter },
      { createLiveZgStorageAdapter },
      { createLiveZgChainProvenanceAdapter },
      { runZgAgent },
    ] = await Promise.all([
      import("./catalog/0g-router"),
      import("./router"),
      import("./compute/0g-router-server"),
      import("./storage/0g-server"),
      import("./provenance/0g-chain-server"),
      import("../../examples/0g-agent"),
    ]);
    const provenance = createLiveZgChainProvenanceAdapter({
      rpcUrl: process.env.ZG_CHAIN_RPC_URL ?? "https://evmrpc-testnet.0g.ai",
      privateKey: process.env.ZG_CHAIN_PRIVATE_KEY!,
      contractAddress: process.env.ZG_CHAIN_CONTRACT_ADDRESS!,
      network: process.env.ZG_CHAIN_NETWORK ?? "0g-galileo-testnet",
    });
    const result = await runZgAgent(
      {
        catalog: new ZgRouterCatalogAdapter(),
        router: new DeterministicModelRouter(),
        compute: createLiveZgRouterComputeAdapter(),
        storage: createLiveZgStorageAdapter({
          evmRpcUrl:
            process.env.ZG_STORAGE_EVM_RPC_URL ??
            "https://evmrpc-testnet.0g.ai",
          indexerUrl:
            process.env.ZG_STORAGE_INDEXER_URL ??
            "https://indexer-storage-testnet-turbo.0g.ai",
          privateKey: process.env.ZG_STORAGE_PRIVATE_KEY!,
          network: process.env.ZG_STORAGE_NETWORK ?? "0g-galileo-testnet",
        }),
        provenanceAnchor: provenance,
        provenanceVerifier: provenance,
      },
      {
        prompt: "Return only the word routed.",
        requestHash: keccak256(toUtf8Bytes("phase-5-live-request")),
        policyHash: keccak256(toUtf8Bytes("confidential-lowest-price")),
        policy: { requireConfidential: true },
        idempotencyKey: `phase-5-live-${Date.now()}`,
        provenanceNetwork: process.env.ZG_CHAIN_NETWORK ?? "0g-galileo-testnet",
      },
    );

    expect(result.verification.verified).toBe(true);
    expect(result.receipt.storage.rootHash).toMatch(/^0x[0-9a-f]{64}$/);
    process.stdout.write(
      `0G_PHASE5_EVIDENCE=${JSON.stringify({
        storageRootHash: result.receipt.storage.rootHash,
        storageTransactionHash: result.receipt.storage.transactionHash,
        receiptHash: result.receiptHash,
        anchorTransactionHash: result.anchor.transactionHash,
        anchorBlockNumber: result.anchor.blockNumber,
        verified: result.verification.verified,
      })}\n`,
    );
  }, 240_000);
});
