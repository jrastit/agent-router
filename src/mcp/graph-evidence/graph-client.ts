import { z } from "zod";

import {
  accountReferenceSchema,
  bytes32Schema,
  economicEvidenceSchema,
  findPaymentOutputSchema,
  listAgentTransactionsOutputSchema,
  paymentEvidenceSchema,
  verifyReceiptHistoryOutputSchema,
  type FindPaymentOutput,
  type ListAgentTransactionsOutput,
  type VerifyReceiptHistoryOutput,
} from "./contracts";

const metaSchema = z.strictObject({
  block: z.strictObject({ number: z.number().int().nonnegative() }),
  hasIndexingErrors: z.boolean(),
});

const anchorGraphSchema = z.strictObject({
  id: bytes32Schema,
  sourceType: z.number().int().nonnegative(),
  sourceId: z.string(),
  hederaTransactionHash: bytes32Schema,
  consensusTimestamp: z.string(),
  sourceIndex: z.string(),
  eventKind: z.string(),
  payloadDigest: bytes32Schema,
  schemaVersion: z.number().int().positive(),
  relayer: accountReferenceSchema,
  destinationContract: accountReferenceSchema,
  destinationTransactionHash: bytes32Schema,
  destinationBlockNumber: z.string(),
  destinationBlockTimestamp: z.string(),
});

const anchorResponseSchema = z.strictObject({
  data: z
    .strictObject({
      _meta: metaSchema,
      byId: anchorGraphSchema.nullable(),
      byHederaTransaction: z.array(anchorGraphSchema),
      byDestinationTransaction: z.array(anchorGraphSchema),
    })
    .optional(),
  errors: z.array(z.object({ message: z.string() }).passthrough()).optional(),
});

const accountResponseSchema = z.strictObject({
  data: z
    .strictObject({
      _meta: metaSchema,
      anchors: z.array(anchorGraphSchema),
    })
    .optional(),
  errors: z.array(z.object({ message: z.string() }).passthrough()).optional(),
});

const economicResponseSchema = z.strictObject({
  data: z
    .strictObject({
      _meta: metaSchema,
      economicEvents: z.array(economicEvidenceSchema),
    })
    .optional(),
  errors: z.array(z.object({ message: z.string() }).passthrough()).optional(),
});

const findAnchorQuery = `
  query FindPayment($reference: Bytes!) {
    _meta { block { number } hasIndexingErrors }
    byId: hederaEventAnchor(id: $reference) {
      id sourceType sourceId hederaTransactionHash consensusTimestamp
      sourceIndex eventKind payloadDigest schemaVersion relayer
      destinationContract destinationTransactionHash destinationBlockNumber
      destinationBlockTimestamp
    }
    byHederaTransaction: hederaEventAnchors(
      first: 20
      where: { hederaTransactionHash: $reference }
    ) {
      id sourceType sourceId hederaTransactionHash consensusTimestamp
      sourceIndex eventKind payloadDigest schemaVersion relayer
      destinationContract destinationTransactionHash destinationBlockNumber
      destinationBlockTimestamp
    }
    byDestinationTransaction: hederaEventAnchors(
      first: 20
      where: { destinationTransactionHash: $reference }
    ) {
      id sourceType sourceId hederaTransactionHash consensusTimestamp
      sourceIndex eventKind payloadDigest schemaVersion relayer
      destinationContract destinationTransactionHash destinationBlockNumber
      destinationBlockTimestamp
    }
  }
`;

const listAnchorsQuery = `
  query ListAgentAnchors($account: Bytes!, $limit: Int!) {
    _meta { block { number } hasIndexingErrors }
    anchors: hederaEventAnchors(
      first: $limit
      orderBy: destinationBlockNumber
      orderDirection: desc
      where: { relayer: $account }
    ) {
      id sourceType sourceId hederaTransactionHash consensusTimestamp
      sourceIndex eventKind payloadDigest schemaVersion relayer
      destinationContract destinationTransactionHash destinationBlockNumber
      destinationBlockTimestamp
    }
  }
`;

const listEconomicQuery = `
  query ListAgentEconomicEvents($account: Bytes!, $limit: Int!) {
    _meta { block { number } hasIndexingErrors }
    economicEvents(
      first: $limit
      orderBy: blockTimestamp
      orderDirection: desc
      where: { subject: $account }
    ) {
      id subject eventType amountTinybars referenceId payloadDigest
      transactionHash blockNumber blockTimestamp
    }
  }
`;

type GraphClientOptions = Readonly<{
  projectionEndpoint: string;
  economicEndpoint: string;
  fetcher?: typeof fetch;
}>;

function checkedEndpoint(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost")
    )
  ) {
    throw new TypeError("Graph endpoint must use HTTPS or loopback HTTP");
  }
  return url.toString();
}

function provenance(
  endpoint: string,
  subgraph: string,
  meta: z.infer<typeof metaSchema>,
) {
  return {
    endpoint,
    subgraph,
    indexedBlock: meta.block.number,
    hasIndexingErrors: meta.hasIndexingErrors,
    completeness: meta.hasIndexingErrors
      ? ("unavailable" as const)
      : ("indexed" as const),
    chainHeadBlock: null,
    lagBlocks: null,
    chain: {
      source: "hedera-testnet" as const,
      destination: "ganache-local" as const,
      destinationChainId: "1337" as const,
    },
    authority:
      "monitoring-only; Hedera Mirror and Postgres remain authoritative" as const,
  };
}

