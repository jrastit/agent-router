import "server-only";

import { Blob as ZgBlob, Indexer } from "@0gfoundation/0g-storage-ts-sdk";
import { JsonRpcProvider, Wallet } from "ethers";

import {
  ZgStorageError,
  ZgStorageEvidenceAdapter,
  type ZgStorageUploader,
} from "./0g";
import { resolveZgStorageNetwork } from "./network";

export type LiveZgStorageOptions = Readonly<{
  evmRpcUrl: string;
  indexerUrl: string;
  privateKey: string;
  timeoutMs?: number;
  network?: string;
}>;

export function createLiveZgStorageAdapter(
  options: LiveZgStorageOptions,
): ZgStorageEvidenceAdapter {
  const network = options.network ?? "0g-galileo-testnet";
  const networkConfig = resolveZgStorageNetwork(network);
  const provider = new JsonRpcProvider(options.evmRpcUrl);
  const signer = new Wallet(options.privateKey, provider);
  const indexer = new Indexer(options.indexerUrl);

  const uploader: ZgStorageUploader = {
    async upload(content, mediaType) {
      const connectedNetwork = await provider.getNetwork();
      if (connectedNetwork.chainId !== networkConfig.chainId) {
        throw new ZgStorageError(
          "INVALID_REQUEST",
          `Refusing 0G Storage upload: ${network} requires chain ID ${networkConfig.chainId}, RPC returned ${connectedNetwork.chainId}`,
        );
      }
      const bytes = new Uint8Array(content.byteLength);
      bytes.set(content);
      const file = new File([bytes.buffer], "agent-router-evidence", {
        type: mediaType,
      });
      const [result, error] = await indexer.upload(
        new ZgBlob(file),
        options.evmRpcUrl,
        signer,
        { finalityRequired: true },
      );
      if (error) {
        throw new ZgStorageError(
          "UPLOAD_FAILED",
          "0G Storage SDK upload failed",
          { cause: error },
        );
      }
      if ("rootHashes" in result) {
        throw new ZgStorageError(
          "UPLOAD_FAILED",
          "0G Storage unexpectedly returned a fragmented upload",
        );
      }
      return {
        rootHash: result.rootHash,
        transactionHash: result.txHash,
      };
    },
  };

  return new ZgStorageEvidenceAdapter(uploader, {
    network,
    timeoutMs: options.timeoutMs,
  });
}
