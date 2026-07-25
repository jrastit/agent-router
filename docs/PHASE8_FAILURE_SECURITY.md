# Phase 8 — failure and security hardening

Phase 8 closes the known commerce-loop failure matrix without changing the
deferred Phase 6b projection scope.

## Verified failure matrix

| Boundary                   | Expected stable outcome                                                               | Regression evidence                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Delegated credit           | Oversized and concurrent reservations fail before spend                               | `supabase/tests/phase6a.sql`                                                                      |
| On-chain HBAR balance      | Submission failure enters reconciliation and is never resubmitted                     | `src/lib/payment/hedera.test.ts`                                                                  |
| Quote and challenge expiry | Expired inputs fail before reservation or transfer                                    | `supabase/tests/phase8.sql`, `src/lib/payment/challenge.test.ts`                                  |
| Challenge binding          | Amount, recipient, memo, network, asset, payer, and quote are exact                   | `src/lib/payment/challenge.test.ts`, `src/lib/payment/mirror.test.ts`                             |
| Retry and replay           | HTTP retries retain one idempotency key; proofs and writes are unique                 | `src/toolkit/compute/0g-router.test.ts`, `supabase/tests/phase2.sql`, `supabase/tests/phase6.sql` |
| Mirror lag/outage          | A 404 stays recoverable as `MIRROR_PENDING`; timeout/outage uses `MIRROR_UNAVAILABLE` | `src/lib/payment/mirror.test.ts`                                                                  |
| Provider/model timeout     | Deterministic planning fallback or stable execution timeout                           | `src/lib/planner/planner.test.ts`, `src/toolkit/compute/0g-router.test.ts`                        |
| Discovery/delivery         | Outages never substitute fixtures; malformed deliveries fail schema validation        | `src/lib/discovery/graph.test.ts`, `src/lib/domain/schema.test.ts`                                |
| Secret boundary            | Errors omit prompt/key material and production client chunks are scanned after build  | `src/toolkit/compute/0g-router.test.ts`, `scripts/verify-client-bundle-secrets.mjs`               |
| Row-level security         | Anonymous and cross-user reads return no rows; forged ownership is rejected           | `supabase/tests/phase8.sql`                                                                       |

The canonical `npm run validate` gate now scans the completed production client
bundle for both server-only environment names and any configured secret values.
It reports only the offending variable name, never its value.
