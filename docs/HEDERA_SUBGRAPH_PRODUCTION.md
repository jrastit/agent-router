# Hedera app-event Subgraph production runbook

This runbook preserves a reproducible Linux deployment path for the
`HederaAppEventJournal` monitoring projection.

The Subgraph is not payment truth. Hedera Mirror Node verification remains
mandatory before a payment can alter application credit. Graph Node provides
queryable public history and monitoring evidence only.

## Architecture and exposure

The Compose stack contains pinned Graph Node, PostgreSQL, and Kubo images.
PostgreSQL has no host port. Kubo's deployment API and all five Graph Node ports
bind to server loopback only.

| Loopback port | Purpose                     | Public? |
| ------------- | --------------------------- | ------- |
| `5001`        | Graph CLI upload to Kubo    | Never   |
| `8000`        | GraphQL query origin        | Proxy   |
| `8001`        | GraphQL subscriptions       | No      |
| `8020`        | Graph Node deployment admin | Never   |
| `8030`        | Indexing status             | Never   |
| `8040`        | Metrics                     | Never   |

Only the exact app-event GraphQL route should be published through an
authenticated or rate-limited TLS reverse proxy. The supplied
`nginx-app-events.conf.example` is a generic starting point. An Apache
alternative preconfigured for `graph.router.fexhu.com` is available at
`apache-app-events.conf.example`. Confirm the hostname and certificate paths
before installing either template.

## Linux prerequisites

Use a maintained x86-64 Linux distribution with:

- Docker Engine and the Docker Compose v2 plugin;
- Git, Node.js 22, and npm;
- a TLS reverse proxy such as Nginx;
- an SSD-backed filesystem with monitored free space; and
- off-host encrypted backups.

Begin with at least 4 CPU cores, 16 GB RAM, and 100 GB SSD for this narrow
Testnet Subgraph, then size from measured indexing, query, and PostgreSQL
metrics. Mainnet or additional Subgraphs require a separate capacity exercise.

## 1. Install and prepare

Clone the repository at a reviewed commit and install exact JavaScript
dependencies:

```sh
git clone <repository-url> /opt/agent-router
cd /opt/agent-router
npm ci
npm run graph:codegen
npm run graph:build
```

Create the private Compose environment:

```sh
cd /opt/agent-router/deploy/graph-node
cp graph-node.env.example .env
chmod 600 .env
```

Replace `GRAPH_POSTGRES_PASSWORD` with a long random value. Set
`HEDERA_EVM_RPC_URL` to a production-capable Hedera JSON-RPC Relay endpoint.
The public Hashio Testnet URL is useful for the first experiment, but its
availability and rate limits should not be treated as your production SLA.

Check that the relay reports Hedera Testnet chain ID `0x128`:

```sh
set -a
. ./.env
set +a
curl --fail --silent --show-error \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' \
  "$HEDERA_EVM_RPC_URL"
```

## 2. Start the private indexing stack

```sh
cd /opt/agent-router/deploy/graph-node
docker compose pull
docker compose config
docker compose up -d
docker compose ps
docker compose logs --tail=100 graph-node
```

All services must become healthy. Confirm externally that firewall rules expose
none of `5001`, `8000`, `8001`, `8020`, `8030`, or `8040`.

Configure Nginx from `nginx-app-events.conf.example`, issue a trusted
certificate, and expose only:

```text
POST https://graph.example.com/subgraphs/name/agent-router/app-events
```

For Apache, enable `headers`, `proxy`, `proxy_http`, `reqtimeout`, `rewrite`,
and `ssl`, install `apache-app-events.conf.example` as a site, issue the
certificate named in the template, and expose only these POST query routes:

```text
POST https://graph.router.fexhu.com/subgraphs/name/agent-router/app-events
POST https://graph.router.fexhu.com/subgraphs/name/agent-router/hedera-projection
```

The template redirects HTTP to HTTPS, rejects non-POST methods and unrelated
paths, limits request bodies, and uses exact proxy mappings to the loopback
query port. Graph administration, indexing status, metrics, IPFS, and WebSocket
ports remain private.
Use an upstream firewall or a request-aware Apache security module when public
traffic requires per-client request-rate limiting.

## 3. Deploy the Hedera event journal

From the repository root, create a local `.env` with mode `0600` containing:

```text
HEDERA_EVM_RPC_URL=https://testnet.hashio.io/api
HEDERA_EVM_PRIVATE_KEY=0x...
```

Use a disposable, minimally funded ECDSA Testnet account. Never commit, print,
or paste the key into deployment evidence.

```sh
cd /opt/agent-router
npm run deploy:hedera-app-events
```

For an existing native Hedera operator, including an Ed25519 account, configure
`HEDERA_OPERATOR_ID` and `HEDERA_OPERATOR_KEY` instead and run:

```sh
npm run deploy:hedera-app-events:sdk
```

This path uses `ContractCreateFlow` and binds the publisher to the operator's
long-zero Solidity address. It waits for JSON-RPC bytecode visibility before
reporting a start block.

Retain the JSON output. Set its `contractAddress` and `startBlock` in `.env`:

```text
HEDERA_APP_EVENT_CONTRACT_ADDRESS=0x...
HEDERA_APP_EVENT_START_BLOCK=123456
```

The contract publisher is the deployment signer. Keep that key in the intended
server-side secret manager if the application will publish more events, or
remove it from the deployment host when event publication happens elsewhere.

