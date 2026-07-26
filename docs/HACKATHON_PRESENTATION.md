# AgentRouter hackathon presentation

This is the canonical 4–5 minute presentation narrative. The web deck mirrors
this order so the spoken pitch, live product, and public evidence tell one
coherent story.

## Presentation goal

Prove one idea:

> Autonomous agents need a router that can compare services, enforce a budget,
> pay exactly once, and leave a public proof.

The presentation should take about **4 minutes 30 seconds**. Use the live
application for the routing decision and evidence, not a terminal. Never show
environment variables, private prompts, private keys, or database credentials.

## Slide sequence and timing

### 1. AgentRouter — 0:00–0:25

**Headline:** The economic control plane for autonomous AI.

An agent should not be locked to one model or trusted with an unbounded payment
method. AgentRouter turns one objective and one budget into a policy-constrained
service decision, an exact payment, a delivered result, and a durable receipt.

### 2. The missing machine economy — 0:25–0:55

**Problem:** Agents can call APIs, but they cannot safely shop.

- Model catalogs change faster than application code.
- The cheapest offer is useless if it violates privacy or quality policy.
- API billing is normally an after-the-fact claim, not a quote-bound payment.
- A screenshot is not independently verifiable evidence of what happened.

The result is either vendor lock-in or an agent with too much spending
authority.

### 3. The router optimizes every decision — 0:55–1:25

**Value:** Compare the market before spending.

AgentRouter loads the live Supabase model catalog, estimates input and output
cost from exact decimal prices, filters by budget, privacy, capability, and
readiness score, then ranks eligible routes by increasing price. The selected
instance and rejected alternatives remain visible as decision evidence.

During the demo, change the budget, token volumes, or minimum score and show
that the eligible set and selection change without application-code changes.
Describe the score as **catalog-readiness evidence, not an independent model
benchmark**.

### 4. Why agentic AI needs blockchain payment — 1:25–2:00

**Argument:** Autonomous software needs enforceable value boundaries.

- Exact integer amounts and quote-bound memos let a machine pay a specific
  obligation instead of granting open-ended billing access.
- Network finality and mirror verification let the router distinguish
  submission from a finalized, matching payment.
- Idempotency and unique proof consumption prevent retries from becoming
  duplicate transfers.
- Public transaction and consensus references give users and other agents a
  portable receipt.

Blockchain is not used for prompts, model output, or workflow state. Hedera
settles value and anchors non-sensitive audit evidence; Postgres remains the
authoritative application ledger.

### 5. Hedera — autonomous settlement — 2:00–2:25

**Sponsor use:** AI & Agentic Payments on Hedera.

AgentRouter binds a challenge to the accepted quote, payer, recipient, network,
asset, exact tinybar amount, memo, and expiry. The server submits one HBAR
transfer, waits for consensus, verifies the finalized transaction through the
Mirror Node, rejects replay, and exposes HashScan evidence. A compact,
non-sensitive HCS anchor connects the public audit trail to the receipt.

Demo evidence: the HashScan transaction, mirror-verified fields, and HCS topic
reference.

### 6. 0G — decentralized AI execution and provenance — 2:25–2:50

**Sponsor use:** Infrastructure & Tooling on 0G.

- **0G Compute** supplies comparable model routes through the public toolkit.
- **0G Storage** stores redacted evidence and returns a content reference.
- **0G Chain** anchors the canonical receipt hash for tamper detection.

Confidential workloads fail closed when the required private route is
unavailable. Do not describe a mocked or fixture-backed route as live 0G
inference; show the explorer and storage references only when the current run
contains them.

### 7. The Graph — queryable public evidence — 2:50–3:15

**Sponsor use:** indexed audit discovery.

AgentRouter projects non-sensitive, Mirror-verified Hedera events to an EVM
anchor contract and indexes them with a Subgraph. The application queries the
GraphQL projection to show the latest consensus-linked public activity. Hedera
Mirror Node remains the payment authority; The Graph makes the evidence easy
for agents, reviewers, and dashboards to discover and compose.

Demo evidence: indexed block, destination transaction, Hedera consensus
timestamp, and record reference.

### 8. One complete technical stack — 3:15–3:45

**Browser:** Next.js, React, wallet connection, interactive decision replay.

**Control plane:** TypeScript toolkit, deterministic policy engine, MCP server,
durable state transitions, SSE and Supabase Realtime.

**Data and AI:** Supabase Postgres catalog and ledger, Vercel AI SDK compatible
providers, 0G Compute, 0G Storage.

**Settlement and proof:** Hedera SDK, HBAR, Mirror Node, HCS, 0G Chain,
Solidity anchor contracts, The Graph.

Security boundary: provider keys, Hedera keys, and Supabase secrets stay on the
server.

### 9. Live proof and close — 3:45–4:30

Run the shortest complete story:

1. Enter the task and adjust budget, token estimate, and minimum score.
2. Point out the cheapest eligible instance and one rejected alternative.
3. Start the job with the selected instance.
4. Show that the durable decision and payment references are bound together.
5. Open the latest Graph activity and copy its record reference.
6. Paste that reference into the MCP flow to show that another agent can
   consume the same evidence.
7. End on the public transaction/provenance links and bounded total spend.

Close with:

> AgentRouter lets an autonomous agent choose the best eligible service, spend
> within policy, and prove the result—without trusting one provider or giving
> the agent an unlimited card.

## Demo safety and fallback

- Use a pre-verified receipt if live indexing is delayed; label it as the
  verified backup run and keep its date visible.
- Never resubmit a payment because a mirror node, provider, or indexer is slow.
- If a sponsor integration is unavailable, show its explicit failure state and
  the last independently verifiable reference.
- Rehearse at 100% browser zoom and verify that prices, rejection reasons,
  transaction links, and record references are readable on the recording.

## Claim boundary

The deck describes the intended complete loop, but the presenter must only call
an integration “live” when the current run exposes its verifiable identifier.
Deterministic fixtures and prior verified runs are valid fallback evidence when
clearly labeled; they are not substitutes for sponsor qualification.
