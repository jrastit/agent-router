# Final presentation slide plan

## Goal

Explain the user-funded HBAR loop in under three minutes without confusing the
three trust planes:

1. Hedera and Mirror prove the payment.
2. Supabase/Postgres owns the spendable application balance and Realtime UI.
3. The Graph exposes an asynchronous, privacy-safe public audit projection.

Use three slides. Combining all three planes on one slide makes it too easy to
imply that Realtime or The Graph validates the payment.

## Slide 1 — From wallet deposit to live application balance

### Title

**One HBAR transfer becomes durable, live application credit**

### On-slide message

```text
External wallet
  → Hedera Testnet
  → Mirror-verified transaction
  → atomic Supabase/Postgres credit
  → user-scoped Realtime refresh
```

- The wallet signs one native HBAR transfer.
- The browser sends only the Hedera transaction ID.
- The server verifies the exact bound intent through Mirror Node.
- One database transaction consumes the proof, credits exact tinybars, and
  appends the journal.
- Supabase Realtime invalidates the user's view; the browser reloads the
  authoritative balance.

### Visual

Use a horizontal five-step flow. Give each trust boundary a distinct color:

- Hedera/Wallet: purple
- Mirror validation: amber
- Supabase authority: green
- Realtime/UI: cyan

Put a lock icon over the server boundary with the caption:
**No private key or service-role key reaches the browser.**

### Speaker notes

> Realtime does not calculate or authorize the balance. It only tells the
> browser that durable state changed. The browser then reloads the
> user-scoped authoritative snapshot.

Explain the two visible temporary states:

```text
0.005 HBAR                         spendable and Mirror-verified
(0.001 HBAR Mirror pending)        submitted, not spendable
```

Zero-valued pending states are hidden automatically.

### Live-demo cue

1. Create a small deposit intent.
2. Show the exact payer, treasury, amount, memo, network, and expiry.
3. Approve in the external wallet.
4. Show `Mirror pending` briefly if indexing has not completed.
5. Show the balance update without manually refreshing.
6. Open the validated HashScan link.

## Slide 2 — What makes a deposit proof valid?

### Title

**A transaction ID is evidence—not proof by itself**

### On-slide message

Mirror verification must match:

| Bound field     | Required evidence                      |
| --------------- | -------------------------------------- |
| Finality        | Finalized Hedera transaction           |
| Result and type | `SUCCESS` + `CRYPTOTRANSFER`           |
| Participants    | Exact payer and treasury               |
| Value           | Exact integer tinybar recipient credit |
| Intent          | Exact unique memo                      |
| Time            | Consensus no later than expiry         |
| Replay          | Transaction proof consumed once        |

After validation, one atomic database operation:

```text
lock deposit
  → consume unique proof
  → credit exact tinybars
  → append immutable journal
  → enqueue public monitoring record
```

### Visual

Place a shield around the Mirror checklist and a database transaction box
around the atomic operations. Connect them with a single arrow labelled
**all checks pass**. Add a red failure branch labelled **fail closed**.

### Speaker notes

> Retrying Mirror verification never sends another payment. Unique proof and
> journal constraints prevent duplicate credit. HashScan is public transaction
> evidence, while exact Mirror matching plus atomic proof consumption is the
> authoritative application validation.

Mention the failure behavior:

- missing or delayed Mirror record → pending, retry read-only verification;
- mismatch or expired proof → reject;
- repeated proof → return existing result or reject replay;
- ambiguous projection state → never change or repeat application credit.

## Slide 3 — From credited deposit to The Graph

### Title

**Public auditability without putting private balances on-chain**

### On-slide message

```text
credited Supabase deposit
  → durable privacy-safe outbox
  → PM2 allowlisted relay
  → Ganache EVM anchor
  → Graph-indexed entity
```

The public anchor contains:

- stable source-event ID;
- digest of the Hedera transaction identity;
- Hedera consensus timestamp;
- non-secret payload digest;
- destination transaction and block; and
- contract and relayer provenance.

It excludes:

- user identity and email;
- wallet private data;
- balance and private journal;
- credentials, prompts, and provider results.

### Visual

Show Supabase as the authoritative solid path and Graph as a dashed monitoring
branch:

```text
Mirror → Supabase credit ───────────────→ spendable balance
                    ╲
                     ╲ monitoring only
                      → relay → EVM → The Graph
```

Add the label:
**Graph lag cannot block, create, duplicate, or reverse credit.**

### Speaker notes

> The worker reuses one deterministic source-event ID. The contract rejects
> replay, and Supabase is marked indexed only after the matching Graph entity
> appears. If Graph is unavailable, the user can still spend the already
> verified Supabase balance.

Explain the UI values:

```text
(0.001 HBAR Graph pending)   credited, public monitoring still catching up
(0.005 HBAR Graph indexed)   correlated Supabase → EVM → Graph evidence
```

### Live-demo cue

1. Show the balance as already spendable.
2. Show `Graph pending` during relay/indexing if visible.
3. Wait for the automatic Realtime update to `Graph indexed`.
4. Open **Latest Graph activity**.
5. Point to the indexed block, source-event ID, Hedera consensus timestamp,
   and destination transaction.
6. State explicitly that chain ID `1337` is the local Ganache monitoring chain.

## Optional transition slide — Why three planes?

Use only if presentation time allows.

| Plane               | Responsibility                             | Authority         |
| ------------------- | ------------------------------------------ | ----------------- |
| Hedera + Mirror     | Settlement and finalized payment proof     | Payment truth     |
| Supabase/Postgres   | Balance, journal, workflow state, Realtime | Application truth |
| Ganache + The Graph | Queryable privacy-safe audit projection    | Monitoring only   |

One-line narration:

> Settlement, application state, and public monitoring are deliberately
> separated so an outage in one non-authoritative plane cannot corrupt money.

## Final slide-production checklist

- [ ] Capture a clean screenshot of the exact deposit review.
- [ ] Capture `Mirror pending` only if it appears naturally; do not fake it.
- [ ] Capture the validated confirmation and HashScan link.
- [ ] Capture the authoritative balance and account history.
- [ ] Capture `Graph indexed` after the relay completes.
- [ ] Capture the live Graph panel with an indexed native-transfer anchor.
- [ ] Redact email, wallet account, transaction IDs not intended for the demo,
      and all terminal environment output.
- [ ] Keep each technical slide to one diagram and no more than six bullets.
- [ ] Rehearse the three authority statements verbatim.
- [ ] Verify `/api/health`, Realtime, PM2 worker, Graph health, and queue depth
      immediately before recording.

## Claims to make

- A real external wallet signs the HBAR transfer.
- Hedera Mirror independently verifies the exact bound intent.
- Supabase consumes the proof and credits integer tinybars exactly once.
- Realtime updates the authenticated view from durable state.
- A persistent worker correlates the credited deposit with an EVM anchor and
  Graph entity.
- Graph is privacy-safe monitoring evidence, not payment or balance authority.

## Claims to avoid

- Do not call Realtime a payment verifier.
- Do not claim Graph creates or validates spendable credit.
- Do not describe Ganache chain `1337` as Hedera or a public production EVM.
- Do not claim a direct HBAR-to-0G conversion.
- Do not expose or mention real secret values.
- Do not relabel the historical HCS anchor as a user deposit.
