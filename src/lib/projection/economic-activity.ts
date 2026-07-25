import { z } from "zod";

const hexSchema = z.string().regex(/^0x[0-9a-f]+$/i);
const integerSchema = z.string().regex(/^-?(0|[1-9][0-9]*)$/);

const economicActivityResponseSchema = z.strictObject({
  data: z
    .strictObject({
      _meta: z.strictObject({
        block: z.strictObject({ number: z.number().int().nonnegative() }),
        hasIndexingErrors: z.boolean(),
      }),
      economicEvents: z.array(
        z.strictObject({
          id: hexSchema,
          subject: hexSchema,
          eventType: z.number().int().min(1).max(7),
          amountTinybars: integerSchema,
          referenceId: hexSchema,
          transactionHash: hexSchema,
          blockNumber: integerSchema,
          blockTimestamp: integerSchema,
        }),
      ),
    })
    .optional(),
  errors: z.array(z.object({ message: z.string() }).passthrough()).optional(),
});

const economicActivityQuery = `
  query LatestEconomicActivity {
    _meta {
      block { number }
      hasIndexingErrors
    }
    economicEvents(first: 1000, orderBy: blockTimestamp, orderDirection: desc) {
      id
      subject
      eventType
      amountTinybars
      referenceId
      transactionHash
      blockNumber
      blockTimestamp
    }
  }
`;

type EconomicActivityData = NonNullable<
  z.infer<typeof economicActivityResponseSchema>["data"]
>;

export type EconomicEvent = EconomicActivityData["economicEvents"][number];

export type UserFunds = {
  subject: string;
  depositedTinybars: string;
  spentTinybars: string;
  refundedTinybars: string;
  availableTinybars: string;
  latestBlockTimestamp: string;
  events: EconomicEvent[];
};

export type EconomicActivity = {
  indexedBlock: number;
  sourceUrl: string;
  users: UserFunds[];
};

function absoluteTinybars(amount: string) {
  const value = BigInt(amount);
  return value < BigInt(0) ? -value : value;
}

export function summarizeEconomicActivity(
  data: EconomicActivityData,
  sourceUrl: string,
): EconomicActivity {
  const grouped = new Map<string, EconomicEvent[]>();
  for (const event of data.economicEvents) {
    grouped.set(event.subject, [...(grouped.get(event.subject) ?? []), event]);
  }

  const users = [...grouped.entries()].map(([subject, events]) => {
    let deposited = BigInt(0);
    let spent = BigInt(0);
    let refunded = BigInt(0);

    for (const event of events) {
      const amount = absoluteTinybars(event.amountTinybars);
      if (event.eventType === 2) deposited += amount;
      if (event.eventType === 5) spent += amount;
      if (event.eventType === 6) refunded += amount;
    }

    return {
      subject,
      depositedTinybars: deposited.toString(),
      spentTinybars: spent.toString(),
      refundedTinybars: refunded.toString(),
      availableTinybars: (deposited - spent + refunded).toString(),
      latestBlockTimestamp: events[0]?.blockTimestamp ?? "0",
      events,
    };
  });

  users.sort((a, b) =>
    Number(BigInt(b.latestBlockTimestamp) - BigInt(a.latestBlockTimestamp)),
  );

  return {
    indexedBlock: data._meta.block.number,
    sourceUrl,
    users,
  };
}

export async function loadEconomicActivity(
  endpoint: string,
  fetchImplementation: typeof globalThis.fetch = globalThis.fetch,
): Promise<EconomicActivity> {
  const url = new URL(endpoint);
  if (url.protocol !== "https:" && url.hostname !== "127.0.0.1") {
    throw new TypeError("Economic activity endpoint must use HTTPS");
  }

  const response = await fetchImplementation(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: economicActivityQuery }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `Economic activity endpoint returned HTTP ${response.status}`,
    );
  }

  const parsed = economicActivityResponseSchema.safeParse(
    await response.json(),
  );
  if (
    !parsed.success ||
    !parsed.data.data ||
    parsed.data.errors?.length ||
    parsed.data.data._meta.hasIndexingErrors
  ) {
    throw new Error("Economic activity endpoint returned unavailable data");
  }

  return summarizeEconomicActivity(parsed.data.data, url.toString());
}
