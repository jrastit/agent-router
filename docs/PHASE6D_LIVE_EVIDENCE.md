# Phase 6D live provider evidence

On 2026-07-26, the guarded local runner completed one real inference against
each server-only provider credential. The runner's result contract omitted the
prompt, raw output, and credentials.

| Provider | Model                    |                            Usage | Reserved / charged / refunded (micro-USD) | Execution ID                                    | Evidence label                                                    |
| -------- | ------------------------ | -------------------------------: | ----------------------------------------: | ----------------------------------------------- | ----------------------------------------------------------------- |
| Scaleway | `llama-3.3-70b-instruct` | 106 prompt + 24 completion = 130 |                             129 / 37 / 92 | `chatcmpl-51f4b52a-38e8-4ad4-9e0e-c1eb681c97b4` | provider-reported Scaleway chat completion                        |
| 0G       | `0gm-1.0-35b-a3b`        | 39 prompt + 488 completion = 527 |                           999 / 452 / 547 | `chatcmpl-167b05cb-522f-46b2-acf5-f6d4b83a5c40` | 0G Router private trust-mode response; not independently attested |

These runs prove the two live provider adapters and redacted exact-arithmetic
summary. They do not satisfy the final deployed-UI acceptance item by
themselves. That proof requires operator-approved exact tinybar rates for both
providers, production catalog synchronization, a credited signed-in user, and
one settled job per provider through the deployed application.

## 0G EUR catalog backfill

On 2026-07-26, `npm run sync:0g-eur-prices` read 23 current 0G models and
updated only null EUR fields on the 23 existing production Supabase rows. The
conversion used the ECB 2026-07-24 reference rate of 1 EUR = 1.1377 USD.
Post-write verification returned 23 rows with zero null input prices and zero
null output prices.

Representative exact EUR-per-million values:

| Model             |    Input |    Output |
| ----------------- | -------: | --------: |
| `0gm-1.0-35b-a3b` | 0.070317 |  0.421904 |
| `claude-fable-5`  | 7.910697 | 39.553485 |
| `claude-opus-4-8` | 3.955349 | 19.776743 |
| `claude-sonnet-5` | 1.670036 |  8.350180 |

The backfill preserved existing EUR values, did not create models, and did not
touch tinybar execution prices. Each updated row retains the USD price payload
and ECB source, observation date, and rate in non-secret source metadata.

## Runnable catalog production repair

The runnable UI and MCP initially failed because production had migrations only
through `20260726000500`: the general EUR catalog worked, but the shared
runnable query referenced tinybar columns added by `20260726000600` and failed
with PostgreSQL `42703`.

After a dry run listed only the expected dependency chain, migrations
`20260726000550` through `20260726001000` were applied on 2026-07-26. The
post-deployment probe reported `latestMigration: 20260726001000` and retained
the deposit, projection, credit-function, and Realtime checks. Production
catalog synchronization then upserted 18 Scaleway models and 23 0G models.

A read-only call through the exact handler shared by
`/api/llm-job-instances` and MCP `list_llm_instances` returned:

- HTTP 200;
- 28 runnable chat instances;
- 15 Scaleway and 13 0G instances; and
- the same 28 safe projected instances through the MCP client.

The handler now distinguishes missing configuration, catalog authorization,
Supabase query/schema failure, invalid response data, and a valid empty
runnable set. The frontend and MCP no longer collapse those states into one
generic unavailable message.

## Catalog score deployment

Migration `20260726001100` added the bounded performance score and its versioned
basis. After both provider synchronizations, a production read-only probe
returned 41 catalog rows with zero null scores and zero null bases. Scores
ranged from 60 to 95. The shared MCP runnable projection returned 28 rows with
scores from 85 to 95.

`catalog-readiness-v1` estimates operational agent performance from enabled
state, chat capability, exact-price completeness, healthy-route redundancy, and
expected latency. It is not presented as an intelligence or benchmark score.
The interactive replay filters by a minimum score and then orders candidates by
increasing exact estimated price.
