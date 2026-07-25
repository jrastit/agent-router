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

## Phase 5 — execution and 0G privacy routing

- [ ] Define a typed execution-adapter interface.
- [ ] Add a deterministic standard provider adapter.
- [ ] Research and document the exact 0G private-compute guarantees used.
- [ ] Implement the 0G execution adapter.
- [ ] Route confidential requirements only to eligible private execution.
- [ ] Prevent confidential inputs and artifacts from entering logs or public
      audit payloads.
- [ ] Validate typed delivery output and failure behavior.

Exit criterion: changing a task from public to confidential changes provider
eligibility and routes execution through the verified 0G path.

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

## Phase 7 — product experience

- [ ] Build task, budget, and privacy-policy input.
- [ ] Show discovered providers and normalized quotes.
- [ ] Show exclusions and concise selection evidence.
- [ ] Stream the persisted workflow timeline over SSE.
- [ ] Display “payment confirmed; verifying public record” during mirror lag.
- [ ] Restore the timeline after refresh or reconnect.
- [ ] Render delivery, total spend, remaining budget, and receipt.
- [ ] Link Hedera evidence to HashScan.
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

Exit criterion: the deployed demo and backup recording prove autonomous
discovery, policy-constrained routing, execution, real HBAR settlement, and
auditable evidence.

## Explicitly deferred

- [ ] Low priority: spike a self-hosted Graph Node against Hedera Testnet
      through Hedera's JSON-RPC Relay.
- [ ] Low priority: verify event-only Subgraph compatibility for Hedera EVM
      contracts, including historical logs, restart recovery, and finality.
- [ ] Low priority: document that this path indexes emitted EVM contract events,
      not native HBAR transfers, HTS operations, or HCS topic messages.
- [ ] Low priority: compare the spike's reliability and sponsor value with the
      primary Base Sepolia registry before adopting it.
- smart-contract escrow;
- auctions and negotiation;
- streaming or per-token settlement;
- multi-chain support;
- unrestricted provider onboarding;
- full decentralized reputation;
- enterprise authentication and accounting; and
- sponsor integrations that do not strengthen the core loop.
