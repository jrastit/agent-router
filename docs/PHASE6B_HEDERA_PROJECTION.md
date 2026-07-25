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
`HederaEventAnchored` Subgraph. The contract deployment path, correlating Graph
ingestion, reconciliation, three-plane UI state, recovery semantics, and
operations contract are implemented. A verified Graph deployment is recorded
below; the complete durably credited deposit proof remains open in `TODO.md`.

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

1. Bind one independently Mirror-verified source event to its credited deposit
   and durable Postgres relay record.
2. Exercise the same source event through the recorded local deployment path.
3. Retain Postgres, destination, Graph, and replay-rejection evidence in one
   correlated proof.

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
long-lived private key is required. The repository launcher suppresses
Ganache's generated wallet banner so disposable private keys and its mnemonic
do not enter terminal logs.

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

### Recorded local deployment

The following disposable deployment was completed on 2026-07-25 with the
documented command. It proves the local deployment path; it is not a persistent
or value-bearing network:

| Field                   | Recorded value                                                       |
| ----------------------- | -------------------------------------------------------------------- |
| Network                 | `ganache-local`                                                      |
| Chain ID                | `1337`                                                               |
| Contract                | `0xd98662DbEB5B731404C6109C01C34f51cB4Ba39e`                         |
| Deployment transaction  | `0x226d573e3454f229fbfb48af5513f90781b6175175ecc8969fb8b58a1910e326` |
| Start block             | `1`                                                                  |
| Deployer                | `0x0fbF7d3629EfFeFcd8689673B57FCA6a5706ad78`                         |
| Allowlisted relayer     | `0xd7C5B5FBAAb17B048e0568E0Ade7Da55e65aDE28`                         |
| Solidity compiler       | `0.8.36+commit.8a079791.Emscripten.clang`                            |
| EVM version             | `shanghai`                                                           |
| Source verification     | committed source, ABI-alignment test, and Ganache integration test   |
| Authoritative truth     | Hedera Mirror verification and atomic Postgres proof consumption     |
| Destination trust model | relayer-mediated monitoring only                                     |

The in-memory Ganache process was stopped after recording the receipt, so this
address and transaction are historical local evidence rather than a live
endpoint. A fresh process requires a fresh deployment and new manifest values.

### Deploy the projection Subgraph

With Ganache and a Graph Node configured for the `ganache-local` network
running, set the fresh contract address and deployment block in `.env`:

```sh
LOCAL_HEDERA_ANCHOR_CONTRACT_ADDRESS=0x...
LOCAL_HEDERA_ANCHOR_START_BLOCK=1
```

Then deploy through the loopback-only Graph admin and IPFS APIs:

```sh
npm run deploy:hedera-projection-subgraph:local
```

### Linux verification handoff

The repository ships a local override for the pinned private Graph stack. It
places disposable Ganache and Graph Node on the same Compose network and uses
the exact provider declaration `ganache-local:http://ganache:8545`. Ganache and
every Graph operator port bind to host loopback only.

The default host endpoints are:

| Service             | Localhost endpoint              | Purpose                       |
| ------------------- | ------------------------------- | ----------------------------- |
| Ganache JSON-RPC    | `http://127.0.0.1:8545`         | Disposable destination EVM    |
| IPFS HTTP API       | `http://127.0.0.1:5001`         | Subgraph artifact publication |
| Graph query API     | `http://127.0.0.1:8000`         | GraphQL queries               |
| Graph WebSocket API | `ws://127.0.0.1:8001`           | GraphQL subscriptions         |
| Graph admin API     | `http://127.0.0.1:8020`         | Subgraph deployment           |
| Graph status API    | `http://127.0.0.1:8030/graphql` | Indexing status               |
| Graph metrics       | `http://127.0.0.1:8040/metrics` | Prometheus metrics            |

Postgres is reachable only inside the Compose network on `postgres:5432`; it
is intentionally not published to the host. Override the host ports with the
variables in `deploy/graph-node/graph-node.env.example` when necessary. Do not
change the loopback bind without a separate security review.

Run the remaining verification on Linux with Docker Engine, Docker Compose v2,
Node.js, and npm available. Keep Ganache, Graph Node, IPFS, and Postgres
disposable and isolated from production data.

