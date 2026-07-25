# Hedera Graph Node ingestion incident — 2026-07-25

## Summary

On 2026-07-25, the self-hosted Graph Node could not establish a Hedera Testnet
chain head because the configured Hedera JSON-RPC Relay returned an internally
incomplete Ethereum-compatible view. A block response advertised a transaction,
but direct transaction and receipt queries for that hash returned `null`.

Graph Node rejected the block and retried. This is the safe behavior: indexing a
partial block would risk permanently incorrect Subgraph data. The incident is
at the Hedera JSON-RPC compatibility boundary, not in the Subgraph mapping.

The Docker health check remained green because the Graph Node status service was
available. Docker health therefore did not imply that chain ingestion was
making progress.

## Status

- Incident state: open; upstream RPC inconsistency remains reproducible.
- First sampled error: `2026-07-25T10:52:18.840Z`.
- Last error for the sampled transaction:
  `2026-07-25T10:53:17.021Z`.
- Evidence refreshed: `2026-07-25T11:59:30Z`.
- Data integrity: protected; Graph Node failed closed.
- Application settlement integrity: unaffected; Hedera Mirror Node verification
  remains authoritative.
- Hedera Subgraph availability: degraded; the deployment is not synced and must
  not be presented as an operational history source.

## Affected components

| Component          | Observed value                                        |
| ------------------ | ----------------------------------------------------- |
| Graph Node image   | `graphprotocol/graph-node:v0.44.0`                    |
| Container state    | running, Docker health `healthy`                      |
| Container start    | `2026-07-25T08:57:14.273473253Z`                      |
| Graph network name | `hedera-testnet`                                      |
| Hedera chain ID    | `296`                                                 |
| RPC provider       | public Hedera Testnet Hashio endpoint, relay `0.78.1` |
| Ingestor component | `EthereumPollingBlockIngestor`                        |
| Subgraph ID        | `Qme3MHYSbgEFFyYsiY9WU9B2LWroK3MVMSFtXkamURfbjS`      |

The RPC URL is intentionally omitted. No credential was present in the sampled
URL, but incident reports should not establish a practice of copying runtime
endpoints or tokens from container environments.

## Sample block

The following values came from `eth_getBlockByHash` with full transactions:

| Field             | Value                                                                |
| ----------------- | -------------------------------------------------------------------- |
| Block number      | `38432346` (`0x24a6e5a`)                                             |
| Block hash        | `0x2c94bdd9d6981a31b64c56be52ce22fc4fbb508c7a3e8aa9119feacc77e7bffb` |
| Parent hash       | `0xf3ab2abe8d120099caa50ce14fb15b83935661f54b8e2f835e4084c2aba56526` |
| Block timestamp   | `2026-07-25T10:52:13Z` (`0x6a64955d`)                                |
| Transaction count | `1`                                                                  |

Querying the block by number returned the same block number, hash, and
transaction list. The block view was therefore stable across the by-hash and
by-number methods during the probe.

## Sample transaction

The block embedded this transaction object:

| Field             | Value                                                                |
| ----------------- | -------------------------------------------------------------------- |
| Transaction hash  | `0xa5261d1fc5943aa2b4b5ac96cc5faa6ef77438ef66dfb21f85a0d2e05b9e634c` |
| Block hash        | `0x2c94bdd9d6981a31b64c56be52ce22fc4fbb508c7a3e8aa9119feacc77e7bffb` |
| Block number      | `0x24a6e5a`                                                          |
| Transaction index | `0x1`                                                                |
| From              | `0xbc1be4cc8790b0c99cff76100e0e6d01e32c6a2c`                         |
| To                | `0x458630b517505da5f6e06f0df0eb52a0563aa80b`                         |
| Type              | `0x2`                                                                |
| Nonce             | `0xd3a7`                                                             |
| Value             | `0xde0b6b3a7640000`                                                  |
| Gas               | `0x30d40`                                                            |
| Gas price         | `0x0`                                                                |
| Input             | `0x`                                                                 |

Despite the embedded object:

- `eth_getTransactionByHash` returned `result: null`;
- `eth_getTransactionReceipt` returned `result: null` with no JSON-RPC error;
- five receipt queries over approximately 20 seconds all returned `null`; and
- a fresh receipt query more than one hour later still returned `null`.

