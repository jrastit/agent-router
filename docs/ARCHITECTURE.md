# AgentRouter Architecture

This document is the current AgentRouter design. The inherited technical
evidence is summarized in [Validation Baseline](VALIDATION_BASELINE.md), and the
recommended build sequence is in
[Implementation Handoff](IMPLEMENTATION_HANDOFF.md). Those documents adapt the
validation lab without replacing AgentRouter's newer The Graph and 0G design.

## Product boundary

AgentRouter is a commerce orchestration layer. It owns provider discovery,
policy evaluation, routing, payment coordination, and audit evidence. It does
not attempt to become a general-purpose model host, blockchain database, or
unrestricted provider marketplace in the hackathon MVP.

## System responsibilities

| Component         | Owns                                                  | Must not own                      |
| ----------------- | ----------------------------------------------------- | --------------------------------- |
| Browser           | User intent, policy input, progress, receipts         | Payment keys or server secrets    |
| Planner           | Typed requirements and proposed routing decision      | Direct authority to bypass policy |
| Policy engine     | Eligibility, budget checks, deterministic ranking     | Free-form model reasoning         |
| Discovery adapter | Provider and offer retrieval                          | Provider selection                |
| Execution adapter | Typed workload invocation and delivery                | Payment authorization             |
| Payment service   | Challenge validation, HBAR settlement, reconciliation | Product workflow state            |
| Postgres          | Durable operational state and idempotency             | Settlement truth                  |
| Hedera            | Settlement truth and public audit anchors             | Full application state            |
| SSE endpoint      | Projection of persisted workflow events               | Authoritative in-memory state     |

## Durable lifecycle

```text
created
  → requirements_ready
  → providers_discovered
  → quotes_evaluated
  → provider_selected
  → execution_requested
  → payment_required
  → payment_submitted
  → payment_confirmed_mirror_pending
  → payment_verified
  → execution_completed
  → receipt_recorded
```

Terminal failure states must include a stable reason code and distinguish
retryable execution failures from permanent policy or payment failures.

## Routing decision contract

The routing decision should be schema-valid data containing at least:

```json
{
  "requirementId": "req_...",
  "selectedProviderId": "prv_...",
  "selectedOfferId": "off_...",
  "policyVersion": 1,
  "quotedAmountMinor": 12,
  "currency": "EUR",
  "privacyClass": "confidential",
  "considered": [
    {
      "providerId": "prv_...",
      "eligible": false,
      "reasonCodes": ["PRIVATE_COMPUTE_REQUIRED"]
    }
  ]
}
```

The model may derive requirements and explain a choice, but hard policy
constraints and budget arithmetic must be enforced deterministically.

## Discovery

The Graph adapter should return normalized provider records and versioned
offers. Until the subgraph is implemented, deterministic fixtures may exercise
the same adapter contract. Fixture-backed discovery must be labeled clearly in
the UI and documentation.

Required provider attributes include:

- stable provider and offer identifiers;
- capabilities and supported input/output types;
- privacy/execution classifications;
- price and settlement terms;
- expected latency;
- quote expiry; and
- Hedera settlement identity.

## Private execution

Confidentiality is a hard eligibility constraint. When a requirement is marked
confidential:

1. exclude providers that cannot satisfy the private-execution policy;
2. route the typed workload through the 0G adapter;
3. avoid logging raw confidential prompts or artifacts;
4. persist only the minimum audit metadata; and
5. keep private artifacts behind short-lived authorized access.

The implementation must verify what privacy guarantees the chosen 0G service
actually provides before making claims in the UI or submission.

## Payment and verification

The paid-provider contract follows a versioned challenge-and-retry flow:

1. provider returns `402 Payment Required`;
2. server validates quote, network, asset, amount, recipient, memo, and expiry;
3. policy engine confirms the reservation remains valid;
4. payment service submits one HBAR transfer;
5. UI shows consensus separately from mirror verification;
6. provider verifies the finalized mirror-node record;
7. proof consumption and receipt creation occur atomically; and
8. retries return the original result instead of paying again.

Never submit another transfer solely because mirror indexing or provider
execution is delayed.

## Audit model

Postgres stores the complete operational record. HCS stores compact,
non-sensitive audit anchors such as:

- job and decision identifiers;
- event type and timestamp;
- hashes of canonical decision or receipt payloads; and
- relevant Hedera transaction identifiers.

Do not publish prompts, private artifacts, personal data, API keys, or payment
credentials to HCS.

## Browser updates

Persist each event before broadcasting it through SSE. On reconnect, the
browser reloads the durable timeline and resumes from the last event identifier.
Supabase Realtime is not required for the MVP.

## Failure behavior

Fail closed on:

- insufficient delegated or on-chain balance;
- no policy-compliant provider;
- expired or mismatched quote/challenge;
- duplicate transaction proof;
- ambiguous settlement;
- mirror-node timeout;
- provider timeout; and
- invalid or incomplete delivery.

Payment ambiguity enters reconciliation. It must never automatically create a
second payment.

## Initial deployment boundary

The Next.js application and server routes are intended for Vercel. Supabase,
Hedera, The Graph, and 0G remain external systems. All privileged credentials
stay in server-only environment variables and must not be referenced by client
components.

## Validation boundary

Hedera settlement, mirror verification, HCS, structured model output, Supabase
server-side CRUD, browser SSE, and core failure behavior were proven separately
in the validation lab. AgentRouter must still implement and test those contracts
inside its own durable architecture.

The Graph discovery and 0G private execution are AgentRouter additions and have
not been validated by the lab. They remain planned until their live adapters,
failure handling, and acceptance tests are complete.
