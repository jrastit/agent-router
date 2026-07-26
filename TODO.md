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

## Phase 3 — provider discovery adapters

- [x] Define the discovery-adapter interface and normalized provider model.
- [x] Add deterministic fixtures for at least two providers.
- [x] Define the provider registry/subgraph schema.
- [x] Query The Graph through the discovery adapter.
- [x] Handle empty, stale, malformed, and unavailable discovery results.
- [x] Show discovery provenance in discovery results for decision evidence.

Exit criterion: the planner works with deterministic fixtures and the
implemented Graph discovery adapter. A live provider-registry deployment is not
yet claimed. Hedera monitoring is a separate projection described in Phase 6B.

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

Phase 6 settlement/audit is verified. Its live proof used the settlement smoke
flow; a combined paid provider execution remains a separate end-to-end demo
milestone.

## Phase 6A — prepaid HBAR deposits and authoritative application credit

- [x] Define a versioned user-deposit intent binding the application user,
      Hedera payer, treasury recipient, network, exact tinybar amount, memo,
      expiry, and idempotency key.
- [x] Change the customer-payment path from an app-operator-funded transfer to
      a user-signed HBAR deposit into the application treasury; keep the
      existing operator-funded transfer only as an explicitly labeled provider
      settlement or guarded demo path.
- [x] Add durable deposit states for intent created, submitted, consensus
      confirmed, mirror pending, mirror verified, credited, reconciliation
      required, and rejected. Track projection and Graph-indexing states
      separately so monitoring lag cannot change the authoritative balance.
- [x] Verify each native HBAR deposit through Hedera Mirror Node before it can
      increase spendable application balance; validate payer, recipient,
      network, exact tinybars, memo, transaction type, success, timestamp, and
      intent binding.
- [x] Consume each Hedera transaction proof exactly once and atomically credit
      the user's integer-tinybar ledger balance with an immutable journal entry.
- [x] Define a minimal `DepositObserved` monitoring payload containing only the
      deposit ID, user pseudonymous identifier or hash, Hedera transaction hash,
      exact tinybars, verification timestamp, and version; never publish
      personal data, credentials, or raw application requests.
- [x] Select Base Sepolia as the Graph-compatible destination for the
      relayer-mediated monitoring projection described in Phase 6B. This
      destination is not payment truth and is not yet deployed.
- [x] Enqueue the monitoring projection only after the deposit is independently
      Mirror-verified and atomically credited; projection failure or Graph lag
      must not reverse, duplicate, or delay authoritative application credit.
- [x] Add a reconciliation path for Mirror-verified deposits that cannot be
      credited, and separately reconcile credited deposits whose projection or
      indexed monitoring entity is missing, stale, or mismatched.
- [x] Reserve user credit atomically before 0G execution, debit the actual
      charge once, and release any unused reservation without submitting a
      second HBAR transfer.
- [x] Fund 0G Compute from the application's separately pre-funded 0G Payment
      Layer balance and record the exchange-rate snapshot and treasury liability
      used for the HBAR-denominated user charge.
- [x] Keep HBAR-to-0G treasury rebalancing outside the request transaction;
      document that no native or automatic HBAR-to-0G conversion is claimed.
- [x] Expose user-visible pending, credited, reserved, spent, refunded, and
      reconciliation balances, with separate Hedera, projection, and Graph
      monitoring evidence.
- [x] Test duplicate deposits, Mirror lag, mismatched proofs, atomic-credit
      retries, insufficient 0G treasury balance, partial execution charges, and
      concurrent reservations. Phase 6B owns projection and Subgraph failure
      tests.
- [ ] Prove one live flow in which a user-signed testnet HBAR deposit is
      Mirror-verified, credits exactly once, and funds one policy-approved 0G
      operation from treasury inventory while projection proceeds independently.
  - [x] Deploy the reviewed commerce, prepaid-credit, and projection migrations
        to the production Supabase database with tracked versions and a
        post-deployment schema probe.
  - [x] Expose authenticated server endpoints for creating a bound deposit
        intent and submitting a user-signed Hedera transaction proof without
        accepting or handling the user's private key.
  - [x] Add an external Hedera wallet signing path that displays the exact
        payer, treasury, network, tinybar amount, memo, and expiry before the
        user approves the transfer.
  - [ ] Mirror-verify and atomically credit the signed deposit exactly once,
        then reserve and settle one policy-approved 0G operation against that
        credit while the separately funded 0G treasury pays the network.
  - [x] Persist the credited deposit's relay record and correlate its
        exactly-once EVM anchor with the indexed Graph entity, including replay
        rejection and independent authority labels.

