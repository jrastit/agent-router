# Phase 6B: Hedera event projection

## Status

The local foundation is implemented and validated:

- a strict version 1 public `HederaEventAnchor` payload;
- a stable bytes32 source-event ID and relayer idempotency key;
- contract-log and HCS Mirror Node readers with durable-cursor semantics;
- source filtering and Mirror-response validation before durable handling; and
- an allowlisted destination contract with replay protection.

The projection targets a local Ganache EVM rather than Base Sepolia. The
repository includes a loopback-only deployment command, durable relay
persistence, a bounded transaction state machine, and a deployable local
`HederaEventAnchored` Subgraph. Contract and Graph deployment, the correlating
worker, UI state, and the complete live replay proof remain open in `TODO.md`.

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
4. Deploy the `HederaEventAnchored` Subgraph and correlate indexed entities.
5. Add reconciliation and separate Hedera, EVM, and Graph UI states.
6. Exercise one real testnet event and retain replay and Graph query evidence.

Production deployment additionally requires documented key custody, gas
funding, monitoring, cursor backup, relayer/contract rotation, pause behavior,
and recovery procedures.

## Local deployment

### Topology

```text
Hedera Testnet
  → Hedera Mirror Node verification
  → durable application handler and cursor
  → allowlisted relay submission
  → HederaEventAnchor on local Ganache (chain ID 1337)
  → local Graph Node monitoring (planned)
```

The first two arrows are authoritative for source verification and application
credit. Ganache and the future local Graph entity are monitoring projections.

### Prerequisites

- Node.js and npm versions compatible with the repository lockfile;
- dependencies installed with `npm install`;
- local TCP port `8545` available; and
- two terminals opened at the repository root.

Ganache is a development dependency. No external EVM RPC service, faucet, or
long-lived private key is required.

### Configure

The npm deployment command reads `.env`. Create it from the safe template if it
does not already exist:

```sh
cp .env.example .env
```

The local defaults are:

| Variable                               | Default                  | Meaning                                    |
| -------------------------------------- | ------------------------ | ------------------------------------------ |
| `LOCAL_EVM_RPC_URL`                    | `http://127.0.0.1:8545`  | Loopback JSON-RPC endpoint                 |
| `LOCAL_EVM_CHAIN_ID`                   | `1337`                   | Required Ganache chain ID                  |
| `LOCAL_EVM_DEPLOYER_INDEX`             | `0`                      | Unlocked account that deploys the contract |
| `LOCAL_EVM_RELAYER_INDEX`              | `1`                      | Account allowlisted to submit anchors      |
| `LOCAL_HEDERA_ANCHOR_CONTRACT_ADDRESS` | empty until after deploy | Address used by future relay processes     |

The deployer and relayer indexes must be distinct nonnegative integers.

### Start Ganache

In terminal one, start the disposable local chain:

```sh
npm run evm:local
```

The command binds only `127.0.0.1:8545`, creates three disposable unlocked
accounts, uses chain and network ID `1337`, and suppresses account-key logging.
Leave this process running.

### Deploy the contract

In terminal two, deploy the anchor:

```sh
npm run deploy:hedera-anchor:local
```

The deployment script accepts only a loopback RPC, requires chain ID `1337` by
default, uses separate unlocked Ganache accounts for the deployer and relayer,
and waits for a successful receipt.

The JSON result contains:

| Field                     | Purpose                                            |
| ------------------------- | -------------------------------------------------- |
| `network`                 | Explicit `ganache-local` label                     |
| `rpcUrl`                  | Loopback endpoint used for deployment              |
| `chainId`                 | Verified destination chain ID                      |
| `contractAddress`         | Address to configure in the local relay            |
| `deploymentTransaction`   | Destination deployment transaction hash            |
| `blockNumber`             | Deployment start block for local indexing          |
| `deployer`                | Account that paid disposable local gas             |
| `relayer`                 | Only account allowed to submit anchors             |
| `compiler` / `evmVersion` | Reproducible compiler evidence                     |
| `authority`               | Reminder that the destination is not payment truth |

Copy `contractAddress` into `LOCAL_HEDERA_ANCHOR_CONTRACT_ADDRESS` only if a
subsequent local process needs it. Do not commit `.env` or transient deployment
output.

### Verify

The repository test suite includes an in-memory Ganache integration test that:

1. verifies chain ID `1337`;
2. deploys with separate deployer and relayer accounts;
3. proves an outsider cannot submit an anchor;
4. submits one valid source-event ID; and
5. proves the same source-event ID cannot be anchored twice.

Run it directly:

```sh
npm test -- contracts/HederaEventAnchor.integration.test.ts
```

Run the complete repository gate before committing changes:

```sh
npm run validate
```

### Stop and restart

Press `Ctrl-C` in terminal one to stop Ganache. The default chain is in-memory:
all blocks, transactions, contract addresses, and balances disappear when it
stops. On restart:

1. deploy the contract again;
2. replace the transient local contract address;
3. restart future relay or indexer processes from their documented state; and
4. never interpret the reset destination as a reversal of Hedera credit.

Hedera and Postgres state survive independently; local projection loss changes
monitoring completeness only.

### Troubleshooting

`EADDRINUSE` or “address already in use”

: Another process owns port `8545`. Stop it, or change the Ganache command and
`LOCAL_EVM_RPC_URL` together.

“RPC host must be loopback”

: The deployment guard intentionally rejects remote destinations. Use
`127.0.0.1`, `localhost`, or `::1`. A public deployment requires a separate,
explicitly reviewed workflow.

“expected chain ID 1337”

: The RPC endpoint points to the wrong chain, or
`LOCAL_EVM_CHAIN_ID` does not match the Ganache startup command. Align both
values instead of bypassing the guard.

“Deployer and relayer indexes must be distinct”

: Set different unlocked account indexes. The default pair is `0` and `1`.

µWS native-module warning

: Ganache may fall back to its JavaScript transport on an unsupported local
Node.js/CPU combination. This affects development performance, not EVM
semantics. The deployment and integration test must still pass.

Transaction or receipt failure

: Confirm Ganache is still running, the RPC URL is correct, and the selected
deployer account is unlocked and funded. Rerun deployment only after
confirming the prior transaction result; future durable relay code must
reconcile ambiguous transactions rather than create a second logical anchor.

### Local security rules

- Keep Ganache bound to loopback.
- Treat every Ganache account as disposable and development-only.
- Never reuse a Ganache mnemonic or key on a public or value-bearing network.
- Never commit `.env`, private keys, prompts, credentials, personal data, or
  raw provider results.
- Persist only non-secret digests and source provenance in destination events.
- Never use the local contract or Graph entity to grant application credit.
