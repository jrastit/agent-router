# Phase 6A prepaid HBAR credit

## Implemented and verified locally

The customer payment path creates a versioned deposit intent and returns a
`hedera-hbar-user-deposit` signing request. The request binds the application
user, Hedera payer and treasury recipient, Testnet, exact integer tinybars,
memo, expiry, and idempotency key. The application never requests or receives
the user's private key.

After the user submits a transaction ID, the server fetches the transaction
from Hedera Mirror Node. It verifies a successful `CRYPTOTRANSFER`, payer,
treasury recipient, exact recipient credit, memo, transaction ID, consensus
timestamp, and intent window. Mirror `404` is a pending state, not a reason to
submit another payment.

`credit_verified_deposit` is the authoritative Postgres boundary. In one
transaction it:

1. locks the user's deposit;
2. consumes a globally unique Hedera transaction proof;
3. increments exact integer-tinybar application credit;
4. appends one immutable journal entry;
5. marks the deposit credited; and
6. enqueues the privacy-minimal `DepositObserved` projection.

An idempotent retry returns the existing balance without adding another
journal entry. Projection and Graph indexing states live beside, but do not
control, the authoritative deposit and credit states. Projection delivery
failure cannot roll back, duplicate, or delay credit.

## 0G funding and charging

Before an operation, `reserve_user_credit` locks the account and atomically
moves exact tinybars from available to reserved. Concurrent requests serialize
on that row and fail closed if the remaining balance is insufficient.
`settle_user_credit` charges the actual amount once and returns the unused
reservation as available/refunded credit.

The 0G network is paid from the application's separately pre-funded 0G Payment
Layer inventory. Execution fails before provider invocation when that inventory
is insufficient. Each reservation records the exact HBAR treasury liability
and the HBAR/USD and 0G/USD rate snapshot used for the user charge.

There is no native, direct, or automatic HBAR-to-0G conversion in the request
transaction. Treasury operators rebalance HBAR and 0G inventory out of band.
The existing operator-signed Hedera transfer remains only the Phase 6
settlement smoke/demo and potential provider-settlement path; it is not the
Phase 6A customer deposit path.

## Reconciliation

Reconciliation has two independent queues:

- A Mirror-verified deposit that cannot be credited is marked
  `reconciliation_required`; operators compare the bound intent, proof, unique
  journal constraint, and account totals before retrying the same idempotency
  key.
- A credited deposit with missing, stale, failed, or mismatched projection or
  Graph evidence remains spendable. Operators retry or repair only its outbox
  and monitoring state; they never create a second deposit credit.

The user view exposes pending, credited, reserved, spent, refunded, and
reconciliation amounts, plus separate Hedera, projection, and Graph evidence.

## Validation and live proof

Run:

```sh
npm run validate:supabase
npm run validate
```

The SQL test covers idempotent proof credit, post-credit projection enqueue,
insufficient credit, and partial charge/refund. TypeScript tests cover expired
and mismatched proofs, Mirror lag, privacy-minimal projection payloads,
user-signing material, and insufficient 0G treasury inventory.

A new live user-wallet deposit and combined 0G operation must be recorded
before marking the final Phase 6A live-proof checkbox complete. Do not reuse the
operator-funded Phase 6 settlement smoke as that evidence.

## Authenticated deposit API

The production application exposes two server-only persistence boundaries:

```text
POST /api/deposits/intents
POST /api/deposits/{depositId}/proof
POST /api/deposits/{depositId}/verify
```

Both require a Supabase user access token in the `Authorization: Bearer`
header. The server forwards that user token to the security-definer database
function so `auth.uid()` remains the owner. The service-role key is used only
as the server-side Supabase API key and never reaches the browser.

The intent endpoint accepts payer account and exact integer tinybars in its JSON
body, plus an idempotency key in the `Idempotency-Key` request header. Network,
treasury recipient, memo, five-minute expiry, and deposit ID are server-derived.
It returns the saved intent and a `hedera-hbar-user-deposit` signing request.

The proof endpoint accepts only the finalized Hedera transaction ID. It marks
the owner-bound deposit submitted and explicitly reports that independent
Mirror verification is still pending. Neither endpoint accepts a private key,
raw signed transaction bytes, or authority to submit another payment.

The verification endpoint reloads the owner-bound intent and submitted proof
under the user's bearer token, independently queries Hedera Mirror Node, and
then uses a service-only RPC with that verified owner ID. The RPC locks the
deposit and atomically consumes the unique proof, credits the integer-tinybar
balance, appends its journal entry, and enqueues monitoring. Repeating the same
verified request returns the existing balance without creating another credit.

### What “validated deposit proof” means

A deposit is validated only when the server independently proves that the
finalized Hedera transaction matches every bound field of the stored intent.
The transaction ID returned by the wallet is evidence to verify, not sufficient
proof by itself.

The Mirror response must establish all of the following:

