# AgentRouter implementation plan

Each checked item must correspond to one or more focused commits with passing
acceptance checks. Do not mark sponsor integrations complete when only fixtures
or documentation exist.

## Phase 0 — repository and scope

- [x] Define incremental commit and safety rules in `AGENTS.md`.
- [x] Record the product vision, target architecture, sponsor roles, and demo
      target.
- [x] Initialize the Next.js, TypeScript, and Tailwind CSS scaffold.
- [x] Add formatting, linting, type checking, tests, and one canonical
      validation command.
- [x] Add `.env.example`, secret validation, and documented server/client
      boundaries.
- [x] Record third-party starter attribution and hackathon start scope.

Exit criterion: a clean clone installs, validates, builds, and renders a basic
health page.

## Phase 1 — commerce domain

- [x] Define typed schemas for jobs, requirements, policies, providers, offers,
      quotes, decisions, challenges, payments, deliveries, receipts, and events.
- [x] Represent fiat amounts as integer minor units and HBAR as exact strings or
      tinybars.
- [x] Define stable lifecycle states and failure reason codes.
- [x] Implement deterministic policy eligibility and ranking independent of the
      model.
- [x] Test budget, privacy, capability, expiry, and tie-breaking rules.

Exit criterion: changing provider data or policy changes a schema-valid routing
decision without changing application code.

## Phase 2 — Supabase durability

- [x] Create version-controlled domain migrations.
- [x] Add ownership-aware row-level security.
- [x] Add unique constraints for idempotency keys and transaction proofs.
- [x] Make quote acceptance, decision persistence, and budget reservation
      atomic.
- [x] Make proof consumption and receipt creation atomic.
- [x] Persist events before broadcasting them.
- [x] Add database linting and migration verification.

Exit criterion: a job can resume after process restart without losing state or
double-spending its reservation.

## Phase 3 — provider discovery with The Graph

- [x] Define the discovery-adapter interface and normalized provider model.
- [x] Add deterministic fixtures for at least two providers.
- [x] Define the provider registry/subgraph schema.
- [ ] Implement a minimal provider-registry contract on a Graph-supported EVM
      testnet, initially Base Sepolia.
- [ ] Emit provider registration and update events containing capability,
      execution network, Hedera settlement account, exact price, privacy, and
      active status.
- [ ] Deploy the registry and record its chain ID, contract address, deployment
      transaction, and verified source.
- [ ] Register three demo offers: 0G Private, 0G Standard, and Mock Public
      Provider.
- [ ] Implement and deploy a Subgraph that indexes only the supported-chain
      provider-registry events.
- [ ] Record the Subgraph deployment ID, endpoint, indexed network, start block,
      and reproducible deployment commands.
- [x] Query The Graph through the discovery adapter.
- [x] Handle empty, stale, malformed, and unavailable discovery results.
- [x] Show discovery provenance in discovery results for decision evidence.
- [ ] Prove that a live registry price or active-status update changes planner
      eligibility, ranking, or selection.
- [ ] Label Hedera Mirror Node verification and 0G execution as independent
      integrations; never claim that the Subgraph indexes either system.

Exit criterion: the same planner flow works with fixtures and live indexed
providers from the supported-chain registry; the demo clearly identifies which
source is active and keeps discovery, execution, and settlement provenance
separate.

## Phase 4 — planner and decision evidence

- [x] Use the Vercel AI SDK for typed requirement extraction.
- [x] Generate schema-valid provider evaluations.
- [x] Enforce all hard constraints and budget arithmetic outside the model.
- [x] Persist candidates, exclusions, scores, selection, and policy version.
- [x] Add timeout and invalid-model-output fallbacks.

Exit criterion: the planner explains a decision that the deterministic policy
engine independently validates.

## Phase 5 — reusable 0G model-routing toolkit

- [x] Define a public framework API independent of Next.js, Supabase, Hedera,
      and the example UI.
- [x] Export typed `ModelCatalogAdapter`, `ModelRouter`,
      `ComputeExecutionAdapter`, `StorageEvidenceAdapter`, and
      `ProvenanceVerifier` contracts.
- [x] Normalize at least two comparable 0G-hosted model routes with capability,
      exact price, privacy, latency, model identity, and endpoint provenance.
- [x] Document the exact 0G Compute, Storage, and Chain SDKs, networks,
      guarantees, and verification fields actually used.
- [x] Implement live 0G Compute execution with typed results, bounded retries,
      and stable failure codes.
- [x] Persist non-secret evidence or memory through 0G Storage and retain its
      content-addressed reference.
- [x] Define a versioned canonical routing receipt binding request and policy
      hashes, candidates, selected model, quote, execution evidence, storage
      reference, optional caller/Agentic ID, network, and timestamp.
