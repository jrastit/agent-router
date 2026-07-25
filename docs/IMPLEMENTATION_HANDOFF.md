# Implementation Handoff

This document converts the validation baseline into the recommended build
sequence for AgentRouter's current commerce-routing vision.

## Product promise

AgentRouter accepts a task and human policy, discovers eligible services,
selects the best feasible provider, executes the workload, settles payment, and
returns an auditable explanation and receipt.

The differentiator is not payment alone. It is explainable economic routing
across cost, privacy, capability, and budget.

## First complete vertical slice

Build one capability with at least two providers:

1. user submits a task, budget, and privacy classification;
2. planner derives one typed execution requirement;
3. discovery adapter returns comparable, expiring offers;
4. deterministic policy excludes infeasible providers;
5. planner records structured decision evidence for the selected offer;
6. execution adapter runs the workload;
7. provider returns a versioned payment challenge;
8. server validates the challenge and reserves the exact cost;
9. one HBAR transfer settles payment;
10. UI distinguishes consensus from mirror verification;
11. provider consumes the verified proof exactly once;
12. delivery and receipt are persisted; and
13. a compact non-sensitive audit anchor is submitted to HCS.

The slice is not complete if the provider is selected by a hidden hardcoded
branch. Changing provider attributes or policy must change the decision without
changing application code.

## Integration strategy

### Provider discovery

Start behind a `DiscoveryAdapter` contract:

```ts
interface DiscoveryAdapter {
  discover(requirement: Requirement): Promise<ProviderOffer[]>;
}
```

Use deterministic fixtures first. Then deploy a minimal provider registry on a
Graph-supported EVM testnet, initially Base Sepolia, index its registration and
update events with a Subgraph, and query it through the same adapter contract.
Seed 0G Private, 0G Standard, and Mock Public Provider offers so privacy, price,
capability, and budget can visibly change selection.

The UI and decision evidence must identify whether results came from fixtures
or the live index, including the registry network and contract plus the
Subgraph deployment and block. Do not describe the registry network as the
provider's execution or settlement network. The Graph does not index Hedera or
0G in this design; those integrations provide their own evidence.

### Private execution

Start behind an `ExecutionAdapter` contract:

```ts
interface ExecutionAdapter {
  execute(request: ExecutionRequest): Promise<Delivery>;
}
```

Add a deterministic standard provider before the 0G adapter. Treat
confidentiality as a hard eligibility rule. Document and test the exact 0G
privacy guarantees actually used before making privacy claims.

### Settlement

Keep challenge parsing, transaction submission, mirror verification, and
reconciliation in narrow server-side modules. The policy engine authorizes a
reservation; it does not handle private keys directly.

### Audit

Postgres stores the complete operational record. HCS receives identifiers,
event types, timestamps, transaction IDs, and hashes of canonical decision or
receipt payloads. Never send prompts, confidential artifacts, personal data, or
credentials to HCS.

## Minimum durable model

Start with:

- `jobs` and immutable policy snapshots;
- typed `requirements`;
- `providers`, versioned `offers`, and immutable `quotes`;
- `decisions` with candidates, exclusions, scores, and selection;
- `payment_challenges` and `payments`;
- `deliveries` and `receipts`; and
- append-only `events`.

Required constraints:

- unique external idempotency key per command boundary;
- unique Hedera transaction proof;
- one accepted quote per requirement;
- one active reservation per accepted quote;
- atomic quote acceptance, decision, and reservation;
- atomic proof consumption and receipt creation; and
- ownership-aware row-level security.

## Runtime configuration classes

Commit names and safe defaults in `.env.example`; keep values outside Git.

| Class             | Examples                                           | Deployment rule                                     |
| ----------------- | -------------------------------------------------- | --------------------------------------------------- |
| Hedera runtime    | Operator ID/key, recipient, topic, transfer amount | Server-only encrypted variables                     |
| Model runtime     | API key, base URL, model, timeout                  | Server-only encrypted variables                     |
| Supabase runtime  | Project URL and secret key                         | Server-only; browser uses scoped public access only |
| The Graph runtime | Gateway/subgraph identifiers and access token      | Token server-only when required                     |
| 0G runtime        | Endpoint, network, signer, or provider credentials | Server-only; exact names follow verified SDK/API    |
| Administration    | Vercel token and direct database URL               | Local/CI administration only; never app runtime     |

Do not invent final The Graph or 0G variable names before selecting and testing
their actual integration surfaces.

## Commit sequence

Follow [AGENTS.md](../AGENTS.md) and [TODO.md](../TODO.md). A practical first
sequence is:

1. scaffold and canonical validation command;
2. environment contract and server/client boundary tests;
3. domain schemas and state machine;
4. Supabase migrations, constraints, and security;
5. fixture discovery and deterministic policy selection;
6. typed planner integration;
7. execution adapter and standard provider;
8. payment challenge and Hedera settlement;
9. mirror verification, reconciliation, and replay protection;
10. durable receipt, HCS anchor, and SSE timeline;
11. product UI;
12. Base Sepolia provider registry and live The Graph discovery;
13. verified 0G private execution;
14. deployed end-to-end and failure hardening; and
15. final documentation and demo recording.

One independently verifiable milestone means one commit. Do not combine sponsor
integrations merely to reduce the commit count.

## Demo evidence

The final demo should visibly prove:

- multiple providers were discovered;
- at least one provider was excluded for a stable policy reason;
- privacy classification changes eligibility or execution path;
- the agent selected an offer rather than following a fixed branch;
- one real HBAR payment settled on testnet;
- mirror verification was distinct from consensus confirmation;
- the transaction is inspectable in HashScan;
- the final receipt contains decision, execution, and spend evidence; and
- an HCS event or hash anchors the audit record.

Prepare deterministic provider fixtures and a previously completed receipt as a
backup. Never present fixture discovery or mocked execution as a live sponsor
integration.

## Release gate

Before submission:

- a clean clone installs, validates, and builds;
- the deployed flow completes the full documented commerce loop;
- refresh and SSE reconnect restore durable state;
- insufficient funds, expiry, mismatch, replay, discovery outage, model
  timeout, mirror delay, and provider timeout fail safely;
- no secret appears in source, client bundles, logs, screenshots, or HCS;
- live and fixture integration modes are labeled accurately;
- current sponsor and event requirements have been rechecked; and
- the demo and backup recording fit the current event limit.
