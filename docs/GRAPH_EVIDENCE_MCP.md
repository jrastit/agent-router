# AgentRouter evidence and LLM job MCP

AgentRouter exposes public payment and settlement monitoring evidence through a
reusable Model Context Protocol server. It uses the official TypeScript MCP SDK
and the same strict Graph query and LLM job services as the web demo.

The three evidence tools are read-only monitoring. Hedera Mirror Node
verification and atomic Postgres proof consumption remain authoritative for
payment and application credit. A Graph result can never unlock funds or
provider execution. `create_llm_job` is an authenticated, idempotent write that
persists a job but does not execute it.

## Tools

| Tool                      | Input                                                                               | Result                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `find_payment`            | A bytes32 source-event ID, Hedera transaction hash, or destination transaction hash | Matching indexed anchors and provenance                                    |
| `list_agent_transactions` | A 20-byte pseudonymous subject or relayer address plus an optional limit            | Projection anchors and economic events                                     |
| `verify_receipt_history`  | One to twenty bytes32 receipt references                                            | Missing references, destination-transaction reuse, entries, and provenance |
| `list_llm_instances`      | Empty object                                                                        | Every runnable chat instance with model, privacy, and exact tinybar rates  |
| `create_llm_job`          | Selected instance, prompt, policy limits, spend ceiling, and idempotency key        | Persisted job ID, state, and selected instance ID                          |

Every result includes the public Graph query endpoint, Subgraph name, indexed
block, indexing-error state, source and destination chain identity, and an
explicit monitoring-only authority label. The current Subgraph does not expose
chain head in query results, so `chainHeadBlock` and `lagBlocks` are `null`
rather than estimated.

`list_llm_instances` returns only enabled, chat-capable instances with a synced
exact tinybar price. It omits base URLs, source metadata, credentials, and
server-only database fields. `create_llm_job` requires an instance ID returned
by that tool and revalidates enabled state, capability, privacy, price
freshness, provider credential availability, token limits, and the exact spend
ceiling through the authoritative submission service. Credit sufficiency is
checked and reserved later, before execution. The prompt is stored separately
from the public job row.

The job input fields are:

- `instanceId`: exact string ID from `list_llm_instances`;
- `prompt`: 1 to 100,000 characters;
- `capability`: normally `chat`;
- `privacy`: `public` or `confidential`;
- `maximumInputTokens` and `maximumOutputTokens`: positive integer limits;
- `spendCeilingTinybars`: exact positive integer string; and
- `idempotencyKey`: caller-stable value between 8 and 200 characters.

## Run with stdio

Evidence-only use requires only the public HTTPS Graph query endpoints:

```sh
HEDERA_PROJECTION_PUBLIC_QUERY_URL=https://graph.router.fexhu.com/subgraphs/name/agent-router/hedera-projection
HEDERA_ECONOMIC_PUBLIC_QUERY_URL=https://graph.router.fexhu.com/subgraphs/name/agent-router/app-events
npm run mcp:graph-evidence
```

The process writes MCP protocol frames to stdout. Do not add application logs
there. It does not require a Graph API key, database URL, Hedera key, or Graph
Node administration endpoint.

LLM discovery additionally requires server-only `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` in the repository's ignored `.env`. Local stdio job
creation also requires a current user access token in
`SUPABASE_USER_ACCESS_TOKEN`. Keep these values in the local MCP process
environment, never in tool arguments, committed client configuration, or logs.
If the user token is omitted, instance discovery still works and job creation
fails closed with `Authentication required`.

## Client configurations

Claude Desktop and generic stdio clients:

```json
{
  "mcpServers": {
    "agent-router-graph": {
      "command": "npm",
      "args": ["run", "mcp:graph-evidence"],
      "cwd": "/absolute/path/to/agent-router",
      "env": {
        "HEDERA_PROJECTION_PUBLIC_QUERY_URL": "https://graph.router.fexhu.com/subgraphs/name/agent-router/hedera-projection",
        "HEDERA_ECONOMIC_PUBLIC_QUERY_URL": "https://graph.router.fexhu.com/subgraphs/name/agent-router/app-events"
      }
    }
  }
}
```

Cursor uses the same `mcpServers` entry in its MCP configuration. Generic MCP
clients can spawn the same command over stdio.

ChatGPT supports remote MCP servers rather than a local stdio command. Use the
deployed `/api/mcp/graph-evidence` Streamable HTTP endpoint after confirming the
deployment allows the intended origin. Send the signed-in Supabase user access
token as the HTTP `Authorization: Bearer …` header when using
`create_llm_job`; do not put it in MCP tool arguments. Never expose a private
Graph endpoint or convert Graph Node administration ports into public MCP
configuration.

The application frontend uses `/api/graph-evidence`, an adapter that invokes
the same registered MCP tools over an in-memory transport. Its MCP panel lists
live instance details, lets a signed-in user choose an instance, and creates the
job through `create_llm_job`. The separate “Interactive decision replay” loads
every safe `/api/llm-instances` Supabase row, including disabled or currently
ineligible models, and displays the reason each fails policy. In the “Latest
Graph activity” tab, each anchor exposes its full record reference through
“Copy for MCP”; paste that bytes32 value directly into `find_payment`.

## Example prompts

- “Use `find_payment` for this source-event ID and state whether the result is
  authoritative payment proof or monitoring evidence.”
- “List the latest public events for this pseudonymous account.”
- “Verify these receipt references and identify missing history or reused
  destination transactions.”
- “List the runnable LLM instances and compare their exact input and output
  tinybar rates.”
- “Create a confidential chat job on instance 42 with these token limits and
  this stable idempotency key.”

## Demo

1. Start the application or open the deployed UI.
2. Paste the recorded source-event ID from
   `docs/GRAPH_EVIDENCE_MCP_EVIDENCE.md`.
3. Select `find_payment` and submit once.
4. Show the structured tool call, indexed block, chain identities, transaction
   references, and monitoring-only authority label.
5. Show the MCP instance selector, choose a model, and create one job while
   signed in. Explain that creation does not execute or charge the job.
6. Repeat the same reference through an external MCP client and compare the
   structured result.

The demonstration should take two to four minutes and must not present fixtures
as live Graph evidence.

x402 is not implemented in this MCP. The existing custom Hedera HTTP `402`
challenge is not described as x402-compatible. A future paid MCP adapter must
use the actual x402 protocol and remain separate from evidence authority.
