# Hedera app-event Subgraph validation

This probe answers a narrow question: can a self-hosted Graph Node index an
application contract event from Hedera Testnet and return its history?

It does not treat the Subgraph as settlement truth. Hedera Mirror Node
verification remains authoritative for payments; the Subgraph is a searchable
monitoring projection.

## Required deployed shape

Configure Graph Node with a Hedera EVM JSON-RPC Relay as an Ethereum-compatible
network. The deployed Subgraph must expose this entity/query contract:

```graphql
type AppEvent @entity(immutable: true) {
  id: Bytes!
  kind: String!
  subject: Bytes!
  payloadDigest: Bytes!
  version: Int!
  publisher: Bytes!
  contractAddress: Bytes!
  transactionHash: Bytes!
  blockNumber: BigInt!
  blockTimestamp: BigInt!
  logIndex: BigInt!
}
```

The manifest should use an event handler for the application event contract.
Deploy it to the self-hosted Graph Node with Graph CLI, then submit one known
event on Hedera Testnet and retain its EVM transaction hash.

The production schema also exposes immutable `EconomicEvent` history for
deposit observation, credit, debit, reservation, execution charge, refund, and
reconciliation events. Amounts are signed `BigInt` tinybar values; identifiers
and references are public digests.

## Run the proof

Set the following server-only values in `.env`:

```text
HEDERA_EVM_RPC_URL=https://testnet.hashio.io/api
HEDERA_APP_EVENT_CONTRACT_ADDRESS=0x...
HEDERA_APP_EVENT_TX_HASH=0x...
HEDERA_SUBGRAPH_QUERY_URL=https://.../subgraphs/name/agent-router/app-history
```

Then run:

```sh
npm run validate:hedera-subgraph
```

The command succeeds only when:

1. the RPC reports Hedera Testnet chain ID `296`;
2. the transaction succeeded and contains a log from the configured contract;
3. the Subgraph reports no indexing errors and has reached the receipt block;
4. `appEvents` returns at least one entity for the exact transaction; and
5. every returned entity matches the Hedera receipt block and transaction hash.

The JSON output records the chain, contract, transaction, receipt/indexed
blocks, and returned event history. A lagging indexer fails with a retryable,
explicit message rather than implying that deployment or ingestion succeeded.
