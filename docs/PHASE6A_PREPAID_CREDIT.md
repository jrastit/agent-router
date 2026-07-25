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

The intent endpoint accepts payer account, exact integer tinybars, and an
idempotency key. Network, treasury recipient, memo, five-minute expiry, and
deposit ID are server-derived. It returns the saved intent and a
`hedera-hbar-user-deposit` signing request.

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