- the submitted transaction ID resolves to a finalized transaction;
- the result is `SUCCESS` and the transaction type is `CRYPTOTRANSFER`;
- the payer and treasury recipient match the intent;
- the recipient credit is exactly the intent's integer tinybar amount;
- the payer debit covers at least that amount;
- the memo exactly matches the unique intent memo;
- the transaction belongs to Hedera Testnet; and
- consensus occurred no later than the intent expiry.

After those checks, the service-only database function locks the deposit and
atomically:

- consumes the unique transaction proof;
- records Mirror consensus and verification evidence;
- credits the user's exact integer-tinybar balance;
- appends one immutable deposit journal entry;
- marks the deposit `credited`; and
- creates the privacy-safe Graph projection outbox record.

Unique proof and journal constraints make retries idempotent. A repeated
verification returns the existing balance; it cannot credit twice. Mirror
pending responses retry only the read-only proof query and never authorize
another wallet transfer.

The HashScan link is public transaction evidence. The authoritative validation
is the combination of exact intent matching through Mirror, unique proof
consumption, and atomic Postgres credit. The later EVM/Graph anchor proves the
monitoring projection and cannot create or modify the balance.

### Verification and live-update sequence

The wallet transaction and application credit are deliberately asynchronous:

1. The external wallet executes one native HBAR transfer and returns its
   transaction ID.
2. The proof endpoint stores that ID and commits the deposit as `submitted`.
3. Supabase Realtime may notify the browser about this submitted-state change,
   but the balance remains unchanged.
4. The browser calls the verification endpoint. A `202 mirror_pending` response
   causes another read-only verification attempt after 1.5 seconds, for at
   most 20 attempts. These retries query the same proof and cannot submit
   another Hedera payment.
5. After Mirror returns a matching finalized transaction, the service-only
   credit RPC consumes the proof exactly once and commits the `credited`
   deposit, journal row, balance update, and monitoring outbox atomically.
6. Realtime emits the committed user-owned row changes. The browser treats
   them only as invalidation signals and reloads `get_my_fund_activity`; it
   never calculates a balance from WebSocket payloads.

If the browser closes or exhausts the short retry window before Mirror indexes
the transaction, session restoration retries submitted deposits. Operators can
also run `npm run reconcile:deposits`; the guarded reconciler verifies the same
bound proof through Mirror and invokes the same idempotent credit boundary.

For self-hosted Supabase, Kong must route Realtime through the tenant-bearing
hostname `realtime-dev.supabase-realtime`. Declare that hostname as a persistent
Docker network alias on the `realtime` service. Routing it as only `realtime`
causes `TenantNotFound`; omitting the alias causes Kong DNS failures and public
WebSocket 503 responses.

### Role of The Graph

The Graph is the queryable public monitoring plane, not a payment processor or
balance database. After Mirror verification and atomic Supabase credit, the
application creates a privacy-minimal `DepositObserved` outbox record. The
allowlisted relay can turn that record into an EVM `HederaEventAnchored` event,
and Graph Node indexes the event as a `HederaEventAnchor` entity.

This ordering is intentional:

```text
Hedera settlement → Mirror verification → Supabase credit
                                      ↘ asynchronous relay → EVM event → Graph
```

Graph unavailability or indexing lag cannot block, create, duplicate, or
reverse credit. The entity exposes correlation and replay evidence—source event
ID, Hedera identity digest and consensus timestamp, payload digest, destination
transaction and block, contract, and relayer—without exposing the application
user, balance, wallet address, or private journal.

The deployed Graph proof includes native-transfer anchors for credited user
deposits. Each stable source-event ID correlates the durable Supabase relay
record, exactly-once EVM event, and indexed Graph entity. The original HCS
anchor remains historical projection evidence and must not be relabeled as a
user deposit.

## Browser session continuity

The browser stores the Supabase user access token, rotating refresh token,
expiry, and email in versioned local storage. On refresh it reuses an
unexpired access token or exchanges the refresh token through the public
Supabase Auth endpoint. Invalid, expired-without-refresh, or malformed state is
deleted. The account disconnect control also deletes it.

WalletConnect remains the authority for wallet session persistence. The
application initializes its provider after refresh and silently reattaches a
persisted Hedera Testnet account when one exists; it does not open a connection
modal during restoration. The wallet disconnect control delegates deletion to
WalletConnect.

Only user-scoped Supabase tokens and WalletConnect session data enter browser
storage. The Supabase service-role key, Hedera operator key, and other
server-only credentials remain in the production server environment and are
checked against the client bundle during validation.

## External wallet approval

The live deposit panel uses Reown AppKit with Hedera's native WalletConnect
adapter on Testnet. Set the browser-safe
`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, rebuild the application, connect an
external Hedera wallet, and supply an authenticated application session token.

Before opening the wallet approval, the panel displays the bound payer,
treasury, network, exact integer tinybar amount, memo, and expiry returned by
the server-created intent. It refuses a connected account that differs from
the bound payer and rechecks expiry immediately before signing. The wallet
signs and executes the native transfer; the application submits only the
returned Hedera transaction ID to the proof endpoint. No private key or raw
signed transaction crosses the application boundary.
