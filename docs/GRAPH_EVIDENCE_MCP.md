# Graph payment-evidence MCP

AgentRouter exposes public payment and settlement monitoring evidence through a
reusable Model Context Protocol server. It uses the official TypeScript MCP SDK
and the same strict Graph query service as the web demo.

The MCP is read-only monitoring. Hedera Mirror Node verification and atomic
Postgres proof consumption remain authoritative for payment and application
credit. A Graph result can never unlock funds or provider execution.

## Tools

| Tool                      | Input                                                                               | Result                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `find_payment`            | A bytes32 source-event ID, Hedera transaction hash, or destination transaction hash | Matching indexed anchors and provenance                                    |
| `list_agent_transactions` | A 20-byte pseudonymous subject or relayer address plus an optional limit            | Projection anchors and economic events                                     |
| `verify_receipt_history`  | One to twenty bytes32 receipt references                                            | Missing references, destination-transaction reuse, entries, and provenance |

Every result includes the public Graph query endpoint, Subgraph name, indexed
block, indexing-error state, source and destination chain identity, and an
explicit monitoring-only authority label. The current Subgraph does not expose
chain head in query results, so `chainHeadBlock` and `lagBlocks` are `null`
rather than estimated.

## Run with stdio

Configure only public HTTPS query endpoints:

```sh
HEDERA_PROJECTION_PUBLIC_QUERY_URL=https://graph.router.fexhu.com/subgraphs/name/agent-router/hedera-projection
HEDERA_ECONOMIC_PUBLIC_QUERY_URL=https://graph.router.fexhu.com/subgraphs/name/agent-router/app-events
npm run mcp:graph-evidence
```

The process writes MCP protocol frames to stdout. Do not add application logs
there. It does not require a Graph API key, database URL, Hedera key, or Graph
Node administration endpoint.

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
deployment allows the intended origin. Never expose a private Graph endpoint
or convert Graph Node administration ports into public MCP configuration.

## Example prompts

- “Use `find_payment` for this source-event ID and state whether the result is
  authoritative payment proof or monitoring evidence.”
- “List the latest public events for this pseudonymous account.”
- “Verify these receipt references and identify missing history or reused
  destination transactions.”

## Demo

1. Start the application or open the deployed UI.
2. Paste the recorded source-event ID from
   `docs/GRAPH_EVIDENCE_MCP_EVIDENCE.md`.
3. Select `find_payment` and submit once.
4. Show the structured tool call, indexed block, chain identities, transaction
   references, and monitoring-only authority label.
5. Repeat the same reference through an external MCP client and compare the
   structured result.

The demonstration should take two to four minutes and must not present fixtures
as live Graph evidence.

x402 is not implemented in this MCP. The existing custom Hedera HTTP `402`
challenge is not described as x402-compatible. A future paid MCP adapter must
use the actual x402 protocol and remain separate from evidence authority.
