import "server-only";

import {
  Contract,
  Interface,
  JsonRpcProvider,
  Wallet,
  type ContractTransactionResponse,
  type TransactionReceipt,
} from "ethers";

import {
  ZgChainProvenanceAdapter,
  ZgProvenanceError,
  type ZgChainAnchorEvidence,
  type ZgChainClient,
} from "./0g-chain";

export const zgRoutingProvenanceAbi = [
  "function anchor(bytes32 receiptHash)",
  "function anchoredAt(bytes32 receiptHash) view returns (uint64)",
  "event ReceiptAnchored(bytes32 indexed receiptHash,address indexed anchorer,uint64 anchoredAt)",
] as const;

export type LiveZgChainOptions = Readonly<{
  rpcUrl: string;
  privateKey: string;
  contractAddress: string;
  network?: string;
  timeoutMs?: number;
}>;

export function createLiveZgChainProvenanceAdapter(
  options: LiveZgChainOptions,
): ZgChainProvenanceAdapter {
  const provider = new JsonRpcProvider(options.rpcUrl);
  const signer = new Wallet(options.privateKey, provider);
  const contract = new Contract(
    options.contractAddress,
    zgRoutingProvenanceAbi,
    signer,
  );
  const iface = new Interface(zgRoutingProvenanceAbi);
  const timeoutMs = options.timeoutMs ?? 60_000;

  const client: ZgChainClient = {
    async anchor(receiptHash) {
      const transaction = (await contract.anchor(
        receiptHash,
      )) as ContractTransactionResponse;
      const finalized = await withTimeout(
        transaction.wait(1),
        timeoutMs,
        "ANCHOR_TIMEOUT",
      );
      if (!finalized) {
        throw new ZgProvenanceError(
          "TRANSACTION_NOT_FINAL",
          "0G Chain transaction was not finalized",
        );
      }
      return parseReceipt(finalized, options.contractAddress, iface);
    },

    async inspect(transactionHash) {
      const receipt = await provider.getTransactionReceipt(transactionHash);
      if (!receipt || receipt.status !== 1) return null;
      return parseReceipt(receipt, options.contractAddress, iface);
    },

    async isAnchored(receiptHash) {
      const timestamp: bigint = await contract.anchoredAt(receiptHash);
      return timestamp > BigInt(0);
    },
  };

  return new ZgChainProvenanceAdapter(
    client,
    options.network ?? "0g-galileo-testnet",
  );
}

function parseReceipt(
  receipt: TransactionReceipt,
  contractAddress: string,
  iface: Interface,
): ZgChainAnchorEvidence {
  if (receipt.to?.toLowerCase() !== contractAddress.toLowerCase()) {
    throw new ZgProvenanceError(
      "ANCHOR_FAILED",
      "Transaction did not call the configured provenance contract",
    );
  }
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== contractAddress.toLowerCase()) continue;
    const parsed = iface.parseLog(log);
    if (parsed?.name === "ReceiptAnchored") {
      return {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber.toString(),
        receiptHash: parsed.args.receiptHash,
      };
    }
  }
  throw new ZgProvenanceError(
    "ANCHOR_FAILED",
    "Finalized transaction has no ReceiptAnchored event",
  );
}

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  code: "ANCHOR_TIMEOUT",
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new ZgProvenanceError(
                code,
                `0G Chain confirmation exceeded ${timeoutMs}ms`,
              ),
            ),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