- [x] Deploy a minimal 0G Chain provenance contract and record its network,
      address, deployment transaction, verified source, and deployment command.
- [x] Anchor the receipt hash on 0G Chain and independently verify it.
- [x] Prevent prompts, confidential artifacts, secrets, and raw outputs from
      entering public receipts, chain events, or logs.
- [x] Export a documented package entry point and working example agent.
- [x] Add unit, adapter-contract, tamper-detection, timeout, and guarded live
      integration tests.

Exit criterion: an external example agent imports the toolkit, discovers at
least two 0G model routes, changes selection through policy or price, executes
through 0G Compute, stores non-secret evidence in 0G Storage, and verifies its
routing receipt against the 0G Chain anchor.

## Phase 6 — Hedera payment and audit

- [x] Implement the versioned `402` payment-challenge contract.
- [x] Validate network, asset, amount, recipient, memo, quote, and expiry before
      payment.
- [x] Reserve budget before submitting a transfer.
- [x] Submit one HBAR payment on Hedera testnet.
- [x] Expose separate submitted, consensus-confirmed, and mirror-verified states.
- [x] Verify payer, recipient, amount, memo, timestamp, type, and success through
      the mirror node.
- [x] Reject expired, mismatched, and duplicate proofs.
- [x] Reconcile ambiguous outcomes without automatically paying twice.
- [x] Publish compact non-sensitive decision and receipt anchors to HCS.
- [x] Store HashScan transaction and topic links.

Exit criterion: one live paid execution produces a durable receipt, public
transaction evidence, an HCS audit anchor, and no replay path.

Phase 6 settlement/audit is verified. Phase 5 was skipped by request, so the
live proof uses the settlement smoke flow rather than a paid provider execution;
the combined exit criterion remains dependent on Phase 5.

## Phase 6A — prepaid HBAR deposits and indexed balance monitoring

- [ ] Define a versioned user-deposit intent binding the application user,
      Hedera payer, treasury recipient, network, exact tinybar amount, memo,
      expiry, and idempotency key.
- [ ] Change the customer-payment path from an app-operator-funded transfer to
      a user-signed HBAR deposit into the application treasury; keep the
      existing operator-funded transfer only as an explicitly labeled provider
      settlement or guarded demo path.
- [ ] Add durable deposit states for intent created, submitted, consensus
      confirmed, mirror pending, mirror verified, Graph event pending, Graph
      indexed, credited, reconciliation required, and rejected.
- [ ] Verify each native HBAR deposit through Hedera Mirror Node before it can
      increase spendable application balance; validate payer, recipient,
      network, exact tinybars, memo, transaction type, success, timestamp, and
      intent binding.
- [ ] Consume each Hedera transaction proof exactly once and atomically credit
      the user's integer-tinybar ledger balance with an immutable journal entry.
- [ ] Define a minimal `DepositObserved` monitoring event containing only the
      deposit ID, user pseudonymous identifier or hash, Hedera transaction hash,
      exact tinybars, verification timestamp, and version; never publish
      personal data, credentials, or raw application requests.
- [x] Select and document one Graph-compatible event source:
  - preferred experiment: a payable Hedera EVM deposit contract whose event can
    be indexed reliably by a self-hosted Graph Node through Hedera's
    JSON-RPC Relay; or
  - fallback: a server relayer emits the already mirror-verified deposit
    reference from a minimal contract on Base Sepolia.
- [x] Add a repeatable Hedera Subgraph validation probe that checks Testnet
      chain identity, the finalized contract log, Subgraph health and indexing
      progress, and exact transaction/block correlation for returned app-event
      history.
- [x] Implement and test the minimal Hedera EVM app-event contract, including
      stable event identifiers, event kind, pseudonymous subject, payload
      digest, and no private application data.
- [x] Add the deployable Subgraph manifest, ABI, schema, generated bindings, and
      event mapping for the documented `AppEvent` history query contract.
- [x] Add a pinned Linux Compose stack and production runbook for Graph Node,
      PostgreSQL, Kubo, TLS query proxying, backups, monitoring, upgrades, and
      rollback; bind every operator interface to server loopback.
- [x] Provision a self-hosted Graph Node with Hedera Testnet JSON-RPC Relay,
      PostgreSQL, and IPFS connectivity; keep its administration and indexing
      status ports private.
- [x] Deploy the app-event contract and Subgraph and record the contract
      address, deployment transaction, Subgraph identifier, start block, and
      query endpoint without secrets.
- [ ] Restore Hedera chain-head ingestion: the healthy deployment remains at
      block `38431806` with a null chain head while the public relay has
      advanced beyond the configured start block `38431807`.