The verified Testnet identifiers and current indexing state are recorded in
[Hedera Subgraph deployment evidence](HEDERA_SUBGRAPH_EVIDENCE.md).

## 4. Deploy the Subgraph

Run this on the Graph Node host, where the admin and Kubo ports are loopback
only:

```sh
npm run deploy:hedera-subgraph
```

The command:

1. rejects non-loopback admin and IPFS endpoints;
2. creates the `agent-router/app-events` name if needed;
3. injects the live contract address and start block through a temporary
   `networks.json`;
4. uploads the compiled deployment to the private Kubo API; and
5. deploys it through Graph Node's private JSON-RPC admin API.

Set an explicit version label for repeatable releases:

```text
HEDERA_SUBGRAPH_VERSION=2026-07-25.1
```

Inspect indexing without publishing the status port:

```sh
curl --fail --silent --show-error \
  -H 'content-type: application/json' \
  --data '{"query":"{ indexingStatuses { subgraph health synced fatalError { message } chains { chainHeadBlock { number } latestBlock { number } } } }"}' \
  http://127.0.0.1:8030/graphql
```

Do not continue to a production cutover if health is `failed`.

## 5. Emit and validate one deterministic event

Provide only precomputed public digests:

```text
HEDERA_APP_EVENT_ID=0x<32-byte-id>
HEDERA_APP_EVENT_SUBJECT=0x<32-byte-pseudonymous-subject>
HEDERA_APP_EVENT_KIND=deployment.validated
HEDERA_APP_EVENT_PAYLOAD_DIGEST=0x<32-byte-payload-digest>
```

Submit exactly once:

```sh
npm run emit:hedera-app-event
```

Copy its transaction hash into `.env`, point the validator at the local query
route, and run:

```text
HEDERA_APP_EVENT_TX_HASH=0x...
HEDERA_SUBGRAPH_QUERY_URL=http://127.0.0.1:8000/subgraphs/name/agent-router/app-events
```

```sh
npm run validate:hedera-subgraph
```

A successful result proves that the finalized Hedera contract log and returned
historical entity share the exact transaction hash and block. Save the
non-secret JSON output with the release evidence.

Example history query:

```graphql
query RecentAppEvents {
  appEvents(first: 100, orderBy: blockTimestamp, orderDirection: desc) {
    id
    kind
    subject
    payloadDigest
    version
    transactionHash
    blockNumber
    blockTimestamp
    logIndex
  }
}
```

Use cursor-based filters rather than increasing `first` without bounds in an
operator UI.

### Economic lifecycle history

The same contract and Subgraph expose exact integer-tinybar economic events:

| Type | Meaning               |
| ---- | --------------------- |
| `1`  | Deposit observed      |
| `2`  | Balance credited      |
| `3`  | Balance debited       |
| `4`  | Credit reserved       |
| `5`  | 0G execution charged  |
| `6`  | Balance refunded      |
| `7`  | Reconciliation opened |

Set `HEDERA_ECONOMIC_EVENT_TYPE`, an exact signed
`HEDERA_ECONOMIC_AMOUNT_TINYBARS`, and a hashed
`HEDERA_ECONOMIC_REFERENCE_ID`, then run:

```sh
npm run emit:hedera-economic-event
```

`referenceId` binds the monitoring event to the relevant payment, reservation,
execution, refund, or reconciliation record without publishing that private
record. Event types 1–6 require a nonzero amount; reconciliation may use zero
when no balance delta is known.

Query history by pseudonymous subject:

```graphql
query EconomicHistory($subject: Bytes!) {
  economicEvents(
    first: 100
    where: { subject: $subject }
    orderBy: blockTimestamp
    orderDirection: asc
  ) {
    id
    eventType
    amountTinybars
    referenceId
    payloadDigest
    transactionHash
    blockNumber
    blockTimestamp
  }
}
```

## Operations

### Backups

Create a PostgreSQL logical backup before upgrades and at a tested schedule:

```sh
mkdir -p /var/backups/agent-router-graph
docker compose exec -T postgres \
  pg_dump --format=custom --username=graph-node graph-node \
  > /var/backups/agent-router-graph/graph-node.dump
```

Encrypt and copy the dump off-host. Test restoration on an isolated host.
Backing up Kubo shortens recovery, but the committed Subgraph and PostgreSQL
backup are the critical deployment/state records.

### Monitoring

Scrape `127.0.0.1:8040` with a local monitoring agent. Alert on:

- unhealthy or restarted containers;
- Subgraph `failed` health or increasing chain-head lag;
- PostgreSQL disk, connections, and backup failures;
- JSON-RPC Relay errors or throttling; and
- query latency and rate-limit rejection changes.

### Upgrades and rollback

Never use floating image tags. Before changing a pinned image:

1. read upstream release and migration notes;
2. take and verify a PostgreSQL backup;
3. test the exact image set against a restored staging copy;
4. run `docker compose config` and the live validation probe;
5. deploy during a monitored window; and
6. retain the previous Compose commit and backup for rollback.

Graph Node database migrations may make image-only rollback unsafe. Restore the
matching pre-upgrade database backup when upstream notes require it.

### Incident boundary

If Graph Node, Kubo, or the relay is delayed, keep application events pending
and reconcile later. Never resubmit a Hedera payment because indexing is slow,
and never credit a payment from a Subgraph entity without the independently
verified Hedera Mirror Node proof.
