# Graph payment-evidence MCP live evidence

On 26 July 2026, the public
`agent-router/hedera-projection` Subgraph and the reusable MCP were queried
through an external stdio MCP client.

The `find_payment` tool received source-event ID
`0xdb3a831451eedd88f68ff90d2d2a6343283b6164282cd600540babb673183a65`
and returned:

- Graph endpoint:
  `https://graph.router.fexhu.com/subgraphs/name/agent-router/hedera-projection`;
- indexed block: `10`;
- indexing errors: `false`;
- event kind: `deposit.credited`;
- Hedera transaction identity hash:
  `0xb7d4f79915fc99807030a929d7133a8a625509589160d6e95acf1aadced66bb5`;
- Hedera consensus timestamp: `1785032494.963654104`;
- destination transaction:
  `0x4ce69b09ec4fa81576d5e93ff104d72b2caa5a24a04acb43f5c51ec71839251f`;
- destination block: `10`; and
- authority:
  `monitoring-only; Hedera Mirror and Postgres remain authoritative`.

The response reports chain-head lag as unknown because the public Subgraph
query exposes its indexed block but not the destination chain head. It does not
claim completeness beyond the indexed Graph data.

Reproduce the guarded live proof:

```sh
npm run test:mcp:graph-live
```

This is a read-only public Graph query. It does not submit a transaction, spend
tokens, mutate application credit, or require a private credential.
