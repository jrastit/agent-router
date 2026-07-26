# AgentRouter 2–3 minute presentation speech

Use this script with the web presentation at `/presentation`. It is written for
about **2 minutes 45 seconds** at a clear speaking pace. Advance on each numbered
heading and keep the product demonstration separate unless extra time is
available.

## 1. AgentRouter — 0:00–0:15

Hi, we built AgentRouter: the economic control plane for autonomous AI. It lets
an agent choose the best eligible service, pay an exact amount, and leave proof
of what happened—without giving the agent an unlimited billing credential.

## 2. The missing machine economy — 0:15–0:35

Agents can call APIs, but they cannot safely shop. Models, prices, and
availability change constantly. The cheapest option may fail privacy or quality
requirements, API keys allow open-ended billing, and screenshots are not
independently verifiable evidence.

## 3. Route before spending — 0:35–0:58

AgentRouter compares the live model catalog before every spend. It calculates
cost from exact decimal prices, filters routes by budget, privacy, capability,
and readiness, then selects the lowest-cost eligible option. It preserves both
the winning route and the rejected alternatives as decision evidence.

## 4. Why blockchain payment — 0:58–1:18

Autonomous software needs enforceable value boundaries. AgentRouter binds an
accepted quote to one exact integer payment. Finality is verified before
execution unlocks, and idempotency prevents a retry from becoming a duplicate
transfer. Prompts and outputs stay off-chain; blockchain settles value and
anchors non-sensitive proof.

## 5. Hedera — 1:18–1:38

On Hedera, the challenge binds the payer, treasury, network, exact tinybar
amount, memo, and expiry. The server checks the finalized transaction through
Mirror Node and consumes its proof once. HashScan and the HCS reference provide
public evidence, while Supabase remains the authoritative application ledger.

## 6. 0G — 1:38–1:55

0G extends the route with decentralized AI infrastructure: Compute supplies
comparable model routes, Storage holds redacted evidence, and 0G Chain anchors
the canonical receipt hash. If a required private route is unavailable, the
job fails closed.

## 7. The Graph — 1:55–2:12

The Graph turns non-sensitive, Mirror-verified events into queryable public
evidence. Reviewers and other agents can discover the indexed record through
GraphQL. Hedera verifies the payment; The Graph indexes the proof and never
creates spendable credit.

## 8. Technical stack — 2:12–2:28

The experience is built with Next.js and React. A TypeScript control plane,
MCP, durable events, and Supabase coordinate policy and workflow. Hedera, 0G,
and The Graph provide settlement and public provenance. All provider, chain,
and database secrets stay server-side.

## 9. Close — 2:28–2:45

The complete loop is: discover, compare, select, pay, verify, deliver, and
record. AgentRouter lets an autonomous agent choose the best eligible service,
spend within policy, and prove the result—without trusting one provider or
giving the agent an unlimited card.

## Presenter reminders

- Aim for 2:45; pause briefly after the opening and before the final sentence.
- Say **catalog-readiness evidence**, not independent model benchmark.
- Call an integration **live** only when the current run shows a verifiable
  identifier; otherwise label it as a fixture or prior verified run.
- Hedera and Mirror establish payment truth.
- Supabase/Postgres owns application balance and durable workflow state.
- The Graph is a monitoring and discovery projection, not payment authority.
- Never show private keys, environment variables, private prompts, credentials,
  or direct database access.
- Never resend a payment because Mirror, a provider, or an indexer is delayed.

## Emergency two-minute cut

Skip slides 6 and 8. On slide 7, say only:

> The Graph makes non-sensitive, Mirror-verified evidence queryable for other
> agents, while Hedera remains the payment authority.

Then move directly to the closing slide.
