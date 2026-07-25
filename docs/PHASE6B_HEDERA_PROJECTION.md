# Phase 6B: Hedera event projection

## Status

The local foundation is implemented and validated:

- a strict version 1 public `HederaEventAnchor` payload;
- a stable bytes32 source-event ID and relayer idempotency key;
- contract-log and HCS Mirror Node readers with durable-cursor semantics;
- source filtering and Mirror-response validation before durable handling; and
- an allowlisted destination contract with replay protection.

The projection targets a local Ganache EVM rather than Base Sepolia. The
repository includes a loopback-only deployment command, but durable relay
persistence, transaction reconciliation, local Graph indexing, UI state, and
the complete live replay proof remain open in `TODO.md`.

## Authority and trust boundary

Hedera Mirror verification and atomic Postgres proof consumption are the only
authority for application credit. The local EVM event is asynchronous
monitoring evidence and cannot create, duplicate, reverse, or delay spendable
credit.

`HederaEventAnchor` verifies only that its configured relayer submitted a
previously unseen source-event ID. It does not perform native Hedera consensus
verification in the local EVM. Operators and users must therefore treat the
destination event and its Subgraph entity as relayer-mediated claims. The
durable relay record must retain the independently verified Mirror evidence so
that this claim can be audited.

The destination event contains only:

- the stable source-event ID;
- source type and Hedera contract/topic ID;
- Hedera transaction hash, consensus timestamp, and log/sequence index;
- a bounded event kind and non-secret payload digest;
- schema version; and
- the destination relayer address and normal EVM transaction provenance.

Prompts, credentials, personal data, raw provider results, payment keys, and
application balances are forbidden.

## Cursor and replay behavior

Each configured stream has its own cursor named
`contract_log:<contract-id>` or `hcs_message:<topic-id>`. The reader requests
ascending Mirror results strictly after the saved consensus timestamp. It calls
the durable handler first and advances the cursor only after that handler
succeeds. A repeated page at the cursor is ignored.

The source-event ID binds schema version, network, source type, source ID,
transaction hash, consensus timestamp, and log index or HCS sequence number.
That ID is both the destination contract replay key and the logical relayer
idempotency key. Event kind and payload digest are monitoring content, not
source identity.

## Required next sequence

1. Add Postgres cursor, verified-event, projection-attempt, and destination
   transaction records with restrictive RLS and atomic worker functions.
2. Add a bounded-fee relayer state machine that reconciles an ambiguous
   transaction hash/nonce before considering any replacement transaction.
3. Retain non-secret local deployment evidence with each demonstration run.
4. Add and deploy the `HederaEventAnchored` Subgraph.
5. Add reconciliation and separate Hedera, EVM, and Graph UI states.
6. Exercise one real testnet event and retain replay and Graph query evidence.

Production deployment additionally requires documented key custody, gas
funding, monitoring, cursor backup, relayer/contract rotation, pause behavior,
and recovery procedures.

## Local deployment

In one terminal, start the disposable local chain:

```sh
npm run evm:local
```

In another terminal, deploy the anchor:

```sh
npm run deploy:hedera-anchor:local
```

The deployment script accepts only a loopback RPC, requires chain ID `1337` by
default, uses separate unlocked Ganache accounts for the deployer and relayer,
waits for a successful receipt, and prints non-secret JSON evidence. Override
the local port, chain ID, or account indexes with the `LOCAL_EVM_*` variables in
`.env`. Never reuse Ganache accounts or keys outside local development.
