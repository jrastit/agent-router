export const zgStorageNetworks = {
  "0g-galileo-testnet": {
    chainId: BigInt(16602),
    evmRpcUrl: "https://evmrpc-testnet.0g.ai",
    indexerUrl: "https://indexer-storage-testnet-turbo.0g.ai",
  },
  "0g-aristotle-mainnet": {
    chainId: BigInt(16661),
    evmRpcUrl: "https://evmrpc.0g.ai",
    indexerUrl: "https://indexer-storage-turbo.0g.ai",
  },
} as const;

export type ZgStorageNetwork = keyof typeof zgStorageNetworks;

export function resolveZgStorageNetwork(network: string) {
  if (!(network in zgStorageNetworks)) {
    throw new Error(`Unsupported 0G Storage network: ${network}`);
  }
  return zgStorageNetworks[network as ZgStorageNetwork];
}