Exit criterion: a user deposit follows `HBAR deposit → Hedera Mirror
verification → atomic Postgres proof consumption and application credit`, and
one 0G operation consumes that credit exactly once while the app's separate 0G
treasury pays the 0G network. Projection and Graph-indexing lag remain visible
but cannot create, duplicate, reverse, or delay spendable credit. The UI and
receipt never describe this as a direct HBAR-to-0G transfer.

### Completed direct-Hedera Graph Node experiment

The following artifacts remain useful experimental evidence, but the stalled
direct indexer is not a Phase 6A or Phase 6B production dependency:

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
- [x] Implement a Subgraph for `DepositObserved`, balance-credit, debit,
      reservation, 0G execution-charge, refund, and reconciliation events so an
      operator can monitor the complete economic lifecycle without exposing
      secrets.

The deployment remains healthy but blocked at block `38431806`, before start
block `38431807`, because the configured relay exposes blocks containing
transactions with unavailable receipts. Do not patch Graph Node to accept a
partial canonical block. Restoring ingestion, emitting a live event, and
retaining successful probe output are optional diagnostics rather than delivery
gates.

## Phase 6B — mirror-verified Hedera event projection to EVM

The direct Hedera Graph Node experiment is not a production dependency. The
configured Hedera JSON-RPC Relay can advertise transactions in a block while
returning `null` for their receipts, so Graph Node correctly refuses to build a
partial canonical block. Do not patch Graph Node to skip those transactions.
Project only independently Mirror-verified Hedera events onto the local Ganache
EVM instead. The projection is asynchronous monitoring evidence: Mirror
verification and atomic Postgres proof consumption remain the only path to
application credit.

- [x] Define a versioned `HederaEventAnchor` payload binding the Hedera network,
      source contract or HCS topic, transaction hash, consensus timestamp,
      event kind, non-secret payload digest, and schema version.
- [x] Define a stable source-event ID from the complete Hedera source identity;
      use it as the destination contract replay key and the relayer
      idempotency key.
- [x] Implement a Hedera Mirror Node event reader that requests only the
      configured contract logs or HCS topic messages and resumes from a durable
      consensus-timestamp cursor.
- [x] Require independent Mirror Node verification before enqueueing an event
      for projection; never infer payment validity from the destination EVM
      event or Subgraph entity.
- [x] Persist the verified source event, projection attempt, destination
      transaction, retry state, and terminal failure before broadcasting
      progress.
- [x] Implement a minimal destination EVM contract that rejects duplicate
      source-event IDs and emits `HederaEventAnchored` without storing prompts,
      credentials, personal data, or raw provider results.
- [x] Bind the destination contract to an allowlisted relayer or an explicit
      M-of-N signer policy and document that this is a relay trust boundary, not
      native cross-chain Hedera consensus verification.
- [x] Submit destination transactions with bounded retries, fee limits, and one
      idempotent state machine; a timeout or ambiguous receipt must reconcile
      the original transaction rather than submit a new logical anchor.
- [x] Deploy the projection contract to local Ganache and record its chain ID,
      address, deployment transaction, start block, source verification, and
      relayer address.
- [x] Implement and deploy a Subgraph for `HederaEventAnchored`, retaining the
      Hedera source identity and destination transaction provenance as
      separate fields.
- [x] Add an idempotent projection and Graph-ingestion worker that correlates the
      durable, credited Hedera deposit with its destination anchor and indexed
      entity.
- [x] Add projection reconciliation for credited Hedera events missing
      destination anchors, destination anchors missing durable relay records,
      and Subgraph entities lagging their finalized destination transactions.
- [x] Keep application credit and provider execution gated only by authoritative
      Hedera Mirror verification and atomic Postgres proof consumption; EVM
      projection and Graph indexing may change monitoring completeness but must
      not create, duplicate, reverse, or delay spendable funds.
- [x] Show separate Hedera source, EVM projection, and Graph indexing states in
      the UI, with links to both chain explorers and an explicit relayer-trust
      label.
