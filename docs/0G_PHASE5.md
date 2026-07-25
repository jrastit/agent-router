# 0G Phase 5 integration

## Implemented stack

| Layer                         | Exact integration                                                                                                     | Network and endpoint                                          | Evidence / guarantee                                                                                                                                                              |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compute catalog and inference | Direct OpenAI-compatible 0G Compute Router HTTP API; no Compute SDK                                                   | 0G mainnet, `https://router-api.0g.ai/v1`                     | Model, provider address, Router execution ID, catalog `TeeML` mode, and private trust-mode enforcement. This is Router evidence, not an independently downloaded TEE attestation. |
| Storage                       | `@0gfoundation/0g-storage-ts-sdk` 1.2.10 and ethers 6.13.1; in-memory SDK `Blob`, `Indexer.upload`, finality required | Galileo testnet or Aristotle mainnet; see network table below | SDK-returned Merkle root and upload transaction hash. Only explicitly classified `public-non-secret` evidence is accepted.                                                        |
| Provenance                    | Solidity 0.8.36 contract, ethers 6.13.1, `evmVersion: cancun`                                                         | Galileo testnet or Aristotle mainnet                          | Canonical receipt Keccak-256, finalized `ReceiptAnchored` event, matching configured contract address, and independent `anchoredAt` state read.                                   |

Official references:

- [0G Storage TypeScript SDK](https://github.com/0glabs/0g-ts-sdk)
- [0G documentation](https://docs.0g.ai/)

| Storage network   | Chain ID | EVM RPC                        | Turbo indexer                                 |
| ----------------- | -------: | ------------------------------ | --------------------------------------------- |
| Galileo testnet   |  `16602` | `https://evmrpc-testnet.0g.ai` | `https://indexer-storage-testnet-turbo.0g.ai` |
| Aristotle mainnet |  `16661` | `https://evmrpc.0g.ai`         | `https://indexer-storage-turbo.0g.ai`         |

The Aristotle indexer was live-probed on 2026-07-25 through the official SDK's
`getShardedNodes()` method and returned two shard groups. The upstream SDK
README currently demonstrates only Galileo, so this repository records that
runtime verification explicitly. The adapter checks the EVM chain ID before
calling `Indexer.upload`.

## Canonical public receipt

`agent-router-routing-receipt/v1` binds the request and policy hashes, all
eligible candidates, selected route and model, exact string-denominated quote,
execution evidence, 0G Storage reference, optional caller/Agentic ID, network,
and normalized UTC timestamp. Object keys are lexicographically sorted before
Keccak-256 hashing.

The receipt is an allowlist. It has no prompt, raw output, secret, or
confidential-artifact field. The Storage adapter likewise requires the literal
classification `public-non-secret`; the example stores only an execution ID,
model, provider, network, and verification mode. Prompts and generated output
remain in the compute call/result path and never enter Storage, receipt, chain
event, or application logs.

## Package and example

The reusable entry point is `agent-router/toolkit`. Server-only adapters are
separate exports:

```ts
import {
  DeterministicModelRouter,
  ZgRouterCatalogAdapter,
} from "agent-router/toolkit";
import { createLiveZgRouterComputeAdapter } from "agent-router/toolkit/compute/server";
import { createLiveZgStorageAdapter } from "agent-router/toolkit/storage/server";
import { createLiveZgChainProvenanceAdapter } from "agent-router/toolkit/provenance/server";
```

[`examples/0g-agent.ts`](../examples/0g-agent.ts) composes only public
contracts. Its contract test discovers two routes, changes selection by exact
price/privacy policy, executes, persists redacted evidence, anchors the
canonical receipt hash, and verifies it.

## Deployment and guarded live verification

Required server-only variables are listed in `.env.example`. Deploy the minimal
contract with:

```sh
npm run deploy:0g-provenance
```

The script compiles the committed source with optimization and Cancun EVM
target, deploys it, waits for one confirmation, and prints the network,
chain ID, address, deployment transaction, block, compiler, and EVM target.
Record that JSON below after deployment and add the contract address to
`ZG_CHAIN_CONTRACT_ADDRESS`.

Deployment evidence:

- network: `0g-aristotle-mainnet` (chain ID `16661`);
- contract: `0xdAc715Cbfa81F60B0e05C0D9E8c96eC21948Cd93`;
- deployment transaction:
  `0x7c6652ec7906b00a470082955eac2bf7055a7adc06cd75a396c33941a8c10caf`;
- deployment block: `39766437`;
- gas used: `160907`;
- fee: `0.000643628001126349 0G`; and
- committed source: [`contracts/ZgRoutingProvenance.sol`](../contracts/ZgRoutingProvenance.sol).

Run `npm run verify:0g-provenance` to compile the committed source with the
recorded compiler settings and compare its runtime bytecode with the deployed
contract. Verified on 2026-07-25 with Solidity
`0.8.36+commit.8a079791`, source SHA-256
`c8525f6b32c2339f596d0294d2780ad85942da0f1ff624b7daf59871b8940510`,
and matching runtime bytecode Keccak-256
`0x3519076428bbcef0bb0bc799f1c49a8c11f41ef608739b4da7817bf9086fc086`.

### Aristotle mainnet

The same EVM signer can deploy on Aristotle mainnet. Set
`ZG_CHAIN_NETWORK=0g-aristotle-mainnet` and
`ZG_CHAIN_RPC_URL=https://evmrpc.0g.ai`, then run:

```sh
npm run deploy:0g-provenance:mainnet
```

The script refuses to sign unless the RPC reports Aristotle chain ID `16661`.
This spends real 0G. For an all-mainnet run, also configure
`ZG_STORAGE_NETWORK=0g-aristotle-mainnet`,
`ZG_STORAGE_EVM_RPC_URL=https://evmrpc.0g.ai`, and
`ZG_STORAGE_INDEXER_URL=https://indexer-storage-turbo.0g.ai`.

The live integration is deliberately guarded because it spends funds on the
configured network:

```sh
ZG_LIVE_TEST=true npm test -- --run src/toolkit/0g-phase5.integration.test.ts
```

It is skipped unless the Compute, Storage, and Chain credentials plus deployed
contract address are all present. Unit and adapter-contract coverage runs
without credentials and includes canonicalization, policy changes,
idempotency, timeouts, malformed evidence, unfinalized transactions, and
tamper detection.
