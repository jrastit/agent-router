# Agent Router repository instructions

## Purpose

This repository is the fresh hackathon submission. Preserve a clear,
chronological implementation history so reviewers can verify progress from the
initial scaffold to the final deployed product.

The technical validation lab is reference material only. Port small, reviewed
contracts or techniques when needed; do not copy the lab wholesale or import
its Git history.

## Git history is part of the deliverable

- Make one commit for every independently understandable and verifiable step.
- Keep each commit focused on one concern. Do not mix scaffolding, database
  schema, payment logic, UI, documentation, and cleanup in one commit.
- Before editing, inspect `git status`, recent commits, and the files relevant
  to the step.
- Before committing, review `git diff` and run the checks appropriate to that
  step.
- Commit only files belonging to the current step. Preserve unrelated user
  changes.
- Use imperative commit subjects with a conventional prefix:
  `chore:`, `docs:`, `feat:`, `fix:`, `test:`, or `refactor:`.
- Include the validation performed in the commit body when it is not obvious
  from the committed tests.
- Do not use placeholder commits, fake timestamps, squashed mega-commits, or
  retroactively manufacture progress.
- Do not amend, rebase, squash, force-push, or otherwise rewrite commits after
  they have been pushed unless the user explicitly requests it.
- Do not create a commit when checks fail. Report the failure and fix it in the
  same step before committing.
- Push only when requested or when the active task explicitly includes pushing.

## Step workflow

For every implementation step:

1. State the exact milestone and its acceptance criteria.
2. Inspect the current repository state.
3. Implement only that milestone.
4. Add or update tests and documentation that belong to it.
5. Run targeted checks, then the repository-wide validation command.
6. Review the final diff for secrets, generated files, and unrelated changes.
7. Create one descriptive commit.
8. Report the commit hash, checks run, and the next proposed milestone.

If a requested change contains multiple independently testable milestones,
split it into multiple commits in dependency order.

## Planned commit sequence

Use this as a default dependency order, adapting it when the actual scaffold
requires a different sequence:

1. `chore: initialize application scaffold`
2. `docs: record architecture and submission scope`
3. `feat: define commerce domain schemas`
4. `feat: add Supabase schema and security policies`
5. `feat: implement durable job state transitions`
6. `feat: add provider fixtures and quote comparison`
7. `feat: add policy-constrained agent selection`
8. `feat: implement payment challenge contract`
9. `feat: settle HBAR payment on Hedera testnet`
10. `feat: verify mirror proof and reject replay`
11. `feat: persist receipts and append audit events`
12. `feat: stream durable progress over SSE`
13. `feat: build objective budget and timeline UI`
14. `feat: add receipt and HashScan views`
15. `test: cover payment and provider failure modes`
16. `chore: configure deployment and health checks`
17. `docs: add setup architecture and demo runbook`

Do not create empty commits to match this list. Each commit must contain working,
reviewable progress.

## Product invariants

- The browser must never receive Hedera private keys, LLM API keys, Supabase
  secret keys, deployment tokens, or direct database credentials.
- Use Hedera for settlement and HCS audit anchors; use Postgres for durable
  workflow state.
- Store money as integer minor units, tinybars, or exact decimal strings—never
  binary floating-point amounts.
- Persist accepted quote, policy snapshot, decision evidence, and budget
  reservation atomically.
- Bind every payment challenge to its quote, payer, recipient, network, asset,
  exact amount, memo, and expiry.
- Verify the finalized mirror-node transaction before unlocking execution.
- Enforce unique transaction proofs and atomic proof consumption.
- Use idempotency keys for every externally retried write.
- Treat consensus confirmation and mirror verification as separate states.
- Never submit another payment merely because mirror indexing or provider
  execution is delayed.
- Persist events before broadcasting them over SSE so reconnecting clients can
  recover authoritative state.
- Fail closed on insufficient funds, expired or mismatched challenges, replayed
  proofs, provider timeout, and ambiguous settlement.

## Scope discipline

Build the smallest complete loop first:

`discover → compare → select → pay → verify → deliver → record`

The MVP should prove one capability with at least two comparable providers and
one real Hedera testnet payment. Defer escrow, auctions, multi-chain support,
enterprise authentication, unrestricted provider onboarding, and additional
sponsor integrations until the core loop works end to end.

## Secrets and environments

- Keep local secrets in ignored environment files.
- Commit an environment template containing names and safe defaults only.
- Never print secret values in commands, logs, screenshots, test fixtures, or
  commit messages.
- Use disposable testnet accounts with trivial balances during development.
- Keep deployment tokens and direct database URLs local-only.
- Configure runtime secrets only in the intended deployment environment.
- Rotate lab credentials before the final submission if they were exposed
  outside the trusted development environment.

## Validation

The canonical full validation command is:

```sh
npm run validate
```

It runs formatting checks, static analysis, type checking, tests, and the
production build. In addition:

- run the formatter and static analysis for every code change;
- run targeted tests for the changed behavior;
- run database linting for migration changes;
- build the production application before deployment-related commits; and
- smoke-test the deployed health endpoint after deployment.

Never weaken or delete a failing test merely to make a commit pass.

## Documentation

Keep the README current as capabilities become real. Clearly distinguish:

- implemented and verified behavior;
- deterministic demo fixtures;
- planned features; and
- external services or credentials required to reproduce the result.

Record architecture decisions, migration instructions, environment-variable
names, the payment sequence, failure behavior, deployment steps, and the demo
runbook before submission.
