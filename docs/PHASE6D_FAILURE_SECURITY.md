# Phase 6D — LLM job failure and security matrix

Phase 6D fails closed before inference when authentication, catalog policy, or
credit reservation fails. Once a provider request may have completed, uncertain
usage or settlement moves the reservation to reconciliation instead of guessing
a charge or repeating inference.

| Case                              | Expected invariant                                                                        | Automated evidence                                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Duplicate submission              | Return the existing owner-scoped job and do not persist another prompt                    | `src/app/api/llm-jobs/route.test.ts`                                                                        |
| Insufficient credit               | Reservation fails before an attempt or provider call starts                               | `src/lib/llm-jobs/execution.test.ts`                                                                        |
| Concurrent reservations           | Lock both the job and credit account before checking and moving funds                     | `supabase/migrations/reserve-llm-job-credit.test.ts`                                                        |
| Provider authentication           | Release reserved credit with a stable terminal failure                                    | `src/lib/llm-jobs/execution.test.ts`, `src/lib/llm-jobs/providers.test.ts`                                  |
| Timeout or ambiguous completion   | Preserve funds for reconciliation; never infer or charge again automatically              | `src/lib/llm-jobs/execution.test.ts`, `supabase/migrations/settle-llm-job-credit.test.ts`                   |
| Invalid output                    | Reject empty or wrong-model output and reconcile without delivery                         | `src/lib/llm-jobs/providers.test.ts`, `src/lib/llm-jobs/execution.test.ts`                                  |
| Missing or excessive usage        | Reject unverifiable usage and reconcile instead of calculating an estimate                | `src/lib/llm-jobs/providers.test.ts`, `src/lib/llm-jobs/execution.test.ts`                                  |
| Disabled or incompatible instance | Reject before persistence, reservation, or execution                                      | `src/app/api/llm-jobs/route.test.ts`                                                                        |
| Provider retry                    | Reuse the same idempotency key and keep provider fallback disabled                        | `src/lib/llm-jobs/providers.test.ts`                                                                        |
| Exact charge and refund           | Recompute from the accepted bigint snapshot, charge once, and release the exact remainder | `src/lib/llm-jobs/pricing.test.ts`, `supabase/migrations/settle-llm-job-credit.test.ts`                     |
| Refresh or execute retry          | Restore persisted owner state without another inference or charge                         | `src/lib/llm-jobs/snapshot.test.ts`, `src/lib/llm-jobs/execution.test.ts`                                   |
| Secret leakage                    | Reject API-key request fields, redact evidence, and scan the production client bundle     | `src/app/api/llm-jobs/route.test.ts`, `src/lib/llm-jobs/providers.test.ts`, `npm run verify:client-secrets` |

The canonical proof command is `npm run validate`. Database migrations are
additionally checked with `supabase db lint` against the local Phase 6D schema.

The deterministic browser flow is covered by `npm run validate:e2e`. It starts
a production-disabled test page, intercepts only the external HTTP boundaries,
and verifies catalog selection, private prompt submission, one execution,
exact settlement rendering, redacted evidence, and refresh recovery without a
second submission, provider call, or charge. Install its Chromium runtime once
with `npx playwright install chromium`.
