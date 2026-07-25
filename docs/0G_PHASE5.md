# 0G Phase 5 integration

## Implemented stack

| Layer                         | Exact integration                                                                                                     | Network and endpoint                                                                                                 | Evidence / guarantee                                                                                                                                                              |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compute catalog and inference | Direct OpenAI-compatible 0G Compute Router HTTP API; no Compute SDK                                                   | 0G mainnet, `https://router-api.0g.ai/v1`                                                                            | Model, provider address, Router execution ID, catalog `TeeML` mode, and private trust-mode enforcement. This is Router evidence, not an independently downloaded TEE attestation. |
| Storage                       | `@0gfoundation/0g-storage-ts-sdk` 1.2.10 and ethers 6.13.1; in-memory SDK `Blob`, `Indexer.upload`, finality required | Galileo testnet, EVM RPC `https://evmrpc-testnet.0g.ai`, Turbo indexer `https://indexer-storage-testnet-turbo.0g.ai` | SDK-returned Merkle root and upload transaction hash. Only explicitly classified `public-non-secret` evidence is accepted.                                                        |
| Provenance                    | Solidity 0.8.36 contract, ethers 6.13.1, `evmVersion: cancun`                                                         | Galileo testnet EVM RPC `https://evmrpc-testnet.0g.ai`                                                               | Canonical receipt Keccak-256, finalized `ReceiptAnchored` event, matching configured contract address, and independent `anchoredAt` state read.                                   |

Official references:

- [0G Storage TypeScript SDK](https://github.com/0glabs/0g-ts-sdk)
- [0G documentation](https://docs.0g.ai/)

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

Deployment evidence: **not yet recorded; no 0G Chain signer is configured in
this workspace.**

The live integration is deliberately guarded because it spends testnet funds:

```sh
ZG_LIVE_TEST=true npm test -- --run src/toolkit/0g-phase5.integration.test.ts
```

It is skipped unless the Compute, Storage, and Chain credentials plus deployed
contract address are all present. Unit and adapter-contract coverage runs
without credentials and includes canonicalization, policy changes,
idempotency, timeouts, malformed evidence, unfinalized transactions, and
tamper detection.
