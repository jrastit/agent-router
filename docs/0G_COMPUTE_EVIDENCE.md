# 0G Compute evidence

## Implemented integration

AgentRouter uses the 0G Compute Router mainnet HTTP API directly. It does not
use the wallet-based Direct SDK flow.

| Field                   | Value                                                                   |
| ----------------------- | ----------------------------------------------------------------------- |
| API                     | 0G Compute Router, OpenAI-compatible HTTP API                           |
| Base URL                | `https://router-api.0g.ai/v1`                                           |
| Network                 | 0G mainnet                                                              |
| Inference credential    | Server-only `sk-` key in `G_API_KEY_PRIVATE`                            |
| Management credential   | Server-only `mk-` key in `G_API_KEY_MANAGEMENT`; not used for inference |
| Catalog                 | `GET /v1/models` and `GET /v1/providers?model=...`                      |
| Execution               | `POST /v1/chat/completions`                                             |
| Privacy constraint      | `X-0G-Provider-Trust-Mode: private`                                     |
| Deterministic selection | `X-0G-Provider-Address` with fallbacks disabled                         |

The Router documentation defines `private` trust mode as TeeML-only: the model
runs inside the TEE and prompts do not leave the enclave. AgentRouter records
that enforced trust mode and the selected on-chain provider address. This is
Router enforcement evidence, not an independently downloaded attestation
report.

## Live verification

Verified on 2026-07-25:

- model: `0gm-1.0-35b-a3b`;
- provider: `0x4870CbC4D07d6Ac2EE5aA865588e5985FE77a4E9`;
- verification mode from the live provider catalog: `TeeML`;
- Router execution ID:
  `chatcmpl-7893c3c9-5eda-4097-b1eb-25fc20bb4e3a`;
- response: HTTP 200 with a non-empty typed text result; and
- usage: 35 prompt tokens, 135 completion tokens, 170 total tokens.

The prompt and returned text are intentionally omitted. Earlier bounded probes
also returned HTTP 200 but exhausted their artificial completion caps on
reasoning tokens; they are not treated as successful delivery evidence.

## Failure behavior

The adapter fails closed when the selected route is not confidential TeeML,
when an `mk-` key is supplied for inference, on authentication or policy
errors, on invalid response shape, and after bounded transient retries or the
overall timeout.

The management key is not needed for runtime inference. It is reserved for
explicit future account, usage, or key-management operations and must never
reach browser code.
