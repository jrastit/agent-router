export interface HederaSubgraphValidationConfig {
  rpcUrl: string | undefined;
  subgraphUrl: string | undefined;
  contractAddress: string | undefined;
  transactionHash: string | undefined;
  expectedChainId?: bigint;
}

export interface IndexedAppEvent {
  id: string;
  kind: string;
  subject: string;
  payloadDigest: string;
  transactionHash: string;
  blockNumber: string;
  blockTimestamp: string;
  logIndex: string;
}

export interface HederaSubgraphValidationResult {
  chainId: string;
  contractAddress: string;
  transactionHash: string;
  receiptBlock: string;
  indexedBlock: string;
  eventCount: number;
  events: IndexedAppEvent[];
}

export function validateHederaSubgraph(
  config: HederaSubgraphValidationConfig,
  fetchImpl?: typeof fetch,
): Promise<HederaSubgraphValidationResult>;