- [ ] Emit one deterministic Testnet event after indexing advances and retain
      its transaction and query evidence.
- [ ] Run `npm run validate:hedera-subgraph` against that live event and retain
      its successful JSON output as reproducible deployment evidence.
- [ ] Treat a fallback Base Sepolia relay event as monitoring/projection
      evidence only; it must never replace Hedera Mirror Node as payment truth.
- [x] Implement a Subgraph for `DepositObserved`, balance-credit, debit,
      reservation, 0G execution-charge, refund, and reconciliation events so an
      operator can monitor the complete economic lifecycle without exposing
      secrets.
- [ ] Add an idempotent Graph ingestion worker that correlates an indexed
      `DepositObserved` entity with the durable deposit intent and verified
      Mirror proof.
- [ ] Require both `mirror_verified` and `graph_indexed` before the requested
      `deposit → Graph event → app user balance increase` path marks funds
      spendable; tolerate either indexer lag by remaining pending rather than
      crediting twice.
- [ ] Add a reconciliation path for Mirror-verified deposits whose monitoring
      event is missing or stale, and for indexed events whose Hedera proof is
      missing or mismatched.
- [ ] Reserve user credit atomically before 0G execution, debit the actual
      charge once, and release any unused reservation without submitting a
      second HBAR transfer.
- [ ] Fund 0G Compute from the application's separately pre-funded 0G Payment
      Layer balance and record the exchange-rate snapshot and treasury liability
      used for the HBAR-denominated user charge.
- [ ] Keep HBAR-to-0G treasury rebalancing outside the request transaction;
      document that no native or automatic HBAR-to-0G conversion is claimed.
- [ ] Expose user-visible pending, credited, reserved, spent, refunded, and
      reconciliation balances, with links to Hedera and indexed monitoring
      evidence.
- [ ] Test duplicate deposits, duplicate Graph events, event reordering,
      Subgraph lag/reorg, Mirror lag, mismatched relay data, insufficient 0G
      treasury balance, partial execution charges, and concurrent reservations.
- [ ] Prove one live flow in which a user-signed testnet HBAR deposit is
      Mirror-verified, appears in the Subgraph, credits exactly once, funds one
      policy-approved 0G operation from treasury inventory, and produces a
      reconciled receipt.

Exit criterion: a user deposit follows `HBAR deposit → Hedera Mirror
verification → Graph-indexed monitoring event → atomic application credit`,
and one 0G operation consumes that credit exactly once while the app's separate
0G treasury pays the 0G network. The UI and receipt never describe this as a
direct HBAR-to-0G transfer.

## Phase 6B — mirror-verified Hedera event projection to EVM

The direct Hedera Graph Node experiment is not a production dependency. The
configured Hedera JSON-RPC Relay can advertise transactions in a block while
returning `null` for their receipts, so Graph Node correctly refuses to build a
partial canonical block. Do not patch Graph Node to skip those transactions.
Project only independently Mirror-verified Hedera events onto a
Graph-compatible EVM chain instead.

- [ ] Define a versioned `HederaEventAnchor` payload binding the Hedera network,
      source contract or HCS topic, transaction hash, consensus timestamp,
      event kind, non-secret payload digest, and schema version.
- [ ] Define a stable source-event ID from the complete Hedera source identity;
      use it as the destination contract replay key and the relayer
      idempotency key.
- [ ] Implement a Hedera Mirror Node event reader that requests only the
      configured contract logs or HCS topic messages and resumes from a durable
      consensus-timestamp cursor.
- [ ] Require independent Mirror Node verification before enqueueing an event
      for projection; never infer payment validity from the destination EVM
      event or Subgraph entity.
- [ ] Persist the verified source event, projection attempt, destination
      transaction, retry state, and terminal failure before broadcasting
      progress.
- [ ] Implement a minimal destination EVM contract that rejects duplicate
      source-event IDs and emits `HederaEventAnchored` without storing prompts,
      credentials, personal data, or raw provider results.
- [ ] Bind the destination contract to an allowlisted relayer or an explicit
      M-of-N signer policy and document that this is a relay trust boundary, not
      native cross-chain Hedera consensus verification.
- [ ] Submit destination transactions with bounded retries, fee limits, and one
      idempotent state machine; a timeout or ambiguous receipt must reconcile
      the original transaction rather than submit a new logical anchor.
- [ ] Deploy the projection contract to the selected Graph-compatible EVM
      testnet and record its chain ID, address, deployment transaction, start
      block, source verification, and relayer address.
- [ ] Implement and deploy a Subgraph for `HederaEventAnchored`, retaining the
      Hedera source identity and destination transaction provenance as
      separate fields.