- [x] Test duplicate Mirror responses, cursor restart, event reordering,
      relayer crash recovery, destination replay, nonce races, EVM reorg,
      Subgraph lag, malformed payloads, and mismatched Hedera source identity.
- [ ] Prove one live testnet flow from Hedera event through Mirror verification,
      durable relay record, EVM anchor, and Graph entity; demonstrate that
      replaying the same source event does not create a second anchor.
- [x] Document production key custody, relayer monitoring, destination gas
      funding, cursor backup, contract pause/rotation, and recovery procedures.

Exit criterion: one independently Mirror-verified and durably credited Hedera
event is projected exactly once to local Ganache and indexed by the local Graph
Node, while the receipt and UI clearly preserve Hedera and Postgres as the
authoritative payment and balance records and identify the destination event as
a relayer-mediated monitoring projection.

### Supabase Realtime application activity

Supabase/Postgres is the authoritative source for application balances and
ledger history. Hedera Mirror Node verification is the only payment-proof
authority. The Ganache relay and Graph Subgraph remain asynchronous,
privacy-safe audit evidence and must never gate, create, duplicate, reverse, or
delay application credit.

- [x] Define a user-scoped, exact-integer fund activity read model derived from
      the durable credit ledger, deposits, reservations, charges, refunds, and
      reconciliation records.
- [x] Add authenticated RLS policies and grants that expose only the signed-in
      user's rows through the Supabase publishable key; never expose the
      service-role key or another user's pseudonym, balance, or history.
- [x] Add the required user-owned tables to the Supabase Realtime publication
      through a tracked, idempotent migration.
- [x] Load an authoritative initial fund snapshot after restoring the Supabase
      browser session, then subscribe to user-scoped Postgres changes and
      refresh from the authoritative read model after each notification.
- [x] Handle token refresh, reconnect, duplicate notifications, visibility
      changes, sign-out, and component teardown without leaking channels or
      applying stale user data.
- [x] Replace the direct-Hedera Graph economic-events dependency in the fund UI
      with Supabase-backed application activity. Show Ganache/Graph projection
      state separately with explicit relayer-mediated and indexing-lag labels.
- [x] Remove the browser GET link to the POST-only GraphQL endpoint. Link only
      verifiable Hedera evidence to HashScan; present local Ganache block
      numbers as non-clickable monitoring metadata.
- [x] Add database, RLS, client lifecycle, exact-arithmetic, empty, reconnect,
      malformed-response, and unavailable-service tests.
- [x] Deploy the migration and application, then verify one authenticated
      credited deposit appears after refresh and through Realtime without
      depending on Graph availability.

Production evidence (26 July 2026): the guarded reconciler Mirror-verified and
atomically credited three previously submitted WalletConnect deposits with no
pending or rejected proofs. The authenticated browser refreshed
`get_my_fund_activity`, one private credit account reported a positive balance,
and the public Realtime WebSocket completed an authenticated upgrade. The
separately queried Graph projection remained healthy at indexed block 2.
The browser verification path now retries the same Mirror-pending proof for a
bounded 30-second window, without resubmitting payment, so a normal indexing
delay does not require a manual page refresh.

Exit criterion: an authenticated user sees only their authoritative Supabase
fund balance and history immediately after session restoration and receives
Realtime refreshes after durable ledger commits. Graph lag or outage changes
only the separately labeled public audit status.

## Phase 6C — reusable Graph payment-evidence MCP

- [ ] Define a reusable MCP server, independent of the AgentRouter UI, for
      querying agent-payment and settlement evidence indexed by The Graph.
- [ ] Expose a small, stable tool surface such as `find_payment`,
      `list_agent_transactions`, and `verify_receipt_history`, with
      schema-validated inputs and outputs.
- [ ] Query a deployed Subgraph containing live blockchain data; fixtures may
      support tests and offline demos but must never be presented as qualifying
      live evidence.
- [ ] Return Graph endpoint and indexing provenance, chain identity, block and
      transaction references, and explicit completeness or lag state with every
      result.
- [ ] Keep Hedera Mirror verification and Postgres proof consumption
      authoritative; MCP and Subgraph responses are discovery and monitoring
      evidence and cannot unlock credit or execution.
- [ ] Support an MCP transport usable from external AI environments and publish
      one-click or minimal client configurations for Claude, Cursor, ChatGPT,
      and a generic MCP client where each environment permits it.