1. Create a temporary Compose environment. Do not reuse a production Graph
   database:

   ```sh
   cp deploy/graph-node/graph-node.env.example deploy/graph-node/.env
   chmod 600 deploy/graph-node/.env
   ```

   Set a disposable `GRAPH_POSTGRES_PASSWORD`. The required
   `HEDERA_EVM_RPC_URL` value is ignored by the local override but must remain a
   syntactically valid URL for the base Compose configuration.

2. Start the isolated topology:

   ```sh
   docker compose \
     -p agent-router-projection \
     -f deploy/graph-node/compose.yaml \
     -f deploy/graph-node/compose.projection.yaml \
     --env-file deploy/graph-node/.env up -d
   ```

3. Deploy a fresh anchor and retain its JSON output:

   ```sh
   npm run deploy:hedera-anchor:local
   ```

4. Export the fresh deployment values without committing them:

   ```sh
   export LOCAL_HEDERA_ANCHOR_CONTRACT_ADDRESS=0x...
   export LOCAL_HEDERA_ANCHOR_START_BLOCK=1
   ```

5. Deploy through the loopback Graph admin and IPFS APIs:

   ```sh
   npm run deploy:hedera-projection-subgraph:local
   ```

6. Query the reported URL and retain non-secret evidence showing the deployment
   ID, indexed head block, and at least one projected entity. Also retain Graph
   Node startup lines proving that `ganache-local` passed provider checks.

   For an HCS source, configure the exact durable cursor immediately before the
   one proof event and run the guarded correlation probe:

   ```sh
   export HEDERA_PROJECTION_TOPIC_ID=0.0...
   export HEDERA_PROJECTION_CURSOR=1234567890.000000000
   export HEDERA_PROJECTION_SUBGRAPH_QUERY_URL=http://127.0.0.1:8000/subgraphs/name/agent-router/hedera-projection
   npm run demo:hedera-projection:local
   ```

   The command requires exactly one independently Mirror-verified event after
   the cursor, submits it through the allowlisted relayer, proves destination
   replay rejection, waits for its Graph entity, and rejects any source or
   destination provenance mismatch.

If the registrar error repeats, capture the Graph Node version, provider
startup logs, the `public.chains` row for `ganache-local`, and the exact
deployment error before changing clients or versions.

The command validates the address and start block, rejects non-loopback admin
or IPFS URLs, writes its generated network file with mode `0600`, removes the
temporary directory, and reports the query URL and monitoring-only authority
label. A successful `graph build` does not satisfy the deployment milestone;
retain the actual deployment and indexed-entity evidence before checking it.

Stop and remove the disposable topology without deleting unrelated Docker
resources:

```sh
docker compose \
  -p agent-router-projection \
  -f deploy/graph-node/compose.yaml \
  -f deploy/graph-node/compose.projection.yaml \
  --env-file deploy/graph-node/.env down --volumes
```

If another private Graph stack already owns the default loopback ports, set
`LOCAL_EVM_PORT`, `GRAPH_IPFS_API_PORT`, `GRAPH_QUERY_PORT`, `GRAPH_WS_PORT`,
`GRAPH_ADMIN_PORT`, `GRAPH_STATUS_PORT`, and `GRAPH_METRICS_PORT` to unused
values for both `up` and `down`. Point `LOCAL_EVM_RPC_URL`,
`GRAPH_IPFS_URL`, `GRAPH_NODE_ADMIN_URL`, `GRAPH_NODE_QUERY_URL`, and
`HEDERA_PROJECTION_SUBGRAPH_QUERY_URL` at those matching loopback ports. The
explicit Compose project name prevents reuse of another stack's containers or
volumes.

### Recorded Linux deployment and live indexing proof

The following disposable proof completed on 2026-07-25. The Compose topology
was isolated under project `agent-router-projection`; the destination chain and
Graph deployment are historical local evidence after teardown.