- [ ] Add a projection reconciliation worker for Mirror-verified events missing
      destination anchors, destination anchors missing durable relay records,
      and Subgraph entities lagging their finalized destination transactions.
- [ ] Keep application credit and provider execution gated by authoritative
      Hedera Mirror verification and atomic Postgres proof consumption; Graph
      indexing may gate monitoring completeness but must not create spendable
      funds by itself.
- [ ] Show separate Hedera source, EVM projection, and Graph indexing states in
      the UI, with links to both chain explorers and an explicit relayer-trust
      label.
- [ ] Test duplicate Mirror responses, cursor restart, event reordering,
      relayer crash recovery, destination replay, nonce races, EVM reorg,
      Subgraph lag, malformed payloads, and mismatched Hedera source identity.
- [ ] Prove one live testnet flow from Hedera event through Mirror verification,
      durable relay record, EVM anchor, and Graph entity; demonstrate that
      replaying the same source event does not create a second anchor.
- [ ] Document production key custody, relayer monitoring, destination gas
      funding, cursor backup, contract pause/rotation, and recovery procedures.

Exit criterion: one independently Mirror-verified Hedera event is projected
exactly once to a Graph-compatible EVM chain and indexed by The Graph, while
the receipt and UI clearly preserve Hedera as the source of truth and identify
the destination event as a relayer-mediated monitoring projection.

## Phase 7 — product experience

- [x] Build task, budget, and privacy-policy input.
- [x] Show discovered providers and normalized quotes.
- [x] Show exclusions and concise selection evidence.
- [ ] Stream the persisted workflow timeline over SSE.
- [ ] Display “payment confirmed; verifying public record” during mirror lag.
- [ ] Restore the timeline after refresh or reconnect.
- [ ] Render delivery, total spend, remaining budget, and receipt.
- [x] Link Hedera evidence to HashScan.
- [ ] Make loading, empty, retryable, and terminal failure states explicit.

Exit criterion: a new observer can understand the request, alternatives,
policy, economic decision, payment, and result without narration.

## Phase 8 — failure and security hardening

- [ ] Test insufficient delegated and on-chain balance.
- [ ] Test expired quote and payment challenge.
- [ ] Test mismatched amount, recipient, memo, network, and asset.
- [ ] Test duplicate proof and repeated HTTP retry.
- [ ] Test mirror indexing delay and timeout.
- [ ] Test provider and model timeout.
- [ ] Test invalid delivery and discovery outage.
- [ ] Verify secrets are absent from client bundles, logs, fixtures, and errors.
- [ ] Verify row-level security from anonymous and authenticated clients.

Exit criterion: every known failure ends in a stable recoverable or terminal
state without duplicate payment or secret exposure.

## Phase 9 — deployment and demo

- [ ] Configure encrypted server runtime variables.
- [ ] Deploy early and smoke-test the production health endpoint.
- [ ] Complete one deployed end-to-end testnet commerce run.
- [ ] Seed deterministic backup providers and a completed receipt.
- [ ] Capture decision, payment, mirror, execution, and completion timestamps.
- [ ] Add setup, architecture, payment-flow, and sponsor-integration
      documentation.
- [x] Record the selected tracks and qualification requirements in
      `docs/PRIZE_STRATEGY.md`.
- [ ] Complete every applicable gate in the prize strategy's final go/no-go
      checklist.
- [ ] Recheck current event rules and all three official sponsor requirements
      immediately before submission.
- [ ] Verify public repository access and third-party attribution.
- [ ] Test screen recording, microphone, readable font size, and backup capture.
- [ ] Record a demo within the event time limit.
- [ ] Add the final project name and infrastructure-focused short description.
- [ ] Add all 0G contract addresses, deployment transactions, and explorer
      links.
- [ ] Publish the repository and verify README setup from a clean clone.
- [ ] Link a live demo and demo video under three minutes.
- [ ] Explain each 0G feature and SDK actually used.
- [ ] Include team names and required Telegram and X contacts in the submission
      form; keep personal contacts out of Git unless approved.
- [ ] Link the working example-agent source prominently from the README.
- [ ] Export a submission-ready architecture diagram covering 0G Compute,
      Storage, Chain, and optional Agentic ID.

Exit criterion: the public toolkit, example agent, deployed demo, and
under-three-minute recording prove policy-constrained routing across 0G-hosted
models plus independently verifiable 0G provenance. Optional sponsor
integrations remain clearly secondary.

## Explicitly deferred

- smart-contract escrow;
- auctions and negotiation;
- streaming or per-token settlement;
- multi-chain support;
- unrestricted provider onboarding;
- full decentralized reputation;
- enterprise authentication and accounting; and
- sponsor integrations that do not strengthen the core loop.
