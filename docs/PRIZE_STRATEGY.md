# ETHGlobal Lisbon 2026 prize strategy

This document maps AgentRouter to the official sponsor qualification
requirements. It is an implementation and submission checklist, not evidence
that unfinished integrations qualify. Recheck the linked prize pages before
submission because sponsors may update their requirements.

## Selected tracks

| Sponsor                                                               | Target track                    | Why AgentRouter fits                                                                        |
| --------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------- |
| [0G](https://ethglobal.com/events/lisbon2026/prizes/0g)               | Best AI Product on 0G           | The user-facing product routes confidential inference through 0G Compute / Private Computer |
| [Hedera](https://ethglobal.com/events/lisbon2026/prizes/hedera)       | AI & Agentic Payments on Hedera | An agent discovers services, selects an offer under policy, and pays for it in HBAR         |
| [The Graph](https://ethglobal.com/events/lisbon2026/prizes/the-graph) | Best AI Use Case of The Graph   | The agent uses a live indexed provider registry on a supported EVM chain to select services |

Do not submit AgentRouter to 0G's Infrastructure track unless the shipped
artifact becomes reusable developer tooling rather than an end-user product.
Do not claim The Graph's composable-data track unless the implementation
actually composes two Graph products or meaningfully uses a standardized
schema. Continuity-only prizes are out of scope unless ETHGlobal confirms that
the team is enrolled in the relevant Continuity track.

## One coherent demo

The strongest submission is one complete, observable commerce loop:

1. A user enters a task, an exact spending limit, and a confidentiality policy.
2. AgentRouter queries a live Subgraph of the Base Sepolia provider registry
   for at least two offers and displays the registry, endpoint, query time,
   block, and deployment identifiers.
3. The agent reasons over the live results while the deterministic policy
   engine rejects ineligible or over-budget offers.
4. A confidential task causes the selected workload to run through 0G Compute
   / Private Computer, with verifiable proof visible in the receipt or evidence
   panel.
5. AgentRouter receives and validates a quote-bound payment challenge.
6. The server submits exactly one HBAR payment on Hedera Testnet.
7. The UI distinguishes submission, consensus, and mirror verification, then
   links the verified transaction on HashScan.
8. The server publishes a non-sensitive decision or receipt anchor through HCS.
9. The user receives the result, selection evidence, total spend, and durable
   receipt.

The demo must use live sponsor integrations. Deterministic fixtures are useful
for tests and fallback explanation, but do not satisfy The Graph's live-data
qualification or 0G's working-compute requirement.

## 0G qualification

### Required implementation

- Run actual inference through 0G Compute / Private Computer; a logo, SDK
  import, mocked response, or storage-only integration is insufficient.
- Preserve proof that the inference used 0G. Record only non-sensitive
  identifiers, attestation or verification evidence, model information, and
  relevant explorer links supported by the chosen service.
- Make privacy routing product-visible: the same task marked public and
  confidential must produce different eligibility and execution behavior.
- Fail closed if 0G is required but unavailable. Never silently route
  confidential input to a non-private provider.
- Document the exact 0G SDK, service, network, endpoints, and guarantees used.
  Avoid privacy or verifiability claims that the implementation cannot prove.
- Keep all credentials server-side and exclude prompts and private artifacts
  from logs, HCS payloads, and public receipts.
- Provide a deployed product or reproducible runnable build.

### Required submission material

- Project name and short description.
- Public GitHub repository with README and complete setup instructions.
- Live demo link and a demo video under three minutes.
- Contract deployment addresses, or an explicit “not applicable” explanation
  if the selected integration deploys no contract and the form permits it.
- A concise explanation of the 0G features and SDKs used.
- Team member names plus Telegram and X contact details in the submission form.
- Proof in the demo and README that inference runs through 0G Compute / Private
  Computer.
- If Agentic ID is added, a link to the minted ID on the 0G explorer.

### Acceptance evidence

- A successful live 0G request captured in the application timeline.
- A redacted receipt containing the 0G execution/proof identifiers.
- A negative test proving confidential workloads do not fall back insecurely.
- A README section that lets a reviewer reproduce the 0G path.

## Hedera qualification

### Required implementation

- Build the autonomous payment with the Hedera JavaScript/TypeScript SDK,
  Hedera Agent Kit, x402, or another explicitly permitted agentic tool.
- Execute at least one real HBAR payment, token transfer, or financial operation
  on Hedera Testnet.
- Bind each payment challenge to the accepted quote, payer, recipient, network,
  asset, exact amount, memo, and expiry.
- Reserve the budget before submission and use an idempotency key so retries
  cannot create a second payment.
- Verify the finalized transaction through the mirror node before unlocking
  delivery. Reject mismatches, failures, expired challenges, and replayed
  proofs.
- Show the transaction ID and HashScan link in the UI and durable receipt.
- Publish a compact non-sensitive audit anchor to HCS. This is an optional
  prize enhancement but part of AgentRouter's intended audit design.

### Required submission material

- Public GitHub repository.
- README sections for setup, architecture, and the complete payment flow.
- A demo video no longer than five minutes showing the agent autonomously
  performing the Hedera payment.
- Testnet transaction and, when implemented, HCS topic/message evidence that a
  reviewer can inspect.
- Clear identification of the Hedera SDK or permitted agentic protocol used.

### Acceptance evidence

- One live end-to-end run with an inspectable Testnet transaction.
- Mirror-node verification of payer, recipient, amount, memo, status, and
  timestamp.
- A duplicate-proof test and an idempotent retry test.
- A visible HCS audit record linked to the same decision or receipt.
- No Hedera private key or direct database credential in the browser bundle,
  logs, repository, video, or screenshots.

The implementation may also be eligible for Hedera's “No Solidity Allowed”
track only if it uses the Hedera SDK without Solidity and incorporates at least
two native services. The planned HBAR transfer plus HCS and mirror-node
verification may satisfy that technical shape, but the team must confirm
whether entering multiple Hedera tracks is permitted and must meet that track's
separate demo and documentation requirements.

## The Graph qualification

### Required implementation

- Use The Graph as a load-bearing source of live blockchain data. Static JSON,
  local fixtures, or a decorative query do not qualify.
- Deploy a minimal provider registry on a Graph-supported EVM testnet,
  initially Base Sepolia, and query its live Subgraph through the discovery
  adapter.
- Ensure the returned blockchain data materially affects agent reasoning or
  action. Live provider capability, execution network, price, privacy support,
  active state, and Hedera settlement identity must change eligibility,
  ranking, or selection.
- Display and persist discovery provenance: product used, subgraph or stream
  identifier, network, endpoint label, block or cursor when available, and
  query timestamp.
- Handle empty, stale, malformed, and unavailable live results without
  presenting fixtures as live data.
- Document exactly which Graph products, subgraphs, endpoints, and queries are
  used.
- State explicitly that The Graph indexes only the supported-chain registry.
  It does not index Hedera payments, HCS events, 0G executions, prompts, or
  results. Mirror Node and the 0G integration supply that evidence separately.

### Required submission material

- Public repository built during the event.
- A two-to-four-minute demo video.
- A concise explanation of which Graph data source and tools are used and why
  they are load-bearing.
- A demo that proves live data reaches the AI/agent component and affects a
  decision instead of merely rendering raw query output.

### Acceptance evidence

- A recorded live query with source and block/cursor provenance.
- At least two comparable provider records derived from live indexed data.
- A test or demo in which changing live indexed state changes the selected
  provider or makes an offer ineligible.
- An outage or stale-data path that fails explicitly and does not mislabel
  fixtures.

## Public repository readiness

Before submission, the repository must contain:

- an accurate project description and status;
- setup prerequisites and one clean-clone command sequence;
- `.env.example` with names and safe defaults only;
- the canonical validation and production-build commands;
- an architecture diagram and component boundaries;
- the discovery, policy, 0G execution, and Hedera payment flows;
- exact sponsor SDKs, networks, endpoints, and deployed identifiers;
- contract addresses, subgraph/deployment identifiers, HCS topic, Testnet
  transaction, HashScan, and 0G proof/explorer links as applicable;
- test instructions and documented failure behavior;
- a security section covering server-only secrets and redacted audit data;
- third-party attribution and disclosure of any starter or pre-existing work;
- the deployed application URL and demo-video URL; and
- a dated summary of what was built during the hackathon.

Do not publish private keys, API tokens, database URLs, personal contact
details, raw confidential prompts, or unredacted private outputs. Put team
contact details in the ETHGlobal submission form unless the team explicitly
wants them public.

## Submission package

Prepare the following before opening the Hacker Dashboard:

- final project name and short description;
- public GitHub URL and immutable final commit hash;
- deployed live-demo URL plus a runnable local fallback;
- one master demo video between two and three minutes, satisfying the strictest
  selected track limit;
- optional sponsor-specific cuts only if the submission form supports them;
- architecture image suitable for the submission page;
- selected partner-prize explanations tailored to each sponsor;
- deployed contract and Graph identifiers, or truthful not-applicable notes;
- Hedera Testnet transaction and HCS evidence;
- 0G Compute / Private Computer proof;
- team names and required contact details; and
- disclosure of reused libraries, starter kits, validation work, and any
  pre-existing material.

The team must submit before the event deadline and select the intended partner
prizes in the ETHGlobal Hacker Dashboard. The official rules require transparent
disclosure of pre-existing work and chronological version-control history.

## Demo recording checklist

- Start with the user problem and the policy-controlled spending decision.
- Show live Graph provenance before showing the selected provider.
- Make the alternative providers and exclusion reasons readable.
- Show the 0G route and its proof for the confidential workload.
- Show one autonomous HBAR transfer, mirror verification, and HashScan receipt.
- Show the HCS audit evidence without exposing confidential data.
- End on the delivered result and the bounded spend.
- Keep secrets, terminals containing environment values, and personal
  notifications off screen.
- Record a clean backup take and verify its audio, resolution, links, and
  duration before submission.

## Final go/no-go checklist

AgentRouter is ready to submit for all three selected prizes only when every
item below is true:

- [ ] The public repository installs, validates, builds, and runs from its
      documented instructions.
- [ ] The deployed application completes the entire live commerce loop.
- [ ] Live Graph data is load-bearing and its provenance is visible.
- [ ] Real inference runs through 0G Compute / Private Computer with proof.
- [ ] A real autonomous Hedera Testnet payment is mirror-verified exactly once.
- [ ] HCS contains a non-sensitive audit anchor linked to the receipt.
- [ ] Failure and replay tests pass.
- [ ] No secrets or confidential payloads appear in public artifacts.
- [ ] The README identifies every sponsor technology and deployed identifier.
- [ ] The video satisfies the two-to-three-minute common duration.
- [ ] The submission contains all required URLs, evidence, team contacts, and
      pre-existing-work disclosures.
- [ ] The team rechecks the official prize pages and event rules immediately
      before submitting.
