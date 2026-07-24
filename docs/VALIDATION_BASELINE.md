# Validation Baseline

AgentRouter inherits technical evidence from the separate
`agent-payments-validation-lab` repository. This document records what that lab
proved and, equally importantly, what remains unproven in this repository.

The lab is reference material only. AgentRouter must reimplement production
contracts in its own architecture and add its own tests before marking TODO
items complete.

## Proven in the validation lab

Validated on 24 July 2026 with Node.js 24.18.0:

| Capability | Evidence |
|---|---|
| Local HTTP 402 | Challenge, proof retry, and protected-resource unlock passed |
| Real Hedera HTTP 402 | A testnet HBAR proof was verified through the mirror node and replay was rejected |
| Hedera transfer | Small testnet HBAR transfers reached consensus |
| HCS | Topic creation, message submission, and mirror-node read-back passed |
| Structured decision | GLM-5.2 returned a schema-valid, policy-compliant provider choice |
| Supabase | A server-side create/read/update/delete round trip passed |
| Browser progress | Native `EventSource` delivered ordered lifecycle updates |
| Failure handling | Insufficient balance, expiry, replay, and provider timeout failed closed |
| Deployment configuration | Fourteen encrypted Hedera, model, and Supabase runtime variables were accepted by Vercel Production |

## Observed timing

Ten Hedera testnet transfers produced these submission-to-receipt measurements:

| Metric | Result |
|---|---:|
| Minimum | 944 ms |
| Median | 1134 ms |
| Mean | 1354 ms |
| Maximum / observed p95 | 2366 ms |

In a separate transfer, the public mirror-node record became available 2575 ms
after the consensus receipt. These are observations from a small testnet sample,
not service-level guarantees.

AgentRouter must therefore model at least:

```text
payment_submitted
  → payment_confirmed_mirror_pending
  → payment_verified
```

A mirror miss immediately after consensus is a retryable indexing state, not a
failed payment and not permission to pay again.

## Verified payment invariants

The lab's real payment probe verified:

- Hedera testnet network;
- successful finalized transaction;
- expected payer and recipient;
- exact required amount;
- exact challenge memo;
- transaction freshness and challenge expiry;
- supported transaction type; and
- single-use transaction proof.

AgentRouter must preserve these checks behind a reusable payment-verification
service and enforce proof uniqueness in durable storage.

## Verified failure behavior

The lab confirmed these required outcomes:

| Condition | Required behavior |
|---|---|
| Insufficient balance | Reject before transaction submission |
| Expired challenge | Reject without execution |
| Duplicate proof | Reject the second consumption |
| Provider timeout | Abort execution without retrying payment |
| Mirror indexing delay | Enter reconciliation/pending state |

The final application still needs integration and persistence tests for these
paths. Lab success does not prove that AgentRouter's implementation is safe.

## Architecture decisions supported by evidence

- Hedera is the settlement and public-audit layer.
- Postgres is the durable operational source of truth.
- HCS carries compact non-sensitive audit anchors, not full product state.
- Native SSE is sufficient for MVP browser progress; Supabase Realtime is not
  required.
- Payment keys, model credentials, and Supabase secret keys stay server-side.
- Money uses integer minor units, tinybars, or exact decimal strings.
- Quote acceptance, decision persistence, and budget reservation must be
  atomic.
- Proof consumption and receipt creation must be atomic and idempotent.
- Durable events are persisted before they are broadcast.

## Not validated by the lab

The following AgentRouter claims are new work and must not be presented as
implemented merely because the payment lab passed:

- provider discovery through The Graph;
- a provider registry or deployed subgraph;
- 0G private-compute execution or specific confidentiality guarantees;
- Vercel AI SDK orchestration;
- AgentRouter's durable Supabase domain schema and row-level security;
- production policy enforcement across cost, privacy, and capabilities;
- end-to-end deployed routing from discovery through delivery; and
- recovery across process restart or browser reconnect.

Each item remains governed by [TODO.md](../TODO.md) and requires a focused
commit with its own acceptance evidence.

## Reference probe map

These files live in the separate validation-lab repository:

| Lab file | Reusable lesson |
|---|---|
| `src/run-local.mjs` | Local HTTP 402, SSE, and failure-mode assertions |
| `src/run-external.mjs` | Mirror-node, HBAR, HCS, model, and Supabase probes |
| `src/run-hedera-402.mjs` | Real challenge, payment, proof verification, and replay rejection |
| `src/run-hedera-latency.mjs` | Ten-transfer receipt-latency benchmark |
| `src/run-mirror-lag.mjs` | Receipt-to-mirror measurement and UI state split |
| `src/llm-provider-decision.mjs` | Structured provider-decision contract |
| `src/run-supabase.mjs` | Temporary server-side CRUD validation |
| `src/run-browser-sse.mjs` | Native browser `EventSource` lifecycle |

Port contracts deliberately. Do not copy lab credentials, environment files,
Git history, or unrelated validation scaffolding.
