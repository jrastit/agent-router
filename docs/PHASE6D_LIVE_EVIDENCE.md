# Phase 6D live provider evidence

On 2026-07-26, the guarded local runner completed one real inference against
each server-only provider credential. The runner's result contract omitted the
prompt, raw output, and credentials.

| Provider | Model | Usage | Reserved / charged / refunded (micro-USD) | Execution ID | Evidence label |
| --- | --- | ---: | ---: | --- | --- |
| Scaleway | `llama-3.3-70b-instruct` | 106 prompt + 24 completion = 130 | 129 / 37 / 92 | `chatcmpl-51f4b52a-38e8-4ad4-9e0e-c1eb681c97b4` | provider-reported Scaleway chat completion |
| 0G | `0gm-1.0-35b-a3b` | 39 prompt + 488 completion = 527 | 999 / 452 / 547 | `chatcmpl-167b05cb-522f-46b2-acf5-f6d4b83a5c40` | 0G Router private trust-mode response; not independently attested |

These runs prove the two live provider adapters and redacted exact-arithmetic
summary. They do not satisfy the final deployed-UI acceptance item by
themselves. That proof requires operator-approved exact tinybar rates for both
providers, production catalog synchronization, a credited signed-in user, and
one settled job per provider through the deployed application.
