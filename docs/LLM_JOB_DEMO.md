# Local LLM job demonstration

The local runner exercises one shared, balance-style LLM job contract with
either a Scaleway or 0G adapter. Its JSON summary intentionally excludes the
prompt, raw output, credentials, and public receipts.

## Deterministic offline rehearsal

These commands use fixtures. They do not contact a provider, spend tokens, or
spend native 0G:

```sh
npm run demo:llm:offline -- --provider=scaleway
npm run demo:llm:offline -- --provider=0g
```

The output records the selected instance and model, lifecycle states,
provider-style integer usage, exact integer micro-USD reservation, charge and
refund amounts, execution ID, and a verification label.

## Live provider execution

Live commands consume real provider tokens. They fail closed unless both the
matching server-only credential and `CONFIRM_LIVE_LLM_DEMO=yes` are present in
the ignored `.env` file.

```sh
CONFIRM_LIVE_LLM_DEMO=yes npm run demo:llm:scaleway
CONFIRM_LIVE_LLM_DEMO=yes npm run demo:llm:0g
```

Scaleway requires `SCALEWAY_GENAI_API_KEY`; 0G requires
`G_API_KEY_PRIVATE`. `LLM_DEMO_PROMPT` and `LLM_DEMO_IDEMPOTENCY_KEY` are
optional. `LLM_DEMO_MAXIMUM_INPUT_TOKENS` and
`LLM_DEMO_MAXIMUM_OUTPUT_TOKENS` can raise the guarded request limits for
reasoning models. The 0G runner disables provider fallback, requests Router
private trust mode, and uses low reasoning effort. Its label is deliberately
not an independent TEE-attestation claim.

Set `SCALEWAY_GENAI_API_BASE` for a deployment-specific Scaleway endpoint.
`SCALEWAY_GENAI_BASE_URL` remains supported and takes precedence when both are
set.

Catalog synchronization also requires operator-defined exact application
credit rates in `SCALEWAY_INPUT_PRICE_TINYBAR_PER_MILLION`,
`SCALEWAY_OUTPUT_PRICE_TINYBAR_PER_MILLION`,
`ZG_INPUT_PRICE_TINYBAR_PER_MILLION`, and
`ZG_OUTPUT_PRICE_TINYBAR_PER_MILLION`. Each value is a non-negative integer
tinybar rate per million tokens. Synchronization stores the rates and their
timestamp with each model; accepted jobs snapshot them before reserving credit.

## Complete 0G path

The optional integration test composes live 0G Compute, Storage, Chain
anchoring, and independent receipt verification:

```sh
npm run demo:llm:0g:complete
```

That test is skipped unless its live integration environment is fully
configured. When enabled, it consumes 0G provider resources and may spend
native 0G for Storage and Chain transactions. Follow
[the Phase 5 evidence guide](0G_PHASE5.md) for the required variables and
network safeguards.
