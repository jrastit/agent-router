import { z } from "zod";

const hexSchema = z.string().regex(/^0x[0-9a-f]+$/);
const integerSchema = z.string().regex(/^(0|[1-9][0-9]*)$/);

const activityResponseSchema = z.strictObject({
  data: z
    .strictObject({
      _meta: z.strictObject({
        block: z.strictObject({ number: z.number().int().nonnegative() }),
        hasIndexingErrors: z.boolean(),
      }),
      hederaEventAnchors: z.array(
        z.strictObject({
          id: hexSchema,
          hederaTransactionHash: hexSchema,
          consensusTimestamp: z.string().regex(/^[0-9]+\.[0-9]{1,9}$/),
          destinationTransactionHash: hexSchema,
          destinationBlockNumber: integerSchema,
        }),
      ),
    })
    .optional(),
  errors: z.array(z.object({ message: z.string() }).passthrough()).optional(),
});

const latestActivityQuery = `
  query LatestGraphActivity {
    _meta {
      block { number }
      hasIndexingErrors
    }
    hederaEventAnchors(
      first: 5
      orderBy: destinationBlockNumber
      orderDirection: desc
    ) {
      id
      hederaTransactionHash
      consensusTimestamp
      destinationTransactionHash
      destinationBlockNumber
    }
  }
`;

type GraphActivityData = NonNullable<
  z.infer<typeof activityResponseSchema>["data"]
>;

export type GraphActivity = GraphActivityData & {
  sourceUrl: string;
};

export async function loadLatestGraphActivity(
  endpoint: string,
  fetchImplementation: typeof globalThis.fetch = globalThis.fetch,
): Promise<GraphActivity> {
  const url = new URL(endpoint);
  if (url.protocol !== "https:" && url.hostname !== "127.0.0.1") {
    throw new TypeError("Graph activity endpoint must use HTTPS");
  }

  const response = await fetchImplementation(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: latestActivityQuery }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Graph activity endpoint returned HTTP ${response.status}`);
  }

  const parsed = activityResponseSchema.safeParse(await response.json());
  if (
    !parsed.success ||
    !parsed.data.data ||
    parsed.data.errors?.length ||
    parsed.data.data._meta.hasIndexingErrors
  ) {
    throw new Error("Graph activity endpoint returned unavailable data");
  }

  return { ...parsed.data.data, sourceUrl: url.toString() };
}