“Empty transaction” in the incident shorthand means an empty direct lookup and
missing receipt. The block's transaction array itself was not empty.

## Graph Node evidence

Graph Node logged:

```text
Jul 25 10:52:18.840 ERRO Trying again after block polling failed: Receipt for tx 0xa5261d1fc5943aa2b4b5ac96cc5faa6ef77438ef66dfb21f85a0d2e05b9e634c unavailable, block was likely uncled (block hash = 0x2c94bdd9d6981a31b64c56be52ce22fc4fbb508c7a3e8aa9119feacc77e7bffb), provider: hedera-testnet-rpc-0, component: EthereumPollingBlockIngestor
```

As of `2026-07-25T11:59:30Z`, the current container log contained `5,614`
`Trying again after block polling failed` entries across multiple transactions.
This count is container-local and will reset when logs rotate or the container
is replaced.

The private Graph Node status API returned:

```json
{
  "health": "healthy",
  "synced": false,
  "fatalError": null,
  "network": "hedera-testnet",
  "chainHeadBlock": null,
  "latestBlock": {
    "number": "38431806",
    "hash": "618b9a75b1813ac4e8f44234b60ccb8f29a381c9c8a09594b14e030eb7d5fd48"
  }
}
```

The sampled inconsistent block was `540` blocks after Graph Node's reported
latest indexed block.

## Impact

- Graph Node could not advance the Hedera chain head.
- The Hedera app-event Subgraph remained unsynced.
- GraphQL history from this deployment was incomplete and unavailable as a
  production monitoring source.
- The failure did not authorize or duplicate a payment.
- The failure did not alter the durable Postgres workflow state.
- Hedera Mirror Node payment verification and proof-consumption invariants
  remained independent of the Subgraph.

## Root-cause boundary

The evidence proves an inconsistency in the configured relay's externally
observable JSON-RPC responses:

1. The same canonical block was returned by hash and number.
2. That block advertised the sampled transaction.
3. Direct transaction lookup returned `null`.
4. Receipt lookup returned `null` repeatedly without a JSON-RPC error.

The evidence does not identify which internal Hashio replica, cache, synthetic
transaction path, or Mirror Node dependency produced the inconsistency.
Determining that internal cause requires provider-side telemetry.

This is not a mapping-handler failure. The mapping never receives the block
because Graph Node cannot safely construct it.

## Resolution decision

Do not modify Graph Node to ignore transactions with missing receipts. The
planned production path is:

1. Read only the configured Hedera contract logs or HCS messages through Hedera
   Mirror Node.
2. Verify and persist the Hedera source event with a durable consensus-timestamp
   cursor and idempotency key.
3. Relay a non-secret event digest to a Graph-compatible EVM chain.
4. Reject destination replay using the complete Hedera source-event ID.
5. Index the destination contract event with The Graph.
6. Keep Hedera Mirror Node as payment truth and label the EVM event as a
   relayer-mediated monitoring projection.

Direct Graph Node ingestion from the Hedera JSON-RPC Relay remains an
experimental validation path, not a production dependency.

## Recovery conditions

The direct Hedera ingestion experiment may be retried only after all of these
conditions hold:

- a relay returns a transaction and matching receipt for every transaction it
  advertises in the sampled block;
- by-number and by-hash block views remain identical;
- receipt fields match the transaction hash, block hash, block number, and
  transaction index;
- Graph Node reports a non-null chain head and advances beyond block
  `38432346`;
- the Subgraph reports `synced: true` without a fatal indexing error; and
- any stale Graph Node block-cache eviction occurs only after the upstream RPC
  is consistent and Postgres has been backed up.

## Reproduction outline

Against the exact endpoint configured in Graph Node:

1. Call `eth_getBlockByHash` for the sampled block with full transactions.
2. Call `eth_getBlockByNumber` for `0x24a6e5a` with full transactions.
3. Confirm both responses contain the sampled transaction and agree on the
   canonical block fields.
4. Call `eth_getTransactionByHash` for the sampled transaction.
5. Call `eth_getTransactionReceipt` repeatedly with bounded delays.
6. Query Graph Node's private status API and compare its chain head and latest
   block.

Never print the configured RPC URL, authorization header, or container
environment while collecting this evidence.