function withLinks(anchor: z.infer<typeof anchorGraphSchema>) {
  const { id, ...evidence } = anchor;
  return paymentEvidenceSchema.parse({
    ...evidence,
    sourceEventId: id,
    links: {
      hashScanTransaction: `https://hashscan.io/testnet/transaction/${encodeURIComponent(anchor.hederaTransactionHash)}`,
      destinationExplorer: null,
    },
  });
}

export class GraphPaymentEvidenceClient {
  private readonly projectionEndpoint: string;
  private readonly economicEndpoint: string;
  private readonly fetcher: typeof fetch;

  constructor(options: GraphClientOptions) {
    this.projectionEndpoint = checkedEndpoint(options.projectionEndpoint);
    this.economicEndpoint = checkedEndpoint(options.economicEndpoint);
    this.fetcher = options.fetcher ?? fetch;
  }

  async findPayment(referenceInput: string): Promise<FindPaymentOutput> {
    const reference = bytes32Schema.parse(referenceInput);
    const data = await this.query(
      this.projectionEndpoint,
      findAnchorQuery,
      { reference },
      anchorResponseSchema,
    );
    const matches = new Map<string, z.infer<typeof anchorGraphSchema>>();
    if (data.byId) matches.set(data.byId.id, data.byId);
    for (const anchor of [
      ...data.byHederaTransaction,
      ...data.byDestinationTransaction,
    ]) {
      matches.set(anchor.id, anchor);
    }
    return findPaymentOutputSchema.parse({
      tool: "find_payment",
      reference,
      matches: [...matches.values()].map(withLinks),
      provenance: provenance(
        this.projectionEndpoint,
        "agent-router/hedera-projection",
        data._meta,
      ),
    });
  }

  async listAgentTransactions(
    accountInput: string,
    limitInput = 10,
  ): Promise<ListAgentTransactionsOutput> {
    const account = accountReferenceSchema.parse(accountInput);
    const limit = z.number().int().min(1).max(50).parse(limitInput);
    const [projection, economic] = await Promise.all([
      this.query(
        this.projectionEndpoint,
        listAnchorsQuery,
        { account, limit },
        accountResponseSchema,
      ),
      this.query(
        this.economicEndpoint,
        listEconomicQuery,
        { account, limit },
        economicResponseSchema,
      ),
    ]);
    return listAgentTransactionsOutputSchema.parse({
      tool: "list_agent_transactions",
      account,
      anchors: projection.anchors.map(withLinks),
      economicEvents: economic.economicEvents,
      provenance: {
        projection: provenance(
          this.projectionEndpoint,
          "agent-router/hedera-projection",
          projection._meta,
        ),
        economic: provenance(
          this.economicEndpoint,
          "agent-router/app-events",
          economic._meta,
        ),
      },
    });
  }

  async verifyReceiptHistory(
    referenceInputs: string[],
  ): Promise<VerifyReceiptHistoryOutput> {
    const references = z
      .array(bytes32Schema)
      .min(1)
      .max(20)
      .parse(referenceInputs);
    const results = await Promise.all(
      references.map((reference) => this.findPayment(reference)),
    );
    const entries = new Map<string, FindPaymentOutput["matches"][number]>();
    const missingReferences: string[] = [];
    for (const [index, result] of results.entries()) {
      if (result.matches.length === 0)
        missingReferences.push(references[index]!);
      for (const entry of result.matches)
        entries.set(entry.sourceEventId, entry);
    }
    const transactionCounts = new Map<string, number>();
    for (const entry of entries.values()) {
      transactionCounts.set(
        entry.destinationTransactionHash,
        (transactionCounts.get(entry.destinationTransactionHash) ?? 0) + 1,
      );
    }
    const duplicateDestinationTransactions = [...transactionCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([transaction]) => transaction);
    return verifyReceiptHistoryOutputSchema.parse({
      tool: "verify_receipt_history",
      verified:
        missingReferences.length === 0 &&
        duplicateDestinationTransactions.length === 0,
      missingReferences,
      duplicateDestinationTransactions,
      entries: [...entries.values()],
      provenance: results[0]!.provenance,
    });
  }

  private async query<D extends { _meta: z.infer<typeof metaSchema> }>(
    endpoint: string,
    query: string,
    variables: Record<string, unknown>,
    schema: z.ZodType<{
      data?: D;
      errors?: Array<{ message: string } & Record<string, unknown>>;
    }>,
  ): Promise<D> {
    const response = await this.fetcher(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Graph endpoint returned HTTP ${response.status}`);
    }
    const parsed = schema.safeParse(await response.json());
    if (
      !parsed.success ||
      !parsed.data.data ||
      parsed.data.errors?.length ||
      parsed.data.data._meta.hasIndexingErrors
    ) {
      throw new Error("Graph endpoint returned unavailable or malformed data");
    }
    return parsed.data.data;
  }
}
