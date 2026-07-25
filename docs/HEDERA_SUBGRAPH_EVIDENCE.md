# Hedera Subgraph deployment evidence

The AgentRouter app-event journal and Subgraph were deployed to Hedera Testnet
and the private Linux Graph Node on 25 July 2026. No private key, database
credential, or Graph Node administrative endpoint is published here.

## Hedera journal deployment

- Network: Hedera Testnet, chain ID `296`
- Contract ID: `0.0.9743024`
- EVM address: `0x000000000000000000000000000000000094aab0`
- Publisher: Hedera account `0.0.9651299`, represented in the contract by its
  long-zero address `0x0000000000000000000000000000000000934463`
- Deployment transaction: `0.0.9651299@1784975567.327447462`
- Subgraph start block: `38431807`
- Compiler: Solidity `0.8.36`, EVM target `paris`, optimizer runs `200`
- Public evidence:
  [HashScan contract](https://hashscan.io/testnet/contract/0.0.9743024) and
  [HashScan deployment transaction](https://hashscan.io/testnet/transaction/0.0.9651299@1784975567.327447462)

The contract was deployed with the Hedera JavaScript SDK
`ContractCreateFlow` using the existing Ed25519 Testnet operator. The
constructor binds its publisher to the operator's long-zero Solidity address.
The deployment command did not return success until the Hedera JSON-RPC Relay
returned nonempty bytecode for the EVM address.

## Subgraph deployment

- Name: `agent-router/app-events`
- Version label: `2026-07-25.1`
- IPFS deployment ID: `Qme3MHYSbgEFFyYsiY9WU9B2LWroK3MVMSFtXkamURfbjS`
- Indexed contract:
  `0x000000000000000000000000000000000094aab0`
- Start block: `38431807`
- Private query route:
  `http://127.0.0.1:8000/subgraphs/name/agent-router/app-events`

Graph CLI generated the network override in a mode-`0600` temporary directory,
uploaded the schema, ABI, and mapping WASM to the private Kubo API, and deployed
through Graph Node's loopback-only administration API.

## Current verification state

The first post-deployment checks returned:

- deployment health: `healthy`;
- fatal indexing error: none;
- `_meta.hasIndexingErrors`: `false`;
- Graph Node latest block: `38431806`;
- Graph Node chain head: unavailable;
- public Hedera relay head during comparison: `38431876`;
- synced: `false`; and
- indexed app events: none.

Graph Node remained at block `38431806` across repeated checks, one block before
the configured data-source start. This is deployment evidence, not successful
event-history evidence. Do not mark the live proof complete until the block
ingestor advances, one deterministic event is submitted, and
`npm run validate:hedera-subgraph` correlates its entity with the finalized
Hedera receipt.

The Linux operator should inspect:

```sh
cd /opt/agent-router/deploy/graph-node
docker compose logs --since=15m graph-node
docker compose exec graph-node graph-node --version
```

Check particularly for Hedera JSON-RPC errors from `eth_blockNumber`,
`eth_getBlockByNumber`, or `eth_getLogs`, then verify that the configured relay
inside the container reports a block later than `38431806`.