- [ ] Add a server-side web adapter that invokes the same MCP tools over their
      supported transport rather than duplicating query or verification logic.
- [ ] Add a simple UI demo in which a user enters a transaction ID, account, or
      receipt reference, selects an MCP tool, submits one request, and sees the
      structured tool call, live Graph result, provenance links, and indexing
      status.
- [ ] Ensure the browser receives no Graph API key, database credential,
      Hedera key, facilitator secret, or unrestricted internal endpoint.
- [ ] Add contract, transport, live-integration, malformed-input, Graph-lag,
      unavailable-endpoint, and secret-boundary tests.
- [ ] Open-source the MCP implementation with a clear README, tool schemas,
      installation instructions, example prompts, client configuration, and a
      two-to-four-minute demo runbook.
- [ ] Treat x402 as an optional adapter for paid Graph or MCP requests; if
      implemented, use the actual x402 protocol and do not describe the existing
      custom Hedera `402` challenge as x402-compatible.

Exit criterion: an external MCP client and the AgentRouter UI invoke the same
documented payment-evidence tool against live Subgraph data and receive
schema-valid, provenance-rich results. Another project can install and use the
MCP without importing the AgentRouter application, while payment authority
remains with Hedera Mirror verification and atomic Postgres proof consumption.

## Phase 6D — balance-backed LLM instance jobs

The existing Scaleway integration is a server-side planner and the existing 0G
adapter proves live private inference. This phase turns both providers into
user-visible LLM job instances funded from authoritative application credit.
Provider API keys remain server-only and are never stored in the instance
catalog, job payload, browser session, result, receipt, or logs.

- [x] Define durable LLM job, attempt, usage, reservation, charge, refund,
      result, and provider-evidence schemas with stable lifecycle and failure
      codes.
- [x] Add an authenticated server API that accepts an instance ID, prompt,
      capability, maximum input and output tokens, idempotency key, and
      application-credit spend ceiling without accepting a provider API key.
- [x] Resolve enabled instance metadata from the authoritative catalog and map
      the selected provider to its server-only credential:
      `SCALEWAY_GENAI_API_KEY` for Scaleway or `G_API_KEY_PRIVATE` for 0G.
- [x] Reject unknown, disabled, capability-incompatible, privacy-incompatible,
      stale-priced, or uncredentialed instances before reserving or executing.
- [ ] Estimate the maximum exact charge from the selected price snapshot and
      token limits, then atomically reserve sufficient user credit before the
      provider request.
- [ ] Implement Scaleway workload execution separately from the Scaleway
      planner, using its OpenAI-compatible chat-completions API with a bounded
      timeout, explicit token limit, typed response validation, and stable
      provider evidence.
- [ ] Connect the existing 0G Compute adapter to the durable job flow while
      retaining the pinned provider address, private trust mode, disabled
      fallbacks, bounded retries, timeout, and idempotency key.
- [ ] Capture provider-reported prompt, completion, and total token usage;
      preserve integer token counts and exact-decimal price snapshots and never
      calculate charges with binary floating point.
- [ ] Validate the returned result before delivery: require the expected
      provider/model identity, non-empty schema-valid output, usage within the
      requested limits, and provider-specific execution evidence.
- [ ] Label 0G Router private trust-mode and TeeML catalog evidence precisely;
      do not describe it as an independently verified TEE attestation unless an
      independent attestation verifier is implemented.
- [ ] Atomically convert the reservation into one actual charge, release unused
      credit, and persist the output, usage, price snapshot, selected instance,
      execution identifier, and redacted evidence. Ambiguous usage or charge
      evidence must enter reconciliation instead of guessing or charging twice.
- [ ] Keep prompts and raw outputs out of public receipts, 0G Storage, chain
      events, Graph entities, analytics, and logs; expose them only through
      authenticated user-scoped storage and APIs.
- [ ] Add an LLM job UI that lets a signed-in user choose Scaleway or 0G, enter
      a prompt and token/spend limits, review privacy and maximum charge, run
      the job, and see output, actual token usage, exact spend, refund, remaining
      balance, instance identity, and appropriately labeled evidence.
- [ ] Stream persisted job states over SSE or Supabase Realtime and restore the
      authoritative state after refresh without repeating inference or
      charging again.
- [x] Extend the existing `examples/0g-agent.ts` composition into a standalone
      local LLM-job demo runner that can select either the Scaleway or 0G
      instance through one documented command and shared job contract.