| Field                  | Recorded value                                                       |
| ---------------------- | -------------------------------------------------------------------- |
| Docker Engine          | `29.3.0`                                                             |
| Docker Compose         | `5.1.0`                                                              |
| Graph Node             | `graphprotocol/graph-node:v0.44.0`                                   |
| Ganache                | `trufflesuite/ganache:v7.9.2`                                        |
| Destination chain ID   | `1337`                                                               |
| Anchor contract        | `0xB477de72792C0CDB7a59D6F2B7081b600faCb0Cd`                         |
| Deployment transaction | `0xcbc3978355f6903908e7d985e1789a671e1a31b1c6960a68cc5b80a3b7e3faf9` |
| Deployment start block | `1`                                                                  |
| Subgraph deployment ID | `QmPM32WC2iNUus9xZQpz2Ni6FsewYjT9gUrseE9vK5ZQ4a`                     |
| Subgraph health        | `healthy`, `synced: true`                                            |

Graph Node logged a checked provider named `ganache-local-rpc-0` at
`http://ganache:8545`, created the `ganache-local` block ingestor, and accepted
the Subgraph deployment through its loopback admin API.

The proof runner then read HCS topic `0.0.9676520` from the public Testnet
Mirror Node, strictly after cursor `1784941222.395471302`:

| Field                            | Recorded value                                                       |
| -------------------------------- | -------------------------------------------------------------------- |
| HCS consensus timestamp          | `1784941222.395471303`                                               |
| HCS sequence                     | `3`                                                                  |
| Source-event ID                  | `0x511f1c5563ef498dcdc857ee09d596a593af48838d3de3cbc2fe11194b6c92b8` |
| Source transaction identity hash | `0xda066189d9f053e4e02f2e77a234b0a4abffc4b9cdab771bc465c41e43c1137c` |
| Non-secret payload digest        | `0x871f5320a013de4fbff1bb4fea90afea178cc4735276a619f1f5fa9856c46ba4` |
| Destination transaction          | `0x80d816388fb779a4453258af0aa79ca8ee3ddeec7c3fa5e284cfcdc59f39753b` |
| Destination block                | `2`                                                                  |
| Destination block hash           | `0x21ac7fc10821f5b46d353a276c3fff712cb1810186f2ed673f25e342f0c98c05` |
| Replay result                    | rejected by `SourceEventAlreadyAnchored`                             |

The indexed entity returned the same source-event ID, source ID, Hedera
identity digest, consensus timestamp, source index, payload digest, relayer,
destination contract, destination transaction, and destination block.

This proves the implemented and deployed Mirror-to-EVM-to-Graph monitoring
path. It does not close the Phase 6B exit criterion: the proof used the existing
HCS receipt event and an in-process proof cursor, not a new Phase 6A deposit
atomically linked to a durable Postgres relay record. Application credit was
neither created nor changed by this run.

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

## Production operations contract

The committed deployment workflow is intentionally restricted to disposable
local Ganache. This section defines the controls required before adapting the
relay to a persistent or value-bearing destination. It does not claim that such
a production deployment exists.

### Key custody and access

- Generate the relayer key inside a managed KMS or HSM that supports the
  destination chain. The worker receives signing permission, not export access
  to raw key material.
- Use separate identities for deployment, relay signing, database service
  access, and monitoring. The browser receives none of them.
- Restrict relay signing to the reviewed destination chain ID, anchor contract,
  `anchorHederaEvent` selector, bounded gas limit, and configured fee ceiling.
- Require two-person approval for key-policy changes, contract replacement,
  cursor rewinds, and destination changes. Record approval references outside
  the public anchor payload.
- Rotate any credential suspected of exposure before resuming. Do not copy a
  local Ganache mnemonic or unlocked account into a persistent environment.

`HederaEventAnchor` has an immutable relayer and no privileged owner after
deployment. The deployer key has no ongoing contract authority. The configured
relayer key is therefore the only destination write authority and must be
treated accordingly.

### Gas funding and limits

- Fund only the relayer address with the minimum operational destination gas
  float. Never fund it from user HBAR deposits or the Postgres credit ledger.
- Alert below a documented number of worst-case anchor transactions and stop
  dequeueing before the balance reaches zero.
- Enforce `maxFeePerGasWei`, `gasLimit`, maximum attempts, and minimum
  confirmations in worker configuration. A fee spike delays monitoring; it
  does not delay or reverse Hedera credit.
- Reconcile the reserved nonce and any known transaction hash before funding or
  retrying. Never send a new logical anchor merely because an RPC timed out.

