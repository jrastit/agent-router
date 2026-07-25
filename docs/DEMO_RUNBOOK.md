# AgentRouter demo and submission runbook

## Submission identity

**Name:** AgentRouter

**Short description:** Policy-constrained routing infrastructure for agents
that compares 0G-hosted models, executes through 0G Compute, stores redacted
evidence in 0G Storage, and verifies canonical routing receipts on 0G Chain,
with optional Hedera settlement and Graph monitoring.

The reusable toolkit is the primary artifact. The Next.js application is the
example agent and visual proof surface.

## Reproducible setup

```sh
git clone https://github.com/jrastit/agent-router.git
cd agent-router
npm ci
cp .env.example .env.local
npm run validate
npm run dev
```

Credentials are optional for deterministic tests and the fixture-backed UI.
Live integrations require only the server-side variables documented in
`.env.example`. Never copy real credentials into screenshots, recordings,
fixtures, commits, or browser-visible variables.

Production deployment and health verification are documented in
[`PRODUCTION_DEPLOYMENT.md`](PRODUCTION_DEPLOYMENT.md).

## Architecture

```mermaid
flowchart LR
    user["User task, budget, privacy"] --> app["Example Next.js agent"]
    app --> toolkit["AgentRouter toolkit"]
    toolkit --> catalog["0G model catalog"]
    catalog --> policy["Deterministic policy router"]
    policy --> compute["0G Compute"]
    compute --> storage["0G Storage<br/>redacted evidence"]
    storage --> receipt["Canonical routing receipt"]
    receipt --> chain["0G Chain<br/>provenance anchor"]
    chain --> verify["Independent verification"]

    app --> postgres["Postgres durable state"]
    wallet["User Hedera wallet"] --> mirror["Hedera Mirror verification"]
    mirror --> postgres
    mirror -. "monitoring only" .-> relay["Allowlisted EVM relay"]
    relay -.-> graph["The Graph projection"]
```

Authority boundaries:

- deterministic policy, not model prose, decides eligibility and ranking;
- Postgres owns durable workflow and application-credit state;
- Hedera Mirror verification and atomic proof consumption own HBAR credit;
- 0G Chain verifies the canonical routing-receipt anchor; and
- EVM projection and The Graph are asynchronous monitoring evidence only.

## Implemented sponsor path

| Integration | Implemented role                                                                         | Evidence                                                       |
| ----------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 0G Compute  | Compare live routes and execute the selected confidential model                          | [`0G_COMPUTE_EVIDENCE.md`](0G_COMPUTE_EVIDENCE.md)             |
| 0G Storage  | Persist an allowlisted, non-secret execution-evidence document and recover it with proof | [`0G_PHASE5.md`](0G_PHASE5.md)                                 |
| 0G Chain    | Anchor and independently verify the canonical receipt hash                               | [`0G_PHASE5.md`](0G_PHASE5.md)                                 |
| Hedera      | HBAR settlement, Mirror verification, HCS audit anchors, and HashScan evidence           | [`HEDERA_TESTNET_EVIDENCE.md`](HEDERA_TESTNET_EVIDENCE.md)     |
| The Graph   | Index relayer-mediated, Mirror-verified Hedera monitoring events                         | [`PHASE6B_HEDERA_PROJECTION.md`](PHASE6B_HEDERA_PROJECTION.md) |

The working external example agent is
[`examples/0g-agent.ts`](../examples/0g-agent.ts). It imports only the public
toolkit API and performs catalog discovery, deterministic selection, Compute
execution, redacted Storage persistence, receipt creation, Chain anchoring,
and independent verification.

## Recorded live identifiers

The complete verified 0G evidence is retained in
[`0G_PHASE5.md`](0G_PHASE5.md), including:

- Aristotle mainnet chain ID `16661`;
- provenance contract `0xdAc715Cbfa81F60B0e05C0D9E8c96eC21948Cd93`;
- deployment transaction
  `0x7c6652ec7906b00a470082955eac2bf7055a7adc06cd75a396c33941a8c10caf`;
- selected Compute provider
  `0x4870CbC4D07d6Ac2EE5aA865588e5985FE77a4E9`;
- Storage root and transaction;
- canonical receipt hash; and
- receipt-anchor transaction and independent state verification.

Public services:

- application: `https://www.router.fexhu.com`;
- health: `https://www.router.fexhu.com/api/health`; and
- projection GraphQL:
  `https://graph.router.fexhu.com/subgraphs/name/agent-router/hedera-projection`.

## Demo sequence

Use the deterministic path for narration and the recorded live evidence for
network proof. Do not initiate a new value-bearing transaction during the
recording unless the full flow has already been rehearsed.

1. Open the deployed application and set task, budget, and privacy policy.
2. Show two comparable routes and change policy to alter eligibility.
3. Show deterministic exclusion and selection evidence.
4. Explain the recorded 0G Compute execution and private trust mode.
5. Open the redacted 0G Storage evidence and explain what is deliberately
   absent.
6. Show the canonical receipt hash, 0G Chain anchor, and independent
   verification.
7. Show Hedera payment/HCS evidence and identify Mirror plus Postgres as the
   payment authority.
8. Show the public Graph projection entity and its explicit monitoring-only
   trust label.
9. End with delivery, spend, remaining budget, and receipt.

## Known live-proof gap

Do not claim that the prepaid-credit Phase 6A/6B exit criterion is complete.
The production database migrations and external user-wallet deposit
orchestration are not deployed. The existing operator-funded Hedera settlement
must not be relabeled as a user-funded deposit. A qualifying proof still needs:

1. a bound deposit intent;
2. an external user-wallet signature;
3. Mirror verification and exactly-once Postgres credit;
4. one 0G operation charged against that credit; and
5. a durable projection record correlated with the EVM anchor and Graph entity.

## Pre-recording checklist

- Run `npm run validate` and retain the summary.
- Confirm PM2, `/api/health`, the public homepage, and Graph query endpoint.
- Open every evidence link in a clean browser profile.
- Use fixture providers as the deterministic backup path.
- Hide terminals containing `.env`, wallet, account, or notification data.
- Test screen resolution, readable font size, microphone, and system audio.
- Record one primary take and one backup take.
- Confirm the final duration against the current event rules.
- Recheck sponsor requirements immediately before submission.