- [x] Give the local runner a deterministic offline mode with fixture adapters
      for CI and rehearsal, plus an explicitly guarded live mode that requires
      the matching server-only provider credential and warns before consuming
      real provider or network resources.
- [x] Print a concise, redacted demo result containing the selected instance,
      model, lifecycle states, provider-reported integer token usage, exact
      reserved/charged/refunded amounts, execution identifier, and verification
      label without printing credentials, private prompts, or raw public
      receipts.
- [x] Add package scripts and a short runbook for the offline demonstration,
      live Scaleway execution, live 0G Compute-only execution, and the optional
      complete 0G Compute/Storage/Chain path. Clearly identify which commands
      spend provider tokens or native 0G.
- [ ] Test both provider adapters and the complete job state machine, including
      duplicate submissions, insufficient credit, concurrent reservations,
      provider authentication failure, timeout, invalid output, missing or
      excessive usage, ambiguous completion, disabled instances, secret
      leakage, retry recovery, exact charge, and unused-reservation refund.
- [ ] Prove one deployed Scaleway job and one deployed 0G job from the same UI,
      each consuming real provider tokens and exactly one application-credit
      charge, with redacted receipts and no provider credential visible in the
      browser or client bundle.

Exit criterion: a signed-in user with credited funds can run one working
Scaleway instance job and one working 0G private instance job. Each job reserves
its maximum spend, executes once with a server-held provider key, validates and
delivers the result, settles exact provider-reported token usage once, refunds
unused credit, survives refresh, and exposes no secret or misleading
verification claim.

## Phase 7 — product experience

- [x] Build task, budget, and privacy-policy input.
- [x] Show discovered providers and normalized quotes.
- [x] Show exclusions and concise selection evidence.
- [x] Stream the persisted workflow timeline over SSE.
- [x] Display “payment confirmed; verifying public record” during mirror lag.
- [x] Restore the timeline after refresh or reconnect.
- [x] Render delivery, total spend, remaining budget, and receipt.
- [x] Link Hedera evidence to HashScan.
- [x] Make loading, empty, retryable, and terminal failure states explicit.

Exit criterion: a new observer can understand the request, alternatives,
policy, economic decision, payment, and result without narration.

## Phase 8 — failure and security hardening

- [x] Test insufficient delegated and on-chain balance.
- [x] Test expired quote and payment challenge.
- [x] Test mismatched amount, recipient, memo, network, and asset.
- [x] Test duplicate proof and repeated HTTP retry.
- [x] Test mirror indexing delay and timeout.
- [x] Test provider and model timeout.
- [x] Test invalid delivery and discovery outage.
- [x] Verify secrets are absent from client bundles, logs, fixtures, and errors.
- [x] Verify row-level security from anonymous and authenticated clients.

Exit criterion: every known failure ends in a stable recoverable or terminal
state without duplicate payment or secret exposure.

## Phase 9 — deployment and demo

- [ ] Configure encrypted server runtime variables.
- [x] Deploy early and smoke-test the production health endpoint.
- [ ] Complete one deployed end-to-end testnet commerce run.
- [ ] Seed deterministic backup providers and a completed receipt.
- [ ] Capture decision, payment, mirror, execution, and completion timestamps.
- [x] Add setup, architecture, payment-flow, and sponsor-integration
      documentation.
- [x] Record the selected tracks and qualification requirements in
      `docs/PRIZE_STRATEGY.md`.
- [ ] Complete every applicable gate in the prize strategy's final go/no-go
      checklist.
- [ ] Recheck current event rules and all three official sponsor requirements
      immediately before submission.
- [x] Verify public repository access and third-party attribution.
- [ ] Test screen recording, microphone, readable font size, and backup capture.
- [ ] Record a demo within the event time limit.
- [x] Add the final project name and infrastructure-focused short description.
- [ ] Add all 0G contract addresses, deployment transactions, and explorer
      links.
- [ ] Publish the repository and verify README setup from a clean clone.
- [ ] Link a live demo and demo video under three minutes.
- [x] Explain each 0G feature and SDK actually used.
- [ ] Include team names and required Telegram and X contacts in the submission
      form; keep personal contacts out of Git unless approved.
- [x] Link the working example-agent source prominently from the README.
- [x] Export a submission-ready architecture diagram covering 0G Compute,
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