### Monitoring and alerts

Alert on:

- Mirror cursor age, a cursor moving backward, repeated pages, malformed source
  payloads, and source-identity mismatch;
- verified-event outbox depth and age, retry count, terminal failures, and a
  `submitting` record without a discoverable transaction at its reserved nonce;
- relayer balance, fee-ceiling refusal, nonce conflict, receipt ambiguity,
  explicit revert, reorg, and confirmation depth;
- Graph indexed head age, finalized destination transactions without entities,
  provenance mismatch, and query failures; and
- any attempted projection of a deposit that is not already `credited`.

Page immediately for source-identity mismatch, nonce conflict, destination
reorg after confirmation, Graph provenance mismatch, or any observed credit
mutation associated with a monitoring operation. Dashboard EVM and Graph lag
as degraded monitoring, not as failed payment settlement.

### Cursor backup and restore

Back up `hedera_projection_cursors`,
`verified_hedera_projection_events`, `hedera_projection_attempts`, and
`hedera_projection_progress_events` with the same Postgres recovery point as
the deposit and credit tables. Encrypt backups, test restore quarterly, and
retain the database recovery point and schema migration version.

Restore in this order:

1. stop every projection and ingestion worker;
2. restore Postgres and verify credit-journal invariants first;
3. compare each cursor with its latest verified event and never advance a
   cursor beyond durable event evidence;
4. reconcile every reserved nonce or transaction hash against the destination;
5. replay from the last durable cursor, relying on source-event IDs and the
   destination contract replay guard; and
6. resume Graph ingestion only after destination reconciliation completes.

A conservative cursor rewind may replay durable handlers. It must never delete
verified events or credit rows. Event-level idempotency makes replay safe; a
cursor jump forward can lose monitoring evidence and is prohibited.

### Pause and relayer rotation

The current contract deliberately has no on-chain pause, owner, or relayer
mutation function. Do not imply otherwise.

Emergency pause:

1. stop the relay worker and revoke its KMS signing permission;
2. block destination RPC egress for that identity;
3. keep Mirror verification and application credit running if their own
   authority path is healthy;
4. record the last cursor, reserved nonce, transaction hash, and outbox depth;
5. reconcile ambiguity before resuming.

Relayer or contract rotation:

1. pause and reconcile the old worker;
2. deploy a new contract with the replacement relayer;
3. verify chain ID, bytecode, relayer, deployment receipt, and start block;
4. deploy a new Subgraph data source and preserve the old deployment as
   read-only history;
5. update reviewed server-only configuration atomically;
6. replay unprojected verified events from Postgres into the new contract; and
7. resume only after duplicate submission and Graph correlation probes pass.

The old immutable contract cannot be disabled. Removing signing permission from
its relayer and stopping the worker is the effective pause. Anchors in old and
new contracts remain monitoring records and must be correlated by source-event
ID; neither changes authoritative credit.

### Incident recovery

| Incident                          | Required response                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Mirror unavailable                | Hold cursor; do not verify, credit, or project unseen events; resume from the durable cursor.                |
| Database unavailable              | Stop handling before cursor advance; restore Postgres; replay idempotently.                                  |
| Crash before broadcast            | Recover the reserved nonce; submit the same logical attempt only if no transaction or anchor exists.         |
| Ambiguous destination receipt     | Retain the original hash/nonce and wait; do not create a replacement attempt.                                |
| Explicit revert                   | Record retryable failure, clear reverted destination evidence, and apply the bounded retry policy.           |
| Destination reorg                 | Record the departed block evidence, recheck `anchored`, and replay only when the old anchor is noncanonical. |
| Ganache reset or destination loss | Redeploy and rebuild monitoring from durable verified events; never modify Hedera credit.                    |
| Graph lag or outage               | Keep credit and execution available; retry queries from finalized destination evidence.                      |
| Graph provenance mismatch         | Stop ingestion for the entity, retain both records, and require operator review.                             |

After any incident, retain non-secret timestamps, source-event IDs, destination
hashes, block hashes, cursor values, findings, and operator actions. Never put
keys, prompts, personal data, provider output, or direct database credentials
in incident evidence.
